import { eq, classes as classesT, packs as packsT, tutors } from "@tnajem/db";
import { initials, MONTHS_FR, type Storefront, type Tutor, type ClassItem, type Pack } from "@tnajem/shared";
import { db } from "../db";

/* The public storefront read, ported from apps/web/lib/data.ts::getStorefront.

   ANONYMOUS BY CONSTRUCTION. This feeds an ISR-cached page, so it must never
   depend on who is asking. If it ever needs to, that belongs on a separate
   authenticated endpoint — see the header of routes/tutors.ts.

   The demo-fallback branch did NOT move. It exists so `next build` and the
   ui-audit harness work without a database, and it throws in production rather
   than fabricating a tutor (lib/data.ts::DatabaseNotConfiguredError). apps/api
   asserts DATABASE_URL at boot, so it has no equivalent situation. */

export async function getStorefrontData(slug: string): Promise<Storefront | null> {
  const [t] = await db.select().from(tutors).where(eq(tutors.slug, slug)).limit(1);
  if (!t) return null;
  if (t.status !== "verified") return null; // pending/unverified tutors aren't public

  const cls = await db.select().from(classesT).where(eq(classesT.tutorId, t.id));
  const pks = await db.select().from(packsT).where(eq(packsT.tutorId, t.id));

  const tutor: Tutor = {
    id: t.id,
    slug: t.slug,
    full_name: t.fullName,
    subject: t.subject,
    level: t.level ?? "Bac",
    bio: t.bio ?? "",
    avatar_initials: initials(t.fullName),
    rating: Number(t.rating ?? 0),
    students_count: t.studentsCount ?? 0,
    verified: Boolean(t.verified),
  };

  const mapClass = (c: (typeof cls)[number]): ClassItem => {
    const d = new Date(c.scheduledAt);
    return {
      id: c.id,
      tutor_id: t.id,
      tutor_name: t.fullName,
      title: c.title,
      description: c.description ?? undefined,
      day: String(d.getDate()),
      month: MONTHS_FR[d.getMonth()],
      time: d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      duration_min: c.durationMin ?? 90,
      price_tnd: Number(c.priceTnd),
      seats: c.seats ?? 0,
      seats_left: Math.max(0, (c.seats ?? 0) - (c.seatsTaken ?? 0)),
      is_free_first: Boolean(c.isFreeFirst),
      meet_url: c.meetUrl ?? undefined,
      whiteboard_url: c.whiteboardUrl ?? undefined,
      quiz_url: c.quizUrl ?? undefined,
      replay_url: c.replayUrl ?? undefined,
      status: c.status ?? "scheduled",
    };
  };

  const mapPack = (p: (typeof pks)[number]): Pack => ({
    id: p.id,
    tutor_id: t.id,
    title: p.title,
    meta: p.description ?? "",
    price_tnd: Number(p.priceTnd),
  });

  return { tutor, classes: cls.map(mapClass), packs: pks.map(mapPack) };
}
