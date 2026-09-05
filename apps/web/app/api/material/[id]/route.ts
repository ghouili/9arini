import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@tnajem/shared/auth-core";

/* Viewer for a teaching material (Step 10).

   A STREAMING PASS-THROUGH, shaped exactly like app/api/admin/doc/[id] and for
   the same reason: THE AUTHORISATION LIVES IN apps/api. This handler makes NO
   access decision of its own — it forwards the session cookie and returns
   whatever the API decides, including the 403 and the 404.

   That matters more here than it looks. The rule is "public / a student with a
   live booking / the tutor", and it needs a database to answer. A second copy of
   it in this file would be a second implementation of an access check, and this
   codebase has been bitten three separate times by two copies of a rule that
   nothing forced to agree. There is one canRead(), in routes/materials.ts.

   NOT a static file under public/, for the same reason: a static directory cannot
   ask whether the person asking booked the class. */

export const runtime = "nodejs";        // needs a real fetch to the API
export const dynamic = "force-dynamic"; // never cached or prerendered

const API_URL = process.env.API_URL ?? "http://127.0.0.1:4000";

const PASSTHROUGH_HEADERS = [
  "content-type",
  "content-disposition",
  "content-security-policy",
  "x-content-type-options",
  "cache-control",
  "referrer-policy",
];

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
): Promise<Response> {
  const token = cookies().get(SESSION_COOKIE)?.value;

  const upstream = await fetch(`${API_URL}/materials/${encodeURIComponent(params.id)}/file`, {
    headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {},
    cache: "no-store",
    // A worksheet is up to 8 MB over a Tunisian 3G link.
    signal: AbortSignal.timeout(60_000),
  });

  const headers = new Headers();
  for (const h of PASSTHROUGH_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  /* Belt and braces. If the API ever forgot one of these, a students-only file
     must still not be cached by a shared proxy or content-sniffed by a browser.
     Only fills what is MISSING — never overrides what the API decided. */
  if (!headers.has("cache-control")) headers.set("cache-control", "private, no-store, max-age=0");
  if (!headers.has("x-content-type-options")) headers.set("x-content-type-options", "nosniff");

  return new Response(upstream.body, { status: upstream.status, headers });
}
