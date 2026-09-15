import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { and, eq, gt, rateLimits, sql as raw } from "@tnajem/db";
import { authSecret } from "@tnajem/shared/auth-core";
import { db } from "../db";

/* ── KEY PARTS ────────────────────────────────────────────────────────────────
   A rate-limit key is stored in rate_limits for the length of its window, and a
   failed upsert once echoed it into a log. Neither place may hold an e-mail
   address, so an identity goes into a key as a keyed hash: stable for the window,
   meaningless outside this process (a plain sha256 of an address is reversible by
   anyone with a list of addresses). */
export function rlSubject(value: string): string {
  return createHmac("sha256", authSecret()).update(`tnajem:rate-limit:${value}`).digest("hex").slice(0, 32);
}

/* The bucket an address belongs to. IPv4 as-is. IPv6 by its /64: one subscriber
   is handed a whole /64, so keying the full address gave anyone with one
   connection ~2^64 fresh budgets (security review, 15 Sept 2026). An IPv4-mapped
   IPv6 address is its IPv4 address. */
export function ipBucket(ip: string | undefined): string {
  const raw = (ip ?? "").trim();
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(raw);
  if (mapped) return mapped[1];
  if (isIP(raw) !== 6) return raw || "unknown";
  const [head, tail = ""] = raw.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = raw.includes("::") ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right] : left;
  return `${groups.slice(0, 4).map((g) => parseInt(g || "0", 16).toString(16)).join(":")}::/64`;
}

/* The durable, cross-instance rate limiter, ported from apps/web/lib/auth.ts.

   Two layers, and the ORDER of the fallback matters:

     1. Postgres (rate_limits), one atomic INSERT .. ON CONFLICT DO UPDATE using
        the DATABASE clock, so instances with skewed clocks still agree on when a
        window ends.
     2. An in-process fixed-window Map, used ONLY when (1) throws.

   Under Fastify, layer 2 is much weaker than it was in the monolith: there is no
   longer a single process that sees all traffic, so a Postgres outage degrades
   this to per-instance limiting. It still stops one client hammering one
   endpoint, which is the case we are actually exposed to, and failing OPEN is
   right — a transient limiter write failure must not become a total login outage,
   because every surrounding action hits the database anyway and would fail on its
   own if Postgres were really gone.

   NOTE the bug this was carrying until Step 0: the conflict clause interpolated a
   JS Date into a raw sql`` template, where Drizzle applies no column type mapping,
   so postgres.js threw ERR_INVALID_ARG_TYPE on EVERY upsert and the catch below
   silently swallowed it. rate_limits stayed permanently empty and nobody noticed,
   because the fallback kept throttling in-process. The window is computed with
   now() for that reason — and e2e/rate-limit.spec.ts asserts rows are WRITTEN,
   not merely that a request was throttled. */

export type RateLimitResult = { ok: boolean; retryAfter: number };

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 20_000; // hard memory bound: rotating IPs cannot grow this forever

export function rateLimitInProcess(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(key);

  if (!b || b.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
      // Still full after sweeping expired entries → refuse rather than grow.
      if (buckets.size >= MAX_BUCKETS) return { ok: false, retryAfter: 60 };
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  b.count += 1;
  if (b.count > limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  return { ok: true, retryAfter: 0 };
}

async function rateLimitDb(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  try {
    const [row] = await db
      .insert(rateLimits)
      /* The DATABASE clock on the first insert too. It was new Date(Date.now()+…) —
         the app clock — while the header promised skew-proof windows: two instances
         a few seconds apart opened windows that ended at different times. */
      .values({ key, count: 1, resetAt: raw`now() + ${windowMs} * interval '1 millisecond'` })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: raw`case when ${rateLimits.resetAt} <= now() then 1 else ${rateLimits.count} + 1 end`,
          /* now() + interval, NOT a bound JS Date — see the header. */
          resetAt: raw`case when ${rateLimits.resetAt} <= now()
                            then now() + ${windowMs} * interval '1 millisecond'
                            else ${rateLimits.resetAt} end`,
        },
      })
      .returning({ count: rateLimits.count, resetAt: rateLimits.resetAt });

    const count = row?.count ?? 1;
    const resetMs = row?.resetAt ? new Date(row.resetAt).getTime() : Date.now() + windowMs;
    if (count > limit) {
      return { ok: false, retryAfter: Math.max(1, Math.ceil((resetMs - Date.now()) / 1000)) };
    }
    return { ok: true, retryAfter: 0 };
  } catch (e) {
    /* The error CODE only. A driver error can echo the statement's parameters, and
       a key is often an identity (otp:vfy:id:<email>) — this line bypasses pino's
       redaction, so it must carry nothing personal. */
    console.error(
      "[tnajem-api] rate_limits upsert failed — falling back to in-process limiter:",
      (e as { code?: string }).code ?? (e as Error).name,
    );
    return rateLimitInProcess(key, limit, windowMs);
  }
}

/** Would one more hit be refused? Reads the window WITHOUT spending it — for budgets
    that only failures may consume. Fails open, like checkRateLimit. */
export async function peekRateLimit(key: string, limit: number): Promise<RateLimitResult> {
  try {
    const [row] = await db
      .select({ count: rateLimits.count, resetAt: rateLimits.resetAt })
      .from(rateLimits)
      .where(and(eq(rateLimits.key, key), gt(rateLimits.resetAt, raw`now()`)))
      .limit(1);
    if (!row || row.count < limit) return { ok: true, retryAfter: 0 };
    return { ok: false, retryAfter: Math.max(1, Math.ceil((new Date(row.resetAt).getTime() - Date.now()) / 1000)) };
  } catch (e) {
    console.error("[tnajem-api] rate_limits read failed:", (e as { code?: string }).code ?? (e as Error).name);
    const b = buckets.get(key);
    return !b || b.resetAt <= Date.now() || b.count < limit
      ? { ok: true, retryAfter: 0 }
      : { ok: false, retryAfter: Math.max(1, Math.ceil((b.resetAt - Date.now()) / 1000)) };
  }
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  return rateLimitDb(key, limit, windowMs);
}
