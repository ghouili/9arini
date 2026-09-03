/* Recover the plaintext OTP for an identifier.

   otp_codes stores sha256(`${identifier}:${code}:${AUTH_SECRET}`) — not
   reversible. But the code space is 10^6 and the test knows AUTH_SECRET, so the
   preimage is ~1s of hashing on Node 22.

   Why this and not the alternatives:
     - The on-screen dev code is NOT available: requestOtp only returns devCode
       when mailEnabled() is false, and MAIL_* are all set in .env, so it sends a
       real e-mail instead.
     - A test-only endpoint would be application code whose only purpose is to
       weaken auth, on a product that stores national ID scans. No.

   Needs ZERO production changes, works identically against Next and against the
   Fastify API (both write the same row), and fails loudly if the hash
   construction ever changes — which is correct, that IS a behaviour change. */
import { createHash } from "node:crypto";
import { sql } from "./db";
import { AUTH_SECRET } from "./env";

export async function recoverOtp(identifier: string): Promise<string> {
  const [row] = await sql<{ code_hash: string }[]>`
    select code_hash from otp_codes
    where identifier = ${identifier} order by created_at desc limit 1`;
  if (!row) throw new Error(`E2E: no otp_codes row for ${identifier}`);
  if (!AUTH_SECRET) throw new Error("E2E: AUTH_SECRET is not set");

  for (let n = 0; n < 1_000_000; n++) {
    const code = String(n).padStart(6, "0");
    const h = createHash("sha256").update(`${identifier}:${code}:${AUTH_SECRET}`).digest("hex");
    if (h === row.code_hash) return code;
  }
  throw new Error(`E2E: could not recover the OTP for ${identifier} — has the hash changed?`);
}

/** The Postgres-backed limiter persists across runs and server restarts. Without
    this, run 2 of the day fails in a way that looks like an application bug. */
export async function resetRateLimits(): Promise<void> {
  await sql`delete from rate_limits`;
}
