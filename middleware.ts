import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/* Lightweight route guard: redirects to /auth when the session cookie is absent
   on protected (tutor/account) routes. Real session validation happens in the
   server actions / data layer via getSession(); middleware only checks presence
   (it runs on the edge and shouldn't touch Postgres). */
const SESSION_COOKIE = "9arini_session";

export function middleware(req: NextRequest) {
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding", "/account"],
};
