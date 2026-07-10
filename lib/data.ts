import "server-only";
import { eq } from "drizzle-orm";
import { db, dbReady } from "@/lib/db";
import { tutors, classes as classesT, packs as packsT } from "@/lib/db/schema";
import { demoStorefront } from "@/lib/demo";
import type { Storefront, Tutor, ClassItem, Pack } from "@/lib/types";

/* Server-side reads. In demo mode (no DATABASE_URL) we return demo data so the
   app runs with zero setup; with a DB, we query Postgres via Drizzle. */

const MONTHS_FR = ["JANV", "FÉVR", "MARS", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEPT", "OCT", "NOV", "DÉC"];
const initials = (name: string) => {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?";
};

export async function getStorefront(slug: string): Promise<Storefront | null> {
  if (!dbReady) return demoStorefront; // demo mode: any slug shows the demo storefront

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
