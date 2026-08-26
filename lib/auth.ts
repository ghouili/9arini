import "server-only";
import { cookies, headers } from "next/headers";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { db, dbReady } from "./db";
import { profiles, sessions, otpCodes, rateLimits } from "./db/schema";

/* Custom phone-OTP + session auth on Postgres (no external auth dep).
   SMS delivery is pluggable: when no SMS provider is configured, requestOtp
   returns the code so the flow is completable in dev. Sessions are opaque
   tokens in an HTTP-only cookie, backed by the `sessions` table. */

export const SESSION_COOKIE = "tnajem_session";
/* NON-SENSITIVE UI hint, readable by the client. It lets the global <SiteHeader>
   show the right nav link WITHOUT a getMe() server-action POST on every page load —
   the POST that made every perfectly-cached page drag an uncacheable request behind
   it (SCALABILITY.md / launch brief Phase 2). It is NOT a credential: it is readable
   and forgeable, holds only the coarse role, and only ever decides which link the
   header renders. Every server action still re-derives identity from the httpOnly
   SESSION_COOKIE above, so forging this buys nothing but a nav link that bounces you
   to /auth. */
export const ROLE_HINT_COOKIE = "tnajem_role";
const SESSION_DAYS = 30;
const OTP_TTL_MIN = 5;
const MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60_000; // min gap between code sends to one phone
/* AUTH_SECRET is the whole strength of the OTP hash: hashCode() is
   sha256(`${phone}:${code}:${SECRET}`). With the dev default in place — a string
   that is committed to this repo — the hash of all 1,000,000 codes for a given
   phone is computable offline, so `otp_codes.code_hash` stops being a secret and
   the 5-attempt budget stops meaning anything. That is a full auth bypass, and
   ADMIN_PHONES is only ever one OTP away from the pending-verification queue and
   every national ID scan in it.

   So a production process must NEVER serve a login with the dev default. It throws.

   ── WHY THIS IS LAZY AND NOT A MODULE-LOAD THROW ────────────────────────────
   It used to throw in a module-level IIFE. That breaks `next build`.

   `next build` runs with NODE_ENV=production and EVALUATES this module: every
   page imports SiteShell → SiteHeader → "@/app/actions" → this file, so lib/auth
   is in the server module graph of literally every route, including the ones that
   get prerendered to static HTML (/, /terms, /privacy, /pour-les-profs …). A
   module-level throw therefore fires during "Generating static pages" on any box
   that does not have AUTH_SECRET in the BUILD environment — which is the normal
   setup (build in CI, inject secrets at runtime; or `docker build` with runtime
   env). The result is a failed build, not a safe one, and it makes the build
   artifact depend on a runtime secret. It only passed locally because .env.local
   happens to define AUTH_SECRET and Next loads .env.local during build.

   Lazy is strictly better and loses nothing that matters:
     • The secret is resolved on FIRST USE — i.e. inside hashCode(), which is only
       reachable from createOtp() / verifyOtpCode(). A production process with no
       AUTH_SECRET throws on the very first login attempt, before a single code is
       ever minted or accepted. No request is EVER served with the insecure default.
     • The boot-time warning below still makes a misconfigured deploy loud in the
       logs immediately, without killing a build that has no business needing the
       secret.
   Fail fast at the first login, not at `next build`. */
const DEV_SECRET = "dev-insecure-secret-change-me";

function missingSecretError(): Error {
  return new Error(
    "[Tnajem] AUTH_SECRET is not set (or is empty). It is REQUIRED in production: every " +
      "OTP hash depends on it and the dev default is public. Generate one with " +
      "`openssl rand -hex 32` and put it in the environment. Refusing to hash an OTP.",
  );
}

let cachedSecret: string | null = null;

/** Resolved on first use (never at module load — see above). Throws in prod if unset. */
function authSecret(): string {
  if (cachedSecret) return cachedSecret;
  const fromEnv = process.env.AUTH_SECRET?.trim();
  if (fromEnv) {
    cachedSecret = fromEnv;
    return cachedSecret;
  }
  if (process.env.NODE_ENV === "production") throw missingSecretError();
  cachedSecret = DEV_SECRET;
  return cachedSecret;
}

