/* Locale routing helpers (URL-based i18n: /fr/… and /ar/…).

   Locale moved OUT of client localStorage and INTO the URL path so it is visible to
   crawlers (hreflang, per-locale indexing) and knowable server-side — which lets the
   public pages stay statically/ISR-rendered per locale instead of every component
   being a client component reading localStorage. Pure module: safe on server + client. */

export const LOCALES = ["fr", "ar"] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "fr";

/** Direction for the <html dir> attribute. Arabic is RTL. */
export function dir(locale: AppLocale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function isLocale(v: unknown): v is AppLocale {
  return v === "fr" || v === "ar";
}

/** The locale a path starts with, or null. "/fr/explore" → "fr", "/explore" → null. */
export function localeFromPath(pathname: string): AppLocale | null {
  const seg = pathname.split("/")[1];
  return isLocale(seg) ? seg : null;
}

/** Strip a leading locale segment. "/fr/explore" → "/explore", "/fr" → "/", "/x" → "/x". */
export function stripLocale(pathname: string): string {
  const seg = pathname.split("/")[1];
  if (!isLocale(seg)) return pathname;
  const rest = pathname.slice(1 + seg.length); // drop "/fr" | "/ar"
  return rest === "" ? "/" : rest;
}

/** Prefix a same-origin path with a locale. External URLs, anchors, mailto:, and
    already-prefixed paths pass through untouched.
      "/explore" + fr → "/fr/explore" · "/" + ar → "/ar" · "/fr/x" → "/fr/x" */
export function withLocale(path: string, locale: AppLocale): string {
  if (typeof path !== "string" || !path.startsWith("/")) return path; // external / #anchor / relative
  if (path.startsWith("//")) return path;                             // protocol-relative
  if (localeFromPath(path)) return path;                              // already prefixed
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** Swap the locale prefix on a path, preserving the rest. Used by the language toggle. */
export function swapLocale(pathname: string, to: AppLocale): string {
  return withLocale(stripLocale(pathname), to);
}
