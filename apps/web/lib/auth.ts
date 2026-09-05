import "server-only";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  ROLE_HINT_COOKIE,
  SESSION_DAYS,
  OTP_RESEND_COOLDOWN_SEC,
  OTP_TTL_SEC,
  warnIfSecretMissing,
} from "@tnajem/shared/auth-core";

/* COOKIES ONLY.

   Everything that decides identity — the OTP lifecycle, the session row, the rate
   limiter, the admin allowlist — now lives in apps/api. What is left here is the
   half the API cannot do: writing a cookie on the BROWSER. apps/api is talking to
   this server, not to the user's browser, so it returns the token it minted and
   this file sets it.

   That is the whole reason this module still exists. It holds no database handle,
   builds no query, and hashes nothing.

   The constants and the OTP hash live in @tnajem/shared/auth-core so both
   processes agree byte for byte; they are re-exported here so no call site had to
   move during the port. */

export { SESSION_COOKIE, ROLE_HINT_COOKIE, OTP_RESEND_COOLDOWN_SEC, OTP_TTL_SEC };
export type { OtpChannel } from "@tnajem/shared/auth-core";
export { otpChannel } from "@tnajem/shared/auth-core";
export {
  normalizeEmail,
  normalizePhone,
  isValidPhone,
  isValidEmail,
} from "@tnajem/shared";

warnIfSecretMissing();

/* NON-SENSITIVE UI hint, readable by the client. It lets <SiteHeader> render the
   right nav link WITHOUT a getMe() round-trip on every page load — the request
   that made every perfectly-cached page drag an uncacheable call behind it.

   It is NOT a credential: readable, forgeable, holds only the coarse role, and
   only ever decides which link renders. Every server-side check re-derives
   identity from the httpOnly session cookie, so forging this buys nothing but a
   nav link that bounces you to /auth. The API never sees it. */
export function setRoleHint(role: string, expires?: Date): void {
  cookies().set(ROLE_HINT_COOKIE, role, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expires ?? new Date(Date.now() + SESSION_DAYS * 86_400_000),
  });
}

/** Adopt a session apps/api just minted.

    The attributes below are the ONLY definition of this cookie on the web side.
    A second writer with a different sameSite, path or secure would produce two
    cookies with one name and an intermittently logged-out user — miserable to
    diagnose, so there is exactly one. */
export function adoptSession(token: string, expiresAt: Date, role?: string): void {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  if (role) setRoleHint(role, expiresAt);
}

/** Clear both cookies. The API deletes the session ROW; this is the other half.
    Both matter: a cleared cookie with a live row leaves anyone holding the token
    signed in, and a deleted row with a live cookie keeps the browser sending a
    token that no longer resolves. */
export async function destroySession(): Promise<void> {
  cookies().delete(SESSION_COOKIE);
  cookies().delete(ROLE_HINT_COOKIE);
}

/* Demo mode only, and it refuses to run in production. The sentinel is not a
   session: apps/api matches it against the sessions table and finds nothing. It
   exists so the ui-audit harness can walk signed-in screens with no backend. */
export function setDemoCookie(role?: string): void {
  if (process.env.NODE_ENV === "production") return;
  cookies().set(SESSION_COOKIE, "demo", {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    expires: new Date(Date.now() + SESSION_DAYS * 86_400_000),
  });
  if (role) setRoleHint(role);
}