/* Boot-time loudness without boot-time death: a production process that starts
   without AUTH_SECRET says so in the logs on the first import, and then dies on
   the first login attempt (authSecret() above). `next build` is unaffected. */
if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET?.trim()) {
  console.error(
    "[Tnajem] FATAL CONFIG: AUTH_SECRET is not set. Every login WILL fail until it is. " +
      "Generate one with `openssl rand -hex 32`.",
  );
}

/* ══════════════ Rate limiting (dependency-free, in-process) ══════════════
   A fixed-window counter kept in a module-level Map.

   LIMITATION — READ BEFORE SCALING OUT: the counters live in the Node process's
   memory. On a multi-instance deploy each instance keeps its own window, so the
   effective limit is (instances × limit), and a rolling deploy resets them. That
   is an acceptable trade for the pilot (single box) because it still shuts down
   the case we are actually exposed to: one client hammering one endpoint. Before
   running more than one instance, back these counters with Postgres or Redis.

   It is NOT a substitute for the per-code attempt counter on otp_codes (that one
   is durable and survives a restart) — the two layers stack on purpose. */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 20_000; // hard memory bound — an attacker rotating IPs can't grow this forever

export type RateLimitResult = { ok: boolean; retryAfter: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  // Opportunistic sweep of expired windows; only when the map actually grows large.
  if (buckets.size >= MAX_BUCKETS) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    // Still full of live windows → we are under a distributed flood. Fail CLOSED:
    // refusing a few legitimate requests beats letting the limiter be bypassed.
    if (buckets.size >= MAX_BUCKETS) return { ok: false, retryAfter: 60 };
  }

  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= limit) return { ok: false, retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  b.count += 1;
  return { ok: true, retryAfter: 0 };
}

/* ══════════════ Durable rate limiting (Postgres-backed) ══════════════
   The in-process limiter above is per-process and resets on deploy, so on a
   multi-instance / pm2-cluster deploy the real ceiling is (instances × limit) and
   a rolling restart wipes every window. That is fine for a single box but is the
   one thing standing between the pilot and running more than one instance
   (SCALABILITY.md / the launch brief). This backs the same fixed-window semantics
   with a shared `rate_limits` row so every instance increments ONE counter.

   The whole check is a single atomic INSERT ... ON CONFLICT DO UPDATE: concurrent
   requests (on any instance) serialize on the row, so the counter can't be raced.
     • window still open  → count = count + 1, reset_at unchanged
     • window elapsed     → count = 1, reset_at = now + window (fresh window)
   The `<= now()` comparison uses the DATABASE clock, so instances with skewed
   clocks still agree on when a window ends.

   Semantics match rateLimit(): exactly `limit` requests pass per window; request
   `limit + 1` is refused with retryAfter = seconds until reset. */
async function rateLimitDb(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const resetAt = new Date(Date.now() + windowMs);
  try {
    const [row] = await db
      .insert(rateLimits)
      .values({ key, count: 1, resetAt })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`case when ${rateLimits.resetAt} <= now() then 1 else ${rateLimits.count} + 1 end`,
          resetAt: sql`case when ${rateLimits.resetAt} <= now() then ${resetAt} else ${rateLimits.resetAt} end`,
        },
      })
      .returning({ count: rateLimits.count, resetAt: rateLimits.resetAt });

    const count = row?.count ?? 1;
    const resetMs = row?.resetAt ? new Date(row.resetAt).getTime() : resetAt.getTime();
    if (count > limit) return { ok: false, retryAfter: Math.max(1, Math.ceil((resetMs - Date.now()) / 1000)) };
    return { ok: true, retryAfter: 0 };
  } catch (e) {
    /* Fail OPEN to the in-process limiter, never closed. A Postgres outage already
       fails the surrounding action (every one of them hits the DB), so degrading to
       per-instance limiting here loses nothing — whereas failing closed would turn a
       transient limiter-write glitch into a total login/booking outage. The
       in-process counter still blocks the one-client-hammering-one-endpoint case. */
    console.error("[Tnajem] rate_limits upsert failed — falling back to in-process limiter", e);
    return rateLimit(key, limit, windowMs);
  }
}

