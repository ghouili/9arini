import { and, asc, eq, classes as classesT, packs as packsT, tutors } from "@tnajem/db";
import {
  initials,
  publicTutorName, // phase-a lane L2 (A23)
  classWhen,
  isEffectivelyFreeFirst,
  type Storefront,
  type Tutor,
  type ClassItem,
  type Pack,
} from "@tnajem/shared";
import { db } from "../db";
import { onSaleClassSql } from "./class-sale";

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
  if (t.suspendedAt) return null; // A blocked account's storefront is suspended (0019): off every public read.

  /* Only classes still on sale, soonest first — the storefront's "Prochaine
     séance" is the first bookable row of this list, so the order is the product. */
  const cls = await db
    .select()
    .from(classesT)
    .where(and(eq(classesT.tutorId, t.id), onSaleClassSql))
    .orderBy(asc(classesT.scheduledAt));
  const pks = await db.select().from(packsT).where(eq(packsT.tutorId, t.id));

  /* phase-a lane L2 (A23) — D1: the public page names the tutor "Mohamed B.". The
     full name never leaves this function; `full_name` keeps its key for the web. */
  const shownName = publicTutorName(t.fullName) ?? "";

  const tutor: Tutor = {
    id: t.id,
    slug: t.slug,
    full_name: shownName,
    subject: t.subject,
    level: t.level ?? "Bac",
    bio: t.bio ?? "",
    avatar_initials: initials(shownName),
    rating: Number(t.rating ?? 0),
    students_count: t.studentsCount ?? 0,
    verified: Boolean(t.verified),
    offers_free_first_session: t.offersFreeFirstSession,
    /* APPROVED only. A pending photo is unreviewed — it could be anything — and
       this payload feeds an ISR-cached public page. */
    has_photo: t.avatarStatus === "approved" && Boolean(t.avatarPath),
  };

  const mapClass = (c: (typeof cls)[number]): ClassItem => {
    const d = new Date(c.scheduledAt);
    return {
      id: c.id,
      tutor_id: t.id,
      tutor_name: shownName, // phase-a lane L2 (A23)
      title: c.title,
      description: c.description ?? undefined,
      // starts_at + day/month/time, all in Tunis — never this process's timezone.
      ...classWhen(d),
      duration_min: c.durationMin ?? 90,
      price_tnd: Number(c.priceTnd),
      seats: c.seats ?? 0,
      seats_left: Math.max(0, (c.seats ?? 0) - (c.seatsTaken ?? 0)),
      // EFFECTIVE. The tutor's opt-in is the master switch — see isEffectivelyFreeFirst.
      is_free_first: isEffectivelyFreeFirst(t.offersFreeFirstSession, c.isFreeFirst),
      /* NO ROOM LINKS. This payload is anonymous and feeds an ISR-cached public
         page; it used to carry the tutor's own meet/whiteboard/quiz/replay URLs to
         anyone who opened the storefront. They ship only from GET /classes/:id and
         /classes/:id/join, to the owning tutor or a student with a live booking. */
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
