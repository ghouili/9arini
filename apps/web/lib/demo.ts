import type { Storefront, ClassItem, Pack } from "@tnajem/shared";

/* ══════════════════════════════════════════════════════════════════════════════
   Demo data — the zero-backend fallback. DEVELOPMENT ONLY.

   ⚠️  HARD RULE: nothing in this file may ever reach a production response.

   Why: these fixtures describe a *verified* tutor with a 4.9★ rating and 1,240
   students. None of that is real. The old contract was "fixtures are safe because
   the backend is always configured in prod" — which is a deployment assumption, not a
   guarantee. A rotated secret, a typo'd env var or a fresh box with a missing
   .env.local flips `dbReady` to false in production, and the fallback would then
   serve that fake 4.9★ tutor at every URL on the public site. That is a
   misrepresentation of a real business, not a graceful degradation.

   So the gate is the environment, not the database:

     • `demoEnabled === false` in production → every export below is INERT
       (empty arrays; a zeroed, unverified, unrated storefront). Even if a caller
       forgets to check the flag, there is no fabricated rating, no fake student
       count and no verified badge in the production bundle to leak.
     • Callers must ALSO branch on `demoEnabled` and render an honest error/empty
       state in production instead of the fixtures — see lib/data.ts::getStorefront,
       which throws DatabaseNotConfiguredError rather than inventing a tutor.

   Importers:
     • demoClasses    → app/actions.ts (getClass fallback), demoStorefront
     • demoPacks      → demoStorefront
     • demoStorefront → lib/data.ts (getStorefront fallback), app/explore/page.tsx
     • demoEnabled    → the gate. Import this next to any of the above.

   NOTE: process.env.NODE_ENV is statically inlined by Next in both the server and
   the client bundle, so `demoEnabled` is a build-time constant and the fixture
   bodies below are dead-code-eliminated from a production build.

   The dashboard/student fixtures that used to live here (demoTutorStatsEarning,
   demoTutorStatsEmpty, demoStudentBookings, demoStudentUpcoming, demoStudentPast)
   are GONE: those surfaces now read real data, and the fake "1240 TND balance /
   48 students" numbers were a liability the moment a real tutor could see them.
   ══════════════════════════════════════════════════════════════════════════════ */

/** The single gate. False in production — no fixture may be served to a real user. */
export const demoEnabled: boolean = process.env.NODE_ENV !== "production";

const devClasses: ClassItem[] = [
  { id: "c1", tutor_id: "yassine", tutor_name: "Yassine Khelifi", title: "Intégrales — révision express", description: "Méthodes + annales. On fait 3 exercices types ensemble.", day: "23", month: "JUIN", time: "18:00", duration_min: 90, price_tnd: 15, seats: 20, seats_left: 8, is_free_first: true, status: "scheduled", meet_url: "https://meet.jit.si/tnajem-c1", whiteboard_url: "https://bitpaper.io/", quiz_url: "https://www.wooclap.com/" },
  { id: "c2", tutor_id: "yassine", tutor_name: "Yassine Khelifi", title: "Annales Bac 2025 corrigées", description: "Correction guidée des sujets 2025.", day: "25", month: "JUIN", time: "17:00", duration_min: 120, price_tnd: 20, seats: 20, seats_left: 12, is_free_first: false, status: "scheduled", meet_url: "https://meet.jit.si/tnajem-c2" },
];

const devPacks: Pack[] = [
  { id: "p1", tutor_id: "yassine", title: "Pack révision : Dérivées & Limites", meta: "42 pages · 6 vidéos", price_tnd: 8, kind: "pdf" },
];

const devStorefront: Storefront = {
  tutor: {
    id: "yassine", slug: "yassine-math", full_name: "Yassine Khelifi",
    subject: "Prof de Maths · Bac", level: "Bac",
    bio: "« Spécialiste révisions Bac. On révise les dérivées, intégrales et annales — en darija, à ton rythme. 1ère séance offerte. »",
    avatar_initials: "YK", rating: 4.9, students_count: 1240, verified: true,
    // The dev fixture opts IN, so the audit harness can still walk the badge and
    // the "free" checkout copy. It is dev-only by construction (demoEnabled).
    offers_free_first_session: true,
    // No fixture photo: the demo tutor is not a real person and must not wear a
    // real face. The monogram is the honest render.
    has_photo: false,
  },
  classes: devClasses,
  packs: devPacks,
};

/* The production value. Deliberately empty and unverified: if a code path we
   missed ever renders it on a real deploy, it degrades to a visibly-broken blank
   — which we can see and fix — instead of a convincing lie about a tutor who
   does not exist. Loud failure over silent fabrication. */
const inertStorefront: Storefront = {
  tutor: {
    id: "", slug: "", full_name: "", subject: "", level: "",
    bio: "", avatar_initials: "", rating: 0, students_count: 0, verified: false,
    // FALSE in the inert value, like every other field: if a missed code path ever
    // renders this on a real deploy it must not promise a free session.
    offers_free_first_session: false,
    has_photo: false,
  },
  classes: [],
  packs: [],
};

export const demoClasses: ClassItem[] = demoEnabled ? devClasses : [];
export const demoPacks: Pack[] = demoEnabled ? devPacks : [];
export const demoStorefront: Storefront = demoEnabled ? devStorefront : inertStorefront;
