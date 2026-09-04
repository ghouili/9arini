import { randomInt } from "node:crypto";
import { desc, eq, otpCodes, sql as raw } from "@tnajem/db";
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

/** Verify and CONSUME a code. Deletes the row on success, so a code is single-use. */
export async function verifyOtpCode(identifier: string, code: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(otpCodes)
    .where(eq(otpCodes.identifier, identifier))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  if (!row) return false;
  if (new Date(row.expiresAt) < new Date()) return false;
  if ((row.attempts ?? 0) >= MAX_ATTEMPTS) return false;

  const ok = safeEq(row.codeHash, hashOtpCode(identifier, code));
  if (!ok) {
    /* Increment in SQL, not from the value we read. Two concurrent wrong guesses
       would otherwise both write attempts = n+1 and only cost the attacker one
       try against a 5-guess budget. */
    await db
      .update(otpCodes)
      .set({ attempts: raw`coalesce(${otpCodes.attempts}, 0) + 1` })
      .where(eq(otpCodes.id, row.id));
    return false;
  }
  await db.delete(otpCodes).where(eq(otpCodes.identifier, identifier));
  return true;
}
