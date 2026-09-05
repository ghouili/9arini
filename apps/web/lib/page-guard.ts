import "server-only";
import { call } from "./api";
import { backendReady } from "./backend";
import { isLocale, DEFAULT_LOCALE } from "./locale";
import type { AppLocale } from "./locale";

/* Server-side page guards.

   THE `inert` CASE IS LOAD-BEARING, not a convenience. It is what lets `next
   build` prerender these pages and lets the ui-audit harness walk them with no
   backend: a guard written as `if (!session) redirect(...)` would send every
   build-time render to /auth and the page would never be captured.

   The session now comes from apps/api (GET /session), which returns the MINIMAL
   projection a guard needs — id, role, birthYear, fullName. No e-mail, no phone:
   a guard never needs contact details, and the cheapest way to keep PII off a
   surface is for it never to be in the response. */

export type SessionProfile = {
  id: string;
  role: string;
  birthYear: number | null;
  fullName: string | null;
};

export type PageGuard =
  /** No backend configured — build time, or the audit harness. */
  | { kind: "inert" }
  /** A backend is configured but there is no valid session. */
  | { kind: "guest" }
  | { kind: "user"; profile: SessionProfile };

export async function pageGuard(): Promise<PageGuard> {
  if (!backendReady) return { kind: "inert" };
  try {
    const profile = await call<SessionProfile | null>("/session", undefined, "GET");
    return profile ? { kind: "user", profile } : { kind: "guest" };
  } catch {
    /* The API is unreachable. Treat it as INERT rather than guest: bouncing a
       signed-in user to /auth because the backend blinked would look like being
       logged out, and they would then fail to log in too. Inert renders the page
       in its neutral state. */
    return { kind: "inert" };
  }
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
