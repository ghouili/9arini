import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@tnajem/shared/auth-core";

/* Profile-photo viewer (Step 13).

   A STREAMING PASS-THROUGH, like the ID-scan and material viewers, and for the
   same reason: THE DECISION LIVES IN apps/api. An approved photo on a public
   tutor is public; anything else is the owner's alone, and answering that needs
   the database. A second copy of the rule here would be a second access check to
   keep in sync.

   The cache-control comes from the API and is passed through VERBATIM, which
   matters more here than elsewhere: an approved photo is immutable at its URL
   (the timestamp is part of the path, so a replacement is a different URL) and
   should be cached hard, while a PENDING one must never be cached anywhere — it
   can be rejected a minute later. Re-deriving that here would eventually get one
   of the two wrong. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = process.env.API_URL ?? "http://127.0.0.1:4000";

const PASSTHROUGH_HEADERS = ["content-type", "cache-control", "x-content-type-options"];

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string; size: string } },
): Promise<Response> {
  const token = cookies().get(SESSION_COOKIE)?.value;

  const upstream = await fetch(
    `${API_URL}/tutors/${encodeURIComponent(params.slug)}/avatar/${encodeURIComponent(params.size)}`,
    {
      headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {},
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    },
  );

  const headers = new Headers();
  for (const h of PASSTHROUGH_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  /* Fills only what is MISSING. If the API ever forgot, an unreviewed face must
     not end up in a shared cache — so the fallback is the strict one. */
  if (!headers.has("cache-control")) headers.set("cache-control", "private, no-store");
  if (!headers.has("x-content-type-options")) headers.set("x-content-type-options", "nosniff");

  return new Response(upstream.body, { status: upstream.status, headers });
}
