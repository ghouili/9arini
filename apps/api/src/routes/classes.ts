import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  and, desc, eq, sql as raw,
  bookings, classes, packs, profiles, reviews, tutors,
} from "@tnajem/db";
import {
  vText, vOptionalText, vFutureDate, vInt, vPrice, vOptionalUrl, isUuid,
  MONTHS_FR,
  type ClassItem, type DashboardResult, type DashboardBooking,
  isEffectivelyFreeFirst,
} from "@tnajem/shared";
import { paymentsEnabled, tutorBalanceTnd } from "@tnajem/shared/payments";
import { resolveMeetUrl } from "@tnajem/shared/live";
import { db } from "../db";
import { getSession } from "../lib/session";

/* classes — createClass, createPack, getClass, getDashboard. */

const createClassBody = z.object({
  title: z.string(),
  description: z.string().optional(),
  scheduledAt: z.string(),
  durationMin: z.number(),
  priceTnd: z.number(),
  seats: z.number(),
  isFreeFirst: z.boolean(),
  meetUrl: z.string().optional(),
  whiteboardUrl: z.string().optional(),
  quizUrl: z.string().optional(),
});

const createPackBody = z.object({
  title: z.string(),
  meta: z.string().optional(),
  priceTnd: z.number(),
});

export async function classRoutes(app: FastifyInstance): Promise<void> {
  /* ── POST /classes ───────────────────────────────────────────────────────── */
  app.post("/classes", async (req, reply) => {
    const parsed = createClassBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad-request" });
    const input = parsed.data;

    // Was accepting past dates, negative prices and arbitrary meetUrl strings
    // (javascript: …). Every one of these validators is load-bearing.
    const title = vText(input.title, { field: "title", max: 120, min: 3 });
    if (!title.ok) return { ok: false, error: title.error };
    const description = vOptionalText(input.description, { field: "description", max: 1000 });
    if (!description.ok) return { ok: false, error: description.error };
    const when = vFutureDate(input.scheduledAt, { field: "date" });
    if (!when.ok) return { ok: false, error: when.error };
    const duration = vInt(input.durationMin, { field: "duration", min: 15, max: 480 });
    if (!duration.ok) return { ok: false, error: duration.error };
    const price = vPrice(input.priceTnd, { field: "price", max: 5000 });
    if (!price.ok) return { ok: false, error: price.error };
    const seats = vInt(input.seats, { field: "seats", min: 1, max: 500 });
    if (!seats.ok) return { ok: false, error: seats.error };
    const meetUrl = vOptionalUrl(input.meetUrl, { field: "meet-url" });
    if (!meetUrl.ok) return { ok: false, error: meetUrl.error };
    const whiteboardUrl = vOptionalUrl(input.whiteboardUrl, { field: "whiteboard-url" });
    if (!whiteboardUrl.ok) return { ok: false, error: whiteboardUrl.error };
    const quizUrl = vOptionalUrl(input.quizUrl, { field: "quiz-url" });
    if (!quizUrl.ok) return { ok: false, error: quizUrl.error };

    const session = await getSession(req);
    if (!session) return { ok: false, error: "not-authenticated" };
    const [mine] = await db
      .select()
      .from(tutors)
      .where(eq(tutors.profileId, session.profile.id))
      .limit(1);
    if (!mine) return { ok: false, error: "no-storefront" };

    /* VERIFICATION GATE. A draft/pending tutor could already build a catalogue,
       and — the part that actually matters — so could a REJECTED one: nothing here
       ever looked at `status`. The content is not publicly visible, but a tutor we
       have refused should not keep stocking a storefront that goes live the
       instant anyone flips their status, and the class id is a bookable handle the
       moment it exists. Creating the storefront stays open: that is the step that
       gets them INTO verification. */
    if (mine.status !== "verified") return { ok: false, error: "not-verified" };

    // meetUrl stays nullable: lib/live.ts derives a room from the class id when it
    // is empty, so the student's Join button is never dead.
    await db.insert(classes).values({
      tutorId: mine.id,
      title: title.value,
      description: description.value,
      scheduledAt: when.value,
      durationMin: duration.value,
      priceTnd: String(price.value),
      seats: seats.value,
      isFreeFirst: Boolean(input.isFreeFirst),
      meetUrl: meetUrl.value,
      whiteboardUrl: whiteboardUrl.value,
      quizUrl: quizUrl.value,
    });

    // The storefront lists this tutor's classes — the web drops its 60s ISR entry.
    return { ok: true, revalidate: { tutors: [mine.slug] } };
  });

  /* ── POST /packs ─────────────────────────────────────────────────────────── */
  app.post("/packs", async (req, reply) => {
    const parsed = createPackBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad-request" });
    const input = parsed.data;

    const title = vText(input.title, { field: "title", max: 120, min: 3 });
    if (!title.ok) return { ok: false, error: title.error };
    const meta = vOptionalText(input.meta, { field: "meta", max: 200 });
    if (!meta.ok) return { ok: false, error: meta.error };
    const price = vPrice(input.priceTnd, { field: "price", max: 5000 });
    if (!price.ok) return { ok: false, error: price.error };

    const session = await getSession(req);
    if (!session) return { ok: false, error: "not-authenticated" };
    const [mine] = await db
      .select()
      .from(tutors)
      .where(eq(tutors.profileId, session.profile.id))
      .limit(1);
    if (!mine) return { ok: false, error: "no-storefront" };
    // Same verification gate as createClass — a rejected tutor does not get to
    // keep building a catalogue.
    if (mine.status !== "verified") return { ok: false, error: "not-verified" };

    await db.insert(packs).values({
      tutorId: mine.id,
      title: title.value,
      description: meta.value,
      priceTnd: String(price.value),
    });

    return { ok: true, revalidate: { tutors: [mine.slug] } }; // packs render publicly
  });

  /* ── GET /classes/:id ────────────────────────────────────────────────────── */
  app.get<{ Params: { id: string } }>("/classes/:id", async (req): Promise<ClassItem | null> => {
    const id = req.params.id;
    if (!isUuid(id)) return null;

    const [c] = await db.select().from(classes).where(eq(classes.id, id)).limit(1);
    if (!c) return null;

    const [tut] = await db.select().from(tutors).where(eq(tutors.id, c.tutorId)).limit(1);

    const session = await getSession(req);
    const uid = session?.profile.id ?? null;
    const isOwner = Boolean(uid && tut?.profileId === uid);

    let hasBooking = false;
    if (uid) {
      const [bk] = await db
        .select({ status: bookings.status })
        .from(bookings)
        .where(and(eq(bookings.classId, c.id), eq(bookings.studentId, uid)))
        .limit(1);
      hasBooking = Boolean(bk && bk.status !== "cancelled");
    }
    const entitled = isOwner || hasBooking;

    /* A non-verified tutor's class is visible only to the tutor themselves and to
       students who already hold a booking — so a tutor whose status changed after
       people booked does not strand them. */
    if (tut?.status !== "verified" && !entitled) return null;

    const d = new Date(c.scheduledAt);

    /* ROOM LINKS ARE THE REAL LEAK. meet_url is the ONLY thing protecting a live
       session: anyone holding it can walk into a class full of minors. It ships
       exclusively to the owning tutor or a student with a live booking. Everything
       else about the class is public; these four fields are not. */
    return {
      id: c.id,
      tutor_id: c.tutorId,
      tutor_name: tut?.fullName ?? "",
      title: c.title,
      description: c.description ?? undefined,
      day: String(d.getDate()),
      month: MONTHS_FR[d.getMonth()],
      time: d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      duration_min: c.durationMin ?? 90,
      price_tnd: Number(c.priceTnd),
      seats: c.seats ?? 0,
      seats_left: Math.max(0, (c.seats ?? 0) - (c.seatsTaken ?? 0)),
      // EFFECTIVE: the tutor's opt-in gates the per-class flag.
      is_free_first: isEffectivelyFreeFirst(tut?.offersFreeFirstSession, c.isFreeFirst),
      meet_url: entitled ? resolveMeetUrl(c) : undefined,
      whiteboard_url: entitled ? (c.whiteboardUrl ?? undefined) : undefined,
      quiz_url: entitled ? (c.quizUrl ?? undefined) : undefined,
      replay_url: entitled ? (c.replayUrl ?? undefined) : undefined,
      status: c.status ?? "scheduled",
    };
  });

  /* ── GET /dashboard (the signed-in tutor's own view) ─────────────────────── */
  app.get("/dashboard", async (req): Promise<DashboardResult> => {
    const session = await getSession(req);
    if (!session) return null;
    const uid = session.profile.id;

    const [mine] = await db.select().from(tutors).where(eq(tutors.profileId, uid)).limit(1);
    if (!mine) {
      // Signed in but no storefront yet → prompt them to create one.
      return {
        name: session.profile.fullName,
        slug: null,
        has_storefront: false,
        balance_tnd: 0,
        paymentsEnabled: paymentsEnabled(),
        students: 0,
        sessions: 0,
        rating: 0,
        reviewCount: 0,
        status: "draft",
        offersFreeFirstSession: false,
        classes: [],
        packs: [],
        bookings: [],
      };
    }

    /* Bounded reads. These are per-tutor so they grow slowly, but "slowly" is
       still unbounded: a tutor running weekly classes for two years has ~100 rows,
       and the bookings join multiplies by attendees. Caps keep one prolific tutor
       from turning their own dashboard into a timeout. */
    const rows = await db
      .select()
      .from(classes)
      .where(eq(classes.tutorId, mine.id))
      .orderBy(desc(classes.scheduledAt))
      .limit(200);

    const mapped = rows.map((c) => {
      const d = new Date(c.scheduledAt);
      return {
        id: c.id,
        title: c.title,
        day: String(d.getDate()),
        month: MONTHS_FR[d.getMonth()] ?? "",
        time: d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        price_tnd: Number(c.priceTnd),
        seats: c.seats ?? 0,
        seats_left: Math.max(0, (c.seats ?? 0) - (c.seatsTaken ?? 0)),
        status: c.status ?? "scheduled",
      };
    });

    const packRows = await db.select().from(packs).where(eq(packs.tutorId, mine.id)).limit(100);
    const mappedPacks = packRows.map((p) => ({
      id: p.id,
      title: p.title,
      meta: p.description ?? "",
      price_tnd: Number(p.priceTnd),
    }));

    /* Who actually booked.

       ⚠️ STEP 8 WILL CHANGE THIS. studentPhone and studentEmail are the product's
       largest counterparty-PII surface: the dashboard renders them as a tel: link
       and a mailto: link with the address as the visible label. Under the
       zero-contact rule a tutor sees a FIRST NAME and nothing else.

       They are ported UNCHANGED here on purpose. Stage A's contract is that
       behaviour is identical, and quietly closing a leak mid-refactor would make
       the E2E suite's "no behaviour change" claim untrue and hide the change in a
       commit about plumbing. Step 8 closes it deliberately, with its own tests and
       its own copy changes. */
    const bookingRows = await db
      .select({
        bookingId: bookings.id,
        classId: classes.id,
        classTitle: classes.title,
        scheduledAt: classes.scheduledAt,
        isFree: bookings.isFree,
        status: bookings.status,
        bookedAt: bookings.createdAt,
        studentName: profiles.fullName,
        studentPhone: profiles.phone,
        studentEmail: profiles.email,
      })
      .from(bookings)
      // Single join, NOT a query per class.
      .innerJoin(classes, eq(bookings.classId, classes.id))
      .innerJoin(profiles, eq(bookings.studentId, profiles.id))
      .where(eq(classes.tutorId, mine.id))
      .orderBy(desc(bookings.createdAt))
      .limit(500);

    const mappedBookings: DashboardBooking[] = bookingRows.map((b) => ({
      bookingId: b.bookingId,
      classId: b.classId,
      classTitle: b.classTitle,
      studentName: b.studentName,
      studentPhone: b.studentPhone,
      studentEmail: b.studentEmail,
      bookedAt: new Date(b.bookedAt).toISOString(),
      classTs: new Date(b.scheduledAt).getTime(),
      isFree: Boolean(b.isFree),
      status: b.status ?? "reserved",
    }));

    const [revAgg] = await db
      .select({ n: raw<number>`count(*)::int` })
      .from(reviews)
      .where(eq(reviews.tutorId, mine.id));

    // Real balance from payments.ts — 0 while payments are hard-disabled. Never fabricated.
    const balance = await tutorBalanceTnd(mine.id);

    return {
      name: mine.fullName ?? session.profile.fullName,
      slug: mine.slug,
      has_storefront: true,
      balance_tnd: balance,
      paymentsEnabled: paymentsEnabled(),
      students: mine.studentsCount ?? 0,
      sessions: rows.length,
      rating: Number(mine.rating ?? 0),
      reviewCount: revAgg?.n ?? 0,
      status: mine.status,
      offersFreeFirstSession: mine.offersFreeFirstSession,
      classes: mapped,
      packs: mappedPacks,
      bookings: mappedBookings,
    };
  });
}