/** The limiter server actions should call. Durable across instances when a DB is
    configured; in-process in dev/demo (single process, no DB to share). Async
    because the durable path is a DB round-trip — every caller is already async. */
export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  return dbReady ? rateLimitDb(key, limit, windowMs) : rateLimit(key, limit, windowMs);
}

/** Best-effort client IP for rate-limit keys. Spoofable via X-Forwarded-For unless the
    platform overwrites it (Vercel/Render do), so it is a throttle key — never an authz input. */
export function clientIp(): string {
  try {
    const h = headers();
    const fwd = h.get("x-forwarded-for") ?? "";
    const first = fwd.split(",")[0]?.trim();
    return first || h.get("x-real-ip")?.trim() || "unknown";
  } catch {
    return "unknown"; // headers() outside a request scope
  }
}

export function normalizePhone(raw: string): string {
  let p = (raw || "").replace(/[^\d+]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (!p.startsWith("+")) p = "+216" + p.replace(/^0+/, ""); // default Tunisia
  return p;
}
export function isValidPhone(p: string): boolean {
  const digits = p.replace(/\D/g, "").length;
  return digits >= 8 && digits <= 15; // E.164 upper bound
}
function hashCode(phone: string, code: string): string {
  // authSecret() throws in production when AUTH_SECRET is unset — the first login
  // attempt fails loudly rather than being served with the public dev default.
  return createHash("sha256").update(`${phone}:${code}:${authSecret()}`).digest("hex");
}
function safeEq(a: string, b: string): boolean {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Seconds the caller must wait before another code can be sent to this phone (0 = ok now).
    Derived from the existing row's age (created = expiresAt − TTL), so no schema change. */
export async function otpCooldownRemaining(phone: string): Promise<number> {
  const [row] = await db.select().from(otpCodes).where(eq(otpCodes.phone, phone)).limit(1);
  if (!row) return 0;
  const createdAtMs = new Date(row.expiresAt).getTime() - OTP_TTL_MIN * 60_000;
  const remainingMs = OTP_RESEND_COOLDOWN_MS - (Date.now() - createdAtMs);
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

/* Generate + store a one-time code for a phone.

   RACE (fixed): this used to be a bare `delete` followed by an `insert`. Two
   concurrent requestOtp() calls for the same phone could interleave as
   delete(A) → delete(B) → insert(A) → insert(B), leaving TWO live rows for the
   same phone. verifyOtpCode() then read one of them with an arbitrary `limit(1)`,
   so the code the user actually received was a coin-flip — and, worse, each row
   carried its own `attempts` counter, doubling the brute-force budget per phone.
   otp_codes has no unique index on `phone` (schema is owned elsewhere), so the DB
   cannot reject the second insert for us.

   Fix: serialize per phone with a transaction-scoped Postgres advisory lock and
   re-check the resend cooldown INSIDE the lock (the outer check in requestOtp is
   a fast path and is itself TOCTOU). One writer per phone at a time → exactly one
   live code row, always.

   Returns the plaintext code, or null when the cooldown is still running (the
   caller surfaces "too-soon"). */
export async function createOtp(phone: string): Promise<string | null> {
  const code = String(randomInt(100000, 1000000)); // CSPRNG — Math.random() is predictable
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000);

  return db.transaction(async (tx) => {
    // Serialize every writer for this phone. Released automatically at commit/rollback.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${phone}))`);

    const [existing] = await tx.select().from(otpCodes).where(eq(otpCodes.phone, phone)).limit(1);
    if (existing) {
      const createdMs = new Date(existing.expiresAt).getTime() - OTP_TTL_MIN * 60_000;
      if (Date.now() - createdMs < OTP_RESEND_COOLDOWN_MS) return null; // still cooling down
    }

    await tx.delete(otpCodes).where(eq(otpCodes.phone, phone));
    await tx.insert(otpCodes).values({ phone, codeHash: hashCode(phone, code), expiresAt });
    return code;
  });
}

/* Verify a code. The per-code attempt budget (MAX_ATTEMPTS) is the durable half of
   the brute-force defence; app/actions.ts adds a per-IP/per-phone throttle on top,
   because requesting a fresh code resets `attempts` and would otherwise hand an
   attacker an unlimited number of 5-shot rounds against a 6-digit space.

   Ordered by createdAt desc + delete-all-for-phone on success so a stray duplicate
   row (from data written before the fix above) can never keep a stale code alive. */
export async function verifyOtpCode(phone: string, code: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(otpCodes)
    .where(eq(otpCodes.phone, phone))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  if (!row) return false;
  if (new Date(row.expiresAt) < new Date()) return false;
  if ((row.attempts ?? 0) >= MAX_ATTEMPTS) return false;

  const ok = safeEq(row.codeHash, hashCode(phone, code));
  if (!ok) {
    // Increment in SQL, not from the value we read — two concurrent wrong guesses
    // would otherwise both write attempts = n+1 and only cost the attacker one try.
    await db
      .update(otpCodes)
      .set({ attempts: sql`coalesce(${otpCodes.attempts}, 0) + 1` })
      .where(eq(otpCodes.id, row.id));
    return false;
  }
  await db.delete(otpCodes).where(eq(otpCodes.phone, phone));
  return true;
}

export async function createSession(profileId: string, role?: string): Promise<void> {
  // Session fixation: a fresh 256-bit token is minted on every successful login and
  // the cookie is overwritten, so a token an attacker planted pre-login is never the
  // one that ends up authenticated.
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ token, profileId, expiresAt });

  // Opportunistic GC of this profile's expired rows — the sessions table otherwise
  // grows forever (every login on every device leaves a row behind). Best-effort:
  // a failed cleanup must not fail the login.
  try {
    await db.delete(sessions).where(and(eq(sessions.profileId, profileId), lt(sessions.expiresAt, new Date())));
  } catch (e) {
    console.error("[Tnajem] session cleanup failed", e);
  }

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  // Readable UI hint (see ROLE_HINT_COOKIE) — NOT httpOnly on purpose so the header
  // can read it without a network round-trip. Same lifetime as the session.
  if (role) {
    cookies().set(ROLE_HINT_COOKIE, role, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: expiresAt,
    });
  }
}

