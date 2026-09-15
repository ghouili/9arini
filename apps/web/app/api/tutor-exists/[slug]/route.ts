import { NextResponse } from "next/server";
import { getCachedStorefront } from "@/lib/cache";

/* Does this slug serve a public storefront? Asked by proxy.ts, which cannot
   read the data layer itself (edge runtime), so that an unknown slug is answered
   with a real 404 status while the page still renders <NotFoundScreen> in the
   server HTML.

   It reads through getCachedStorefront — the SAME unstable_cache entry the page
   uses, invalidated by the same revalidateTutor(slug) — so it adds no database
   load and can never disagree with the page for longer than the page's own TTL.

   A lookup failure is a 503, never "does not exist": middleware passes the
   request through on anything but a clean answer, because 404-ing a real tutor
   during an API blip is worse than a soft 404 on a dead link. */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const data = await getCachedStorefront(params.slug);
    return NextResponse.json({ exists: data !== null }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ exists: null }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
