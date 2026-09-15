import { randomInt } from "node:crypto";
import { and, eq, otpCodes, sql as raw } from "@tnajem/db";
import {
  hashOtpCode,
  safeEq,
  MAX_ATTEMPTS,
  OTP_TTL_MIN,
  OTP_RESEND_COOLDOWN_MS,
} from "@tnajem/shared/auth-core";
import { db } from "../db";

/* The OTP row lifecycle, TRANSCRIBED from apps/web/lib/auth.ts — not rewritten.

   Every line below defends something specific, and the comments say what. When in
   doubt, diff this against the original rather than "improving" it. */

/** Seconds the caller must wait before another code can be sent to this identity
    (0 = ok now). Derived from the existing row's age (created = expiresAt − TTL),
    so no schema change was needed. */
export async function otpCooldownRemaining(identifier: string): Promise<number> {
  const [row] = await db.select().from(otpCodes).where(eq(otpCodes.identifier, identifier)).limit(1);
  if (!row) return 0;
  const createdAtMs = new Date(row.expiresAt).getTime() - OTP_TTL_MIN * 60_000;
  const remainingMs = OTP_RESEND_COOLDOWN_MS - (Date.now() - createdAtMs);
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

/** Mint a code, or null if one was minted for this identity too recently.

    THE ADVISORY LOCK IS INSIDE THE TRANSACTION and must stay there. It serialises
    every writer for one identity, so two concurrent requestOtp calls cannot both
    pass the cooldown check and leave two live codes — which would double the
    attacker's guessing budget for that identity. It is released automatically at
    commit or rollback.

    A note for Step 4 reviewers: the lock must never end up wrapped around a
    `fetch`. It has to be held by the same database transaction that does the
    delete+insert; holding a Postgres lock across a network call to another
    service is how you turn a 1ms critical section into a connection-pool outage. */
export async function createOtp(identifier: string): Promise<string | null> {
  const code = String(randomInt(100000, 1000000)); // CSPRNG — Math.random() is predictable
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000);

  return db.transaction(async (tx) => {
    await tx.execute(raw`select pg_advisory_xact_lock(hashtext(${identifier}))`);

    const [existing] = await tx
      .select()
      .from(otpCodes)
      .where(eq(otpCodes.identifier, identifier))
      .limit(1);
    if (existing) {
      const createdMs = new Date(existing.expiresAt).getTime() - OTP_TTL_MIN * 60_000;
      if (Date.now() - createdMs < OTP_RESEND_COOLDOWN_MS) return null; // still cooling down
    }

    await tx.delete(otpCodes).where(eq(otpCodes.identifier, identifier));
    await tx.insert(otpCodes).values({
      identifier,
      codeHash: hashOtpCode(identifier, code),
      expiresAt,
    });
    return code;
  });
}

/** Verify and CONSUME a code: true for exactly one caller, however many race.

    ── WHY IT IS TWO ATOMIC STATEMENTS ───────────────────────────────────────
    It used to read the row, compare, then update or delete. Under concurrency
    that was two holes (both measured by e2e/otp-race.spec.ts):
      • parallel CORRECT verifies all passed the read before the delete landed,
        so one code minted several sessions — and a first-time signup inserted
        the same profile twice and answered 500;
      • parallel WRONG guesses all read attempts < 5 before any increment
        landed, so the 5-guess budget did not bind a burst.

    1. RESERVE AN ATTEMPT in one UPDATE … WHERE attempts < MAX AND not expired.
       Concurrent updaters of the row queue on its lock and each re-checks the
       WHERE against the committed value, so at most MAX_ATTEMPTS reservations
       ever succeed — right guesses count too, as they always did.
    2. On a match, DELETE … RETURNING. Only the caller whose delete actually
       removed the row wins; a second correct guess finds nothing to delete. */
export async function verifyOtpCode(identifier: string, code: string): Promise<boolean> {
  const reserved = await db
    .update(otpCodes)
    .set({ attempts: raw`coalesce(${otpCodes.attempts}, 0) + 1` })
    .where(
      and(
        eq(otpCodes.identifier, identifier),
        raw`coalesce(${otpCodes.attempts}, 0) < ${MAX_ATTEMPTS}`,
        raw`${otpCodes.expiresAt} > now()`,
      ),
    )
    .returning({ id: otpCodes.id, codeHash: otpCodes.codeHash });

  const expected = hashOtpCode(identifier, code);
  const match = reserved.find((r) => safeEq(r.codeHash, expected));
  if (!match) return false;

  const consumed = await db
    .delete(otpCodes)
    .where(eq(otpCodes.identifier, identifier))
    .returning({ id: otpCodes.id });
  return consumed.some((r) => r.id === match.id);
}