/** Read-only — safe in server components. Returns the signed-in profile or null. */
export async function getSession() {
  if (!dbReady) return null;
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ s: sessions, p: profiles })
    .from(sessions)
    .innerJoin(profiles, eq(sessions.profileId, profiles.id))
    .where(eq(sessions.token, token))
    .limit(1);
  if (!row) return null;
  if (new Date(row.s.expiresAt) < new Date()) {
    await db.delete(sessions).where(eq(sessions.token, token));
    return null;
  }
  return { profile: row.p };
}

export async function destroySession(): Promise<void> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token && dbReady) await db.delete(sessions).where(eq(sessions.token, token));
  cookies().delete(SESSION_COOKIE);
  cookies().delete(ROLE_HINT_COOKIE); // clear the UI hint too, or the header lags a logout
}

/* Demo mode (no DB): set a non-DB cookie so the route guard + flow still work.

   This is NOT a session and cannot be turned into one: getSession() short-circuits
   on `!dbReady`, and with a DB configured the literal string "demo" is not a valid
   session token (tokens are 64 hex chars from a random 32-byte draw), so it matches
   no row. Forging `tnajem_session=demo` therefore buys an attacker exactly what
   forging any other junk value buys: passage through middleware's presence check
   and nothing else. middleware.ts additionally rejects the literal value in prod. */
export function setDemoCookie(role?: string): void {
  if (process.env.NODE_ENV === "production") return; // never mint a demo cookie on a real deploy
  cookies().set(SESSION_COOKIE, "demo", {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // dev only (http://localhost)
    path: "/",
  });
  // Match the real login path so the header shows the right nav in demo mode too.
  if (role) cookies().set(ROLE_HINT_COOKIE, role, { httpOnly: false, sameSite: "lax", secure: false, path: "/" });
}
