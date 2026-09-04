import "server-only";
import { desc, eq } from "@tnajem/db";
import { db, dbReady } from "@/lib/db";
import { tutors, classes as classesT, packs as packsT } from "@tnajem/db";
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
  if (!dbReady) {
    assertNotProdWithoutDb("getStorefront");   // prod + no DB → throw, never fabricate
    return demoStorefront;                     // dev only: any slug shows the demo storefront
  }

  const [t] = await db.select().from(tutors).where(eq(tutors.slug, slug)).limit(1);
  if (!t) return null;
  if (t.status !== "verified") return null; // pending/unverified tutors aren't public

  const cls = await db.select().from(classesT).where(eq(classesT.tutorId, t.id));
  const pks = await db.select().from(packsT).where(eq(packsT.tutorId, t.id));

  const tutor: Tutor = {
    id: t.id, slug: t.slug, full_name: t.fullName, subject: t.subject, level: t.level ?? "Bac",
    bio: t.bio ?? "", avatar_initials: initials(t.fullName), rating: Number(t.rating ?? 0),
    students_count: t.studentsCount ?? 0, verified: Boolean(t.verified),
  };

  const mapClass = (c: (typeof cls)[number]): ClassItem => {
    const d = new Date(c.scheduledAt);
    return {
      id: c.id, tutor_id: t.id, tutor_name: t.fullName, title: c.title,
      description: c.description ?? undefined,
      day: String(d.getDate()), month: MONTHS_FR[d.getMonth()],
      time: d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      duration_min: c.durationMin ?? 90, price_tnd: Number(c.priceTnd),
      seats: c.seats ?? 0, seats_left: Math.max(0, (c.seats ?? 0) - (c.seatsTaken ?? 0)),
      is_free_first: Boolean(c.isFreeFirst), meet_url: c.meetUrl ?? undefined,
      whiteboard_url: c.whiteboardUrl ?? undefined, quiz_url: c.quizUrl ?? undefined,
      replay_url: c.replayUrl ?? undefined, status: c.status ?? "scheduled",
    };
  };
  const mapPack = (p: (typeof pks)[number]): Pack => ({
    id: p.id, tutor_id: t.id, title: p.title, meta: p.description ?? "", price_tnd: Number(p.priceTnd),
  });

  return { tutor, classes: cls.map(mapClass), packs: pks.map(mapPack) };
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
  if (!dbReady) return [];

  try {
    const rows = await db
      .select({
        slug: tutors.slug,
        reviewedAt: tutors.reviewedAt,
        createdAt: tutors.createdAt,
      })
      .from(tutors)
      .where(eq(tutors.status, "verified"))
      .orderBy(desc(tutors.createdAt));

    return rows
      .filter((r) => Boolean(r.slug))
      .map((r) => ({
        slug: r.slug,
        // Best available "last changed": the verification decision, else creation.
        lastModified: r.reviewedAt ?? r.createdAt ?? new Date(),
      }));
  } catch (e) {
    console.error("[Tnajem] sitemap: could not read verified tutors", e);
    return [];
  }
}
