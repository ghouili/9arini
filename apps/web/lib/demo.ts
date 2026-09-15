import type { Storefront, ClassItem } from "@tnajem/shared";
import { devClasses, devStorefronts } from "./demo-fixtures";

/* ══════════════════════════════════════════════════════════════════════════════
   Demo data — OPT-IN (TNAJEM_DEMO=1), DEVELOPMENT ONLY, and announced by
   components/DemoBanner on every page while it is on.

   ⚠️  HARD RULE: nothing in this file may ever reach a production response.

   Why: these fixtures describe *verified* tutors who do not exist. The old contract
   was "fixtures are safe because the backend is always configured in prod" — which
   is a deployment assumption, not a guarantee. A rotated secret, a typo'd env var
   or a fresh box with a missing .env.local flips `dbReady` to false in production,
   and the fallback would then serve an invented tutor at every URL on the public
   site. That is a misrepresentation of a real business, not a graceful degradation.

   NO SOCIAL PROOF, EVEN IN DEV. The Yassine fixture used to carry a 4.9 rating and
   1,240 students, and the /explore preview added "37 avis" — and the 14 Sept review
   found them rendering. Every demo tutor is rated 0 with 0 students, so every one is
   "Nouveau". Do not put numbers back to make a demo look busier: a screenshot of dev
   is exactly how an invented figure ends up in a pitch deck or a store listing.

   So the gate is the environment, not the database:

     • `demoEnabled === false` in production → every export below is INERT
       (empty lists, null storefronts). Even if a caller forgets to check the
       flag, there is no invented tutor in the production bundle to leak.
     • Callers must ALSO branch on `demoEnabled` and render an honest error/empty
       state in production instead of the fixtures — see lib/data.ts::getStorefront,
       which throws DatabaseNotConfiguredError rather than inventing a tutor.

   Importers:
     • demoClasses()  → app/actions.ts (getClass fallback)
     • demoStorefrontFor → lib/data.ts (getStorefront fallback, per slug)
     • demoStorefrontList → components/explore/ExploreClient.tsx (demo preview cards)
     • demoEnabled    → the gate. Import this next to any of the above.

   NOTE: process.env.NODE_ENV and TNAJEM_DEMO_ACTIVE (next.config.mjs `env`) are
   statically inlined by Next in both the server and the client bundle, so
   `demoEnabled` is a build-time constant. That alone did NOT keep the fixtures out
   of the bundle — this comment used to claim dead-code elimination, and the
   production build still carried every fixture. The fixtures now live in
   lib/demo-fixtures.ts, which next.config.mjs replaces with an empty stub in every
   production build, so there is nothing to eliminate.

   The dashboard/student fixtures that used to live here (demoTutorStatsEarning,
   demoTutorStatsEmpty, demoStudentBookings, demoStudentUpcoming, demoStudentPast)
   are GONE: those surfaces now read real data, and the fake "1240 TND balance /
   48 students" numbers were a liability the moment a real tutor could see them.
   ══════════════════════════════════════════════════════════════════════════════ */

/** The single gate. True only when demo mode was explicitly requested in development
    with no API configured (next.config.mjs computes it; scripts/preflight.mjs refuses
    to start in any ambiguous state). Always false in production. */
export const demoEnabled: boolean =
  process.env.NODE_ENV !== "production" && process.env.TNAJEM_DEMO_ACTIVE === "1";

/** The demo classes, dated from now. Empty in production. */
export function demoClasses(): ClassItem[] {
  return demoEnabled ? devClasses() : [];
}

/** Every demo storefront, for the /explore preview — the cards are built FROM these, so a
    card can never describe a tutor differently from that tutor's own demo page. */
export function demoStorefrontList(): Storefront[] {
  return demoEnabled ? Object.values(devStorefronts()) : [];
}

/** The demo storefront for one slug, or null — never another tutor's page. Always null in production. */
export function demoStorefrontFor(slug: string): Storefront | null {
  if (!demoEnabled) return null;
  const all = devStorefronts();
  return Object.prototype.hasOwnProperty.call(all, slug) ? all[slug] : null;
}
