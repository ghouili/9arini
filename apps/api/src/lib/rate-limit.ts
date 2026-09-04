import { rateLimits, sql as raw } from "@tnajem/db";
import { db } from "../db";

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
      .values({ key, count: 1, resetAt: new Date(Date.now() + windowMs) })
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
    console.error("[tnajem-api] rate_limits upsert failed — falling back to in-process limiter", e);
    return rateLimitInProcess(key, limit, windowMs);
  }
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  return rateLimitDb(key, limit, windowMs);
}
