/* Mint a real session row and hand Playwright the cookie.

   This is the pattern scripts/ui-audit/routes.mjs already proved in this repo.
   It survives the web/api split completely, and for a specific reason: sessions
   are OPAQUE random tokens validated by a Postgres join, with no signing
   (lib/auth.ts createSession/getSession). So the Fastify API will validate the
   exact same row this test wrote. If sessions were signed JWTs, the suite would
   need the key and a rotation story mid-refactor.

   The cookie NAME is written out literally on purpose. If someone renames
   tnajem_session, these tests SHOULD fail — that is a behaviour change, which is
   exactly what this suite exists to catch. Never import it from app code. */
import { randomBytes } from "node:crypto";
import type { BrowserContext } from "@playwright/test";
import { sql } from "./db";
import { BASE_URL } from "./env";

export const SESSION_COOKIE = "tnajem_session";

export async function mintSession(profileId: string, days = 1): Promise<string> {
  const token = randomBytes(32).toString("hex"); // matches lib/auth.ts exactly
  await sql`insert into sessions (token, profile_id, expires_at)
            values (${token}, ${profileId}, now() + (${days} * interval '1 day'))`;
  return token;
}

export function sessionCookie(token: string, baseURL = BASE_URL) {
  const u = new URL(baseURL);
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(u.hostname);
  return {
    name: SESSION_COOKIE,
    value: token,
    domain: u.hostname,
    path: "/",
    expires: Math.floor(Date.now() / 1000) + 86_400,
    httpOnly: true,
    sameSite: "Lax" as const,
    /* createSession sets secure:true whenever NODE_ENV==="production", and the
       suite runs against a PRODUCTION build. Chromium treats localhost as a
       trustworthy origin so a Secure cookie is still stored and sent there. Get
       this wrong and the browser silently drops the cookie: every authenticated
       spec then redirects to /auth with no useful error. */
    secure: u.protocol === "https:" || isLocal,
  };
}

export async function loginAs(ctx: BrowserContext, profileId: string): Promise<void> {
  await ctx.addCookies([sessionCookie(await mintSession(profileId))]);
}
