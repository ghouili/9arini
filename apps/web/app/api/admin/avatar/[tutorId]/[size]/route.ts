import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@tnajem/shared/auth-core";

/* A PENDING profile photo, for the admin reviewing it (/admin/moderation).

   A streaming pass-through like the other viewers: apps/api decides (requireAdmin)
   and sets the headers, including private, no-store — the photo may be rejected a
   minute later. This route makes no access decision of its own. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = process.env.API_URL ?? "http://127.0.0.1:4000";
const PASSTHROUGH_HEADERS = ["content-type", "cache-control", "x-content-type-options"];

export async function GET(_req: NextRequest, props: { params: Promise<{ tutorId: string; size: string }> }): Promise<Response> {
  const params = await props.params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const upstream = await fetch(
    `${API_URL}/admin/avatars/${encodeURIComponent(params.tutorId)}/${encodeURIComponent(params.size)}`,
    { headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {}, cache: "no-store", signal: AbortSignal.timeout(15_000) },
  );
  const headers = new Headers();
  for (const h of PASSTHROUGH_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has("cache-control")) headers.set("cache-control", "private, no-store");
  if (!headers.has("x-content-type-options")) headers.set("x-content-type-options", "nosniff");
  return new Response(upstream.body, { status: upstream.status, headers });
}
