import { randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { and, eq, gt, lt, profiles, sessions } from "@tnajem/db";
import { SESSION_COOKIE, SESSION_DAYS } from "@tnajem/shared/auth-core";
import { db } from "../db";
import { COOKIE_DOMAIN, IS_PROD } from "../env";

/* Sessions, ported from apps/web/lib/auth.ts.

   THERE IS NO SIGNING, and that is not an omission — it is what makes the Step 4
   port incremental. A session token is 256 bits of randomness stored in the
   `sessions` table and validated by a join on every request. So while some actions
   still run in Next and others already run here, BOTH processes validate the exact
   same row and agree on identity with nothing shared but Postgres.

   Had sessions been signed JWTs, an incremental port would need the signing key in
   both processes plus a key-rotation story in the middle of a refactor. Someone
   will eventually propose "improving" this to JWTs; the cost is that the migration
   stops being incremental, and JWT-in-localStorage would additionally be
   XSS-readable, which is strictly worse than an httpOnly cookie. */

export type SessionProfile = {
  id: string;
  role: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  birthYear: number | null;
  locale: string | null;
};

export type Session = { token: string; profile: SessionProfile };

export async function createSession(profileId: string): Promise<{ token: string; expiresAt: Date }> {
  /* Session fixation: a fresh 256-bit token is minted on every successful login
     and the cookie is overwritten, so a token an attacker planted pre-login is
     never the one that ends up authenticated. */
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ token, profileId, expiresAt });

  /* Opportunistic GC of this profile's expired rows — the sessions table
     otherwise grows forever (every login on every device leaves a row behind).
     Best-effort: a failed cleanup must not fail the login. */
  try {
    await db
      .delete(sessions)
      .where(and(eq(sessions.profileId, profileId), lt(sessions.expiresAt, new Date())));
  } catch (e) {
    console.error("[tnajem-api] session cleanup failed", e);
  }

  return { token, expiresAt };
}

/** Resolve the caller's session, or null. One join, on every authenticated request. */
export async function getSession(req: FastifyRequest): Promise<Session | null> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;

  const [row] = await db
    .select({
      token: sessions.token,
      id: profiles.id,
      role: profiles.role,
      fullName: profiles.fullName,
      email: profiles.email,
      phone: profiles.phone,
      birthYear: profiles.birthYear,
      locale: profiles.locale,
    })
    .from(sessions)
    .innerJoin(profiles, eq(profiles.id, sessions.profileId))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!row) return null;
  return {
    token: row.token,
    profile: {
      id: row.id,
      role: row.role,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      birthYear: row.birthYear,
      locale: row.locale,
    },
  };
}

export async function destroySession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}

/* Cookie options, byte-identical to apps/web's createSession. Kept in ONE place
   so the two processes cannot set subtly different attributes for the same
   cookie name — a mismatch on sameSite or path produces two cookies and an
   intermittently-logged-out user. */
export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: IS_PROD,
    path: "/",
    expires: expiresAt,
    /* Scoped to .tnajem.tn in production so tnajem.tn and api.tnajem.tn share it.
       Unset in dev — both are localhost, where a domain attribute breaks it. */
    domain: COOKIE_DOMAIN,
  };
}

export function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
  reply.setCookie(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: "/", domain: COOKIE_DOMAIN });
}
