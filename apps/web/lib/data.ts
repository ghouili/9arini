import "server-only";
import { callAnonymous } from "./api";
import { demoFallback } from "./backend";
import { dbReady } from "@/lib/db";
import { demoEnabled, demoStorefront } from "@/lib/demo";
import type { Storefront, Tutor, ClassItem, Pack } from "@tnajem/shared";

/* ══════════════════════════════════════════════════════════════════════════════
   Server-side reads.

   Two modes, and only two:

     • DEVELOPMENT, no DATABASE_URL → demo fixtures (lib/demo.ts). Genuinely
       useful: the whole UI runs with zero setup.
     • PRODUCTION, no DATABASE_URL  → a hard error. NOT fixtures.

   The second rule is the important one. `dbReady` is false whenever DATABASE_URL
   is missing — including on a misconfigured deploy or after a rotated secret. The
   old code returned `demoStorefront` in that case *for any slug*, so a production
   boot without a DB would have served a fabricated "4.9★, 1,240 students,
   verified" tutor at every URL of the public site. Fabricating a verified tutor
   and their rating is a misrepresentation; a 500 is just an outage. We take the
   outage.

   Why throw instead of returning null: null makes app/[slug]/page.tsx call
   notFound(), and a site-wide 404 storm tells Google to deindex every real tutor
   page. A 5xx is the honest signal — "we are broken, come back" — and it is the
   one that gets us paged.
   ══════════════════════════════════════════════════════════════════════════════ */

/** True only when serving fixtures is allowed: dev, and no database configured. */
export const demoFallbackActive: boolean = !dbReady && demoEnabled;

/** Thrown when production boots without DATABASE_URL. Surfaces as app/error.tsx (500). */
export class DatabaseNotConfiguredError extends Error {
  constructor(op: string) {
    super(
      `[Tnajem] DATABASE_URL is not set — refusing to serve demo data from ${op} in production. ` +
        "Fix the deployment env; the demo fallback is development-only by design.",
    );
    this.name = "DatabaseNotConfiguredError";
  }
}

/** Single choke point for every "no DB" branch below. */
function assertNotProdWithoutDb(op: string): void {
  if (dbReady || demoEnabled) return;
  console.error(`[Tnajem] FATAL: ${op} called in production with no DATABASE_URL.`);
  throw new DatabaseNotConfiguredError(op);
}

const MONTHS_FR = ["JANV", "FÉVR", "MARS", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEPT", "OCT", "NOV", "DÉC"];
const initials = (name: string) => {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?";
};

export async function getStorefront(slug: string): Promise<Storefront | null> {
  if (demoFallback) {
    assertNotProdWithoutDb("getStorefront");   // prod + no DB → throw, never fabricate
    return demoStorefront;                     // dev only: any slug shows the demo storefront
  }

  /* PORTED to apps/api (GET /tutors/:slug/storefront).

     This is NOT a server action — it is a direct DB read feeding the ISR-cached
     storefront and the sitemap, which is exactly why GATE 4's grep
     (`grep -rn "from '@tnajem/db'" apps/web/app apps/web/components`) would have
     reported success while apps/web/lib still held a Postgres pool for the
     most-trafficked page in the product. Widen the gate to all of apps/web.

     callAnonymous, never call: [slug]/page.tsx reads this through unstable_cache
     (lib/cache.ts::getCachedStorefront), where cookies() throws, and outside that
     wrapper it would silently opt the route out of ISR. */
  return callAnonymous<Storefront | null>(`/tutors/${encodeURIComponent(slug)}/storefront`);
}

/** One public storefront, for app/sitemap.ts. */
export type PublicTutorRef = { slug: string; lastModified: Date };

/* Verified tutors only — exactly what getStorefront() will actually serve. A
   pending/rejected tutor 404s, so listing them would feed Google dead URLs.

   Never throws: the sitemap is generated at build time, and a build box without
   DATABASE_URL must still emit the static routes rather than fail the build. The
   caller degrades to the static list; it does NOT get fixtures (the demo slug is
   not a real page, and pointing a crawler at it would be exactly the fabrication
   the rest of this file exists to prevent). */
export async function getPublicTutorRefs(): Promise<PublicTutorRef[]> {
  if (demoFallback) return [];
  // PORTED to apps/api (GET /tutors/public-refs). Anonymous: it feeds the sitemap.
  const rows = await callAnonymous<{ slug: string; lastModified: string }[]>("/tutors/public-refs");
  return rows.map((r) => ({ slug: r.slug, lastModified: new Date(r.lastModified) }));
}

