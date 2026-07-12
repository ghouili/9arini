import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/* Lightweight route guard: redirects to /auth when the session cookie is absent
   on protected (tutor/account) routes. Real session validation happens in the
   server actions / data layer via getSession(); middleware only checks presence
   (it runs on the edge and shouldn't touch Postgres). */
const SESSION_COOKIE = "9arini_session";

export function middleware(req: NextRequest) {
  const raw = req.cookies.get(SESSION_COOKIE)?.value ?? "";
  // "demo" is the dev-mode sentinel (lib/auth.ts::setDemoCookie). It is never a
  // valid session token — real tokens are 64 hex chars — but it is trivially
  // forgeable, so don't even let it satisfy the presence check on a real deploy.
  // (Authorization itself never trusts this cookie's value: every action re-reads
  // the session from Postgres via getSession(). This is defence in depth.)
  const hasSession = Boolean(raw) && !(process.env.NODE_ENV === "production" && raw === "demo");
  if (!hasSession) {
    // Carry the FULL destination (path + query), not just the pathname: a guest
    // bounced off /checkout?class=<id> must come back to that class, otherwise
    // they land on a checkout with no class and see "Séance introuvable".
    // /auth re-validates this with safeNext() before following it.
    const next = `${req.nextUrl.pathname}${req.nextUrl.search}`;
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    url.search = ""; // drop the original query (?class=…) before adding ?next=
    url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Everything behind a login: the tutor's back-office, the student's own
  // classes, the booking flow, the live room and the admin console.
  // (/live and /admin stay double-gated server-side — canJoinClass() and
  // ADMIN_PHONES — the middleware only stops the page rendering to anonymous users.)
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/account",
    "/student",
    "/checkout",
    "/live/:path*",
    "/admin/:path*",
  ],
};
