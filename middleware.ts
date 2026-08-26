import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale, localeFromPath, stripLocale, LOCALE_HEADER } from "@/lib/locale";

/* Two jobs, in order:

   1. LOCALE ROUTING. Every page lives under /fr/… or /ar/… (app/[locale]/…). A
      request with no locale prefix is redirected to the preferred locale (the
      NEXT_LOCALE cookie set by the language toggle, else French). This is what puts
      the locale in the URL — visible to crawlers, and knowable server-side so the
      public pages can stay statically/ISR-rendered per locale.

   2. AUTH GUARD (presence only). Redirects to /<locale>/auth when the session cookie
      is absent on a protected route. Real validation happens server-side via
      getSession(); the edge only checks presence and never touches Postgres. */

const SESSION_COOKIE = "9arini_session";

/* Path prefixes (locale-stripped) that require a session. Mirrors the old matcher. */
const PROTECTED = ["/dashboard", "/onboarding", "/account", "/student", "/checkout", "/live", "/admin"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const locale = localeFromPath(pathname);

  /* 1. No locale in the URL → serve the preferred one.

     THE ROOT IS REWRITTEN, NOT REDIRECTED. "9arini.tn" is the URL people type,
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
  return NextResponse.next({ request: { headers } });
}

export const config = {
  /* Run on everything EXCEPT: Next internals, API routes, and any path with a file
     extension (robots.txt, sitemap.xml, llms.txt, favicon.*, og.png, /_next/*).
     Tutor slugs never contain a dot, so no real page is excluded. */
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
