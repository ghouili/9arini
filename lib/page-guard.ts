import "server-only";
import { getSession } from "./auth";
import { dbReady } from "./db";
import { isLocale, DEFAULT_LOCALE } from "./locale";
import type { AppLocale } from "./locale";

/* Session lookup for SERVER page guards.

   Role guards live in server components and server actions — never in
   middleware.ts. The edge cannot reach Postgres, and the only role-ish thing it
   can see is ROLE_HINT_COOKIE, which is documented as a forgeable display hint
   (lib/auth.ts). Putting a role check there would turn a deliberately
   non-authoritative cookie into an authorization input.

   THE `inert` CASE IS LOAD-BEARING, not a convenience. getSession() short-circuits
   to null whenever DATABASE_URL is unset, and the UI audit harness drives every
   logged-in screen with the dev sentinel `tnajem_session=demo` and no database
   (scripts/ui-audit/routes.mjs). A guard written as `if (!session) redirect(...)`
   would therefore bounce /onboarding, /onboarding/verify and /student/welcome out
   of `npm run ui:audit` and out of local demo mode entirely — the screens would
   stop being measured by the very harness that exists to measure them. Every
   action in app/actions.ts already degrades the same way (`if (!dbReady) return`);
   guards do too. */

export type SessionProfile = NonNullable<Awaited<ReturnType<typeof getSession>>>["profile"];

export type PageGuard =
  /** No DB — demo mode / the UI audit harness. Render the page; guards do not apply. */
  | { kind: "inert" }
  /** A database is configured but there is no valid session. */
  | { kind: "guest" }
  | { kind: "user"; profile: SessionProfile };

export async function pageGuard(): Promise<PageGuard> {
  if (!dbReady) return { kind: "inert" };
  const session = await getSession();
  return session ? { kind: "user", profile: session.profile } : { kind: "guest" };
}

/** Validate the `[locale]` route param. Server pages need it to build redirect
    targets, which are absolute paths and so must carry the locale themselves —
    components/Link.tsx's prefixing is a client-side convenience only. */
export function localeOf(raw: unknown): AppLocale {
  return isLocale(raw) ? raw : DEFAULT_LOCALE;
}

/** Locale-prefixed path for redirect(), optionally carrying a sanitised ?next=. */
export function localePath(locale: AppLocale, path: string, next?: string | null): string {
  const base = `/${locale}${path}`;
  return next ? `${base}?next=${encodeURIComponent(next)}` : base;
}
