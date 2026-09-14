import { MONTHS_FR, type Storefront, type ClassItem, type Pack } from "@tnajem/shared";

/* ══════════════════════════════════════════════════════════════════════════════
   Demo data — the zero-backend fallback. DEVELOPMENT ONLY.

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

/* DATED FROM NOW, ON EVERY CALL. The classes used to be the strings "23 JUIN ·
   18:00" and "25 JUIN · 17:00" — fixed display text with no date behind it — so
   by September the demo storefront was selling June's classes as "Prochaine
   séance". They are now built relative to the moment they are read (the same
   +2 days 18:00 / +4 days 17:00 as packages/db/src/seed.ts) and can never
   expire. A module-level constant would freeze the dates at server start. */
function at(daysFromNow: number, hour: number, minute: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** Display strings derived exactly like the API derives them (apps/api/src/lib/storefront.ts). */
function when(d: Date): Pick<ClassItem, "starts_at" | "day" | "month" | "time"> {
  return {
    starts_at: d.toISOString(),
    day: String(d.getDate()),
    month: MONTHS_FR[d.getMonth()],
    time: d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
  };
}

const devClasses = (): ClassItem[] => [
  { id: "c1", tutor_id: "yassine", tutor_name: "Yassine Khelifi", title: "Intégrales — révision express", description: "Méthodes + annales. On fait 3 exercices types ensemble.", ...when(at(2, 18, 0)), duration_min: 90, price_tnd: 15, seats: 20, seats_left: 8, is_free_first: true, status: "scheduled", meet_url: "https://meet.jit.si/tnajem-c1", whiteboard_url: "https://bitpaper.io/", quiz_url: "https://www.wooclap.com/" },
  { id: "c2", tutor_id: "yassine", tutor_name: "Yassine Khelifi", title: "Annales Bac 2025 corrigées", description: "Correction guidée des sujets 2025.", ...when(at(4, 17, 0)), duration_min: 120, price_tnd: 20, seats: 20, seats_left: 12, is_free_first: false, status: "scheduled", meet_url: "https://meet.jit.si/tnajem-c2" },
];

const devPacks: Pack[] = [
  { id: "p1", tutor_id: "yassine", title: "Pack révision : Dérivées & Limites", meta: "42 pages · 6 vidéos", price_tnd: 8, kind: "pdf" },
];

const devYassine = (): Storefront => ({
  tutor: {
    id: "yassine", slug: "yassine-math", full_name: "Yassine Khelifi",
    subject: "Prof de Maths · Bac", level: "Bac",
    // No free-session promise in the bio: the badge renders from offers_free_first_session below.
    bio: "« Spécialiste révisions Bac. On révise les dérivées, intégrales et annales — en darija, à ton rythme. »",
    avatar_initials: "YK", rating: 0, students_count: 0, verified: true,
    // The dev fixture opts IN, so the audit harness can still walk the badge and
    // the "free" checkout copy. It is dev-only by construction (demoEnabled).
    offers_free_first_session: true,
    // No fixture photo: the demo tutor is not a real person and must not wear a
    // real face. The monogram is the honest render.
    has_photo: false,
  },
  classes: devClasses(),
  packs: devPacks,
});

/* The other two tutors the /explore demo preview links to. Before these existed,
   getStorefront() answered EVERY slug with Yassine — so a typo'd link showed a
   different tutor's page, with a working "Réserver". Now each demo slug resolves
   to its own tutor and anything else is not found, exactly like the real API.
   No rating, no student count: nothing here may invent social proof. */
const devTutorOnly = (tutor: Pick<Storefront["tutor"], "id" | "slug" | "full_name" | "subject" | "level" | "bio" | "avatar_initials">): Storefront => ({
  tutor: { ...tutor, rating: 0, students_count: 0, verified: true, offers_free_first_session: false, has_photo: false },
  classes: [],
  packs: [],
});

const devStorefronts = (): Record<string, Storefront> => ({
  "yassine-math": devYassine(),
  "sonia-physique": devTutorOnly({
    id: "sonia", slug: "sonia-physique", full_name: "Sonia Trabelsi",
    subject: "Prof de Physique · Lycée & Bac", level: "Bac",
    bio: "Physique-chimie sans par cœur : on comprend, puis on s'entraîne sur les annales.",
    avatar_initials: "ST",
  }),
  "leila-primaire": devTutorOnly({
    id: "leila", slug: "leila-primaire", full_name: "Leïla Ben Amor",
    subject: "Maths & Français · Primaire & Collège", level: "Collège",
    /* Arabic script, on purpose: user text renders with dir="auto", and this is the
       fixture that proves an Arabic bio still reads RTL — see packages/db/src/seed.ts. */
    bio: "« القواعد قبل كل شي. بالصبر، بالدارجة، وتمارين للدار. »",
    avatar_initials: "LB",
  }),
});

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
