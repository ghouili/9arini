import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale, localeFromPath, stripLocale, LOCALE_HEADER } from "@/lib/locale";
import { RESERVED_SLUGS } from "@tnajem/shared/validation";

/* Three jobs, in order:

   1. LOCALE ROUTING. Every page lives under /fr/… or /ar/… (app/[locale]/…). A
      request with no locale prefix is redirected to the preferred locale (the
      NEXT_LOCALE cookie set by the language toggle, else French). This is what puts
      the locale in the URL — visible to crawlers, and knowable server-side so the
      public pages can stay statically/ISR-rendered per locale.

   2. AUTH GUARD (presence only). Redirects to /<locale>/auth when the session cookie
      is absent on a protected route. Real validation happens server-side via
      getSession(); the edge only checks presence and never touches Postgres.

   3. UNKNOWN TUTOR SLUG → 404 STATUS. See tutorExists() below. */

const SESSION_COOKIE = "tnajem_session";

/* ── Why the 404 status is decided HERE and not in app/[locale]/[slug]/page.tsx ──
   A tutor pastes tnajem.tn/<slug> into WhatsApp; one wrong character used to
   land on a page that answered 200. On Next 14.2 a runtime notFound() in the page
   fails the server render and ships `<html id="__next_error__"><body/>` — an EMPTY
   body until the bundle arrives, which on 3G is a white screen. So the page keeps
   rendering <NotFoundScreen> inline (server HTML, both locales, no JS needed) and
   middleware — the one place that can still set the status — sets 404.

   The answer comes from app/api/tutor-exists/[slug], which reads the page's own
   unstable_cache entry: no extra database load, same invalidation. Only POSITIVE
   answers are memoised here, briefly: caching "does not exist" would 404 a tutor
   for up to the TTL right after an admin approves them — the exact moment they
   share their link. Any failure to get a clean answer passes the request through
   (a soft 404 on a dead link beats a hard 404 on a real tutor). */
const KNOWN_TUTOR_TTL_MS = 30_000;
const KNOWN_TUTOR_MAX = 5_000;
const knownTutors = new Map<string, number>(); // slug → expiry

function selfOrigin(req: NextRequest): string {
  if (process.env.NODE_ENV !== "production") return req.nextUrl.origin;
  /* Production sits behind nginx, where nextUrl.origin is the PUBLIC host — a
     lookup through it would leave the box and come back in. Ask the server
     directly. HOSTNAME is the bind address (Dockerfile: 0.0.0.0; standalone
     script: 127.0.0.1); a wildcard bind is reachable on loopback. */
  const host = process.env.HOSTNAME;
  const loopback = !host || host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
  return `http://${loopback}:${process.env.PORT || "3000"}`;
}

async function tutorExists(slug: string, req: NextRequest): Promise<boolean | null> {
  const until = knownTutors.get(slug);
  if (until !== undefined && until > Date.now()) return true;

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 2_000);
  try {
    const res = await fetch(`${selfOrigin(req)}/api/tutor-exists/${encodeURIComponent(slug)}`, {
      cache: "no-store",
      signal: abort.signal,
    });
    if (!res.ok) return null;
    const { exists } = (await res.json()) as { exists?: unknown };
    if (exists === true) {
      if (knownTutors.size >= KNOWN_TUTOR_MAX) knownTutors.clear();
      knownTutors.set(slug, Date.now() + KNOWN_TUTOR_TTL_MS);
      return true;
    }
    return exists === false ? false : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* Path prefixes (locale-stripped) that require a session. Mirrors the old matcher. */
const PROTECTED = ["/dashboard", "/onboarding", "/account", "/student", "/checkout", "/live", "/admin", "/messages", "/guardian"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const locale = localeFromPath(pathname);

  /* 1. No locale in the URL → serve the preferred one.

     THE ROOT IS REWRITTEN, NOT REDIRECTED. "tnajem.tn" is the URL people type,
     read out loud and print; a 307 there costs a whole extra round trip before
     the first byte of HTML — 0.5-1s on Tunisian 3G — on the single most common
     entry point in the product. A rewrite serves /<locale> under the typed URL
     with no extra hop.

     Deeper paths still REDIRECT, deliberately: "/explore" and "/fr/explore"
     would otherwise both serve the same page at two URLs, which splits ranking
     signals and duplicates the crawl. The canonical form is the prefixed one,
     and a redirect is how you say so. The root is the one place where the
     canonical URL is genuinely the unprefixed one — layout.tsx already points
     its canonical/hreflang at the prefixed variants. */
  if (!locale) {
    const cookieLoc = req.cookies.get("NEXT_LOCALE")?.value;
    const preferred = isLocale(cookieLoc) ? cookieLoc : DEFAULT_LOCALE;
    const url = req.nextUrl.clone();
    url.pathname = pathname === "/" ? `/${preferred}` : `/${preferred}${pathname}`;
    if (pathname === "/") {
      const headers = new Headers(req.headers);
      headers.set(LOCALE_HEADER, preferred);
      /* Vary: Cookie — the response body depends on NEXT_LOCALE, so a shared
         cache must not serve one visitor's language to the next. */
      const res = NextResponse.rewrite(url, { request: { headers } });
      res.headers.set("Vary", "Cookie");
      return res;
    }
    return NextResponse.redirect(url);
  }

  // 2. Auth guard, evaluated on the locale-stripped path.
  const bare = stripLocale(pathname);
  const isProtected = PROTECTED.some((p) => bare === p || bare.startsWith(`${p}/`));
  if (isProtected) {
    const raw = req.cookies.get(SESSION_COOKIE)?.value ?? "";
    // "demo" is the dev-mode sentinel (never a valid token, and forgeable) — don't
    // let it satisfy the presence check in production. Authorization itself never
    // trusts this cookie: every action re-reads the session from Postgres.
    const hasSession = Boolean(raw) && !(process.env.NODE_ENV === "production" && raw === "demo");
    if (!hasSession) {
      const url = req.nextUrl.clone();
      url.pathname = `/${locale}/auth`;
      // Carry the FULL destination (locale-prefixed path + query) so a guest bounced
      // off /fr/checkout?class=<id> resumes there after login.
      const next = `${pathname}${req.nextUrl.search}`;
      url.search = "";
      url.searchParams.set("next", next);
      return NextResponse.redirect(url);
    }
  }

  /* Expose the resolved locale to the server render.

     app/[locale]/not-found.tsx cannot read `params` (Next does not pass them to a
     not-found boundary) and it must stay a SERVER component — a client one is
     shipped as a module reference and resolved in the browser, so none of its
     markup reaches the HTML and every bad tutor link renders blank without JS.
     A request header is the one channel that reaches it. */
  const headers = new Headers(req.headers);
  headers.set(LOCALE_HEADER, locale);

  /* 3. One segment after the locale that is not a route is a tutor slug — every
     top-level route is in RESERVED_SLUGS (e2e/not-found.spec.ts enforces it). */
  const segment = bare.slice(1);
  if (segment && !segment.includes("/") && !RESERVED_SLUGS.includes(segment)) {
    let slug: string | null = null;
    try {
      slug = decodeURIComponent(segment);
    } catch {
      /* malformed escape — let the page handle it */
    }
    if (slug !== null && (await tutorExists(slug, req)) === false) {
      return NextResponse.next({ status: 404, request: { headers } });
    }
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  /* Run on everything EXCEPT: Next internals, API routes, and any path with a file
     extension (robots.txt, sitemap.xml, llms.txt, favicon.*, og.png, /_next/*).
     Tutor slugs never contain a dot, so no real page is excluded. */
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
