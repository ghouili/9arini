import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  and, desc, eq, sql as raw,
  bookings, cancellations, classes, packs, profiles, reviews, tutors,
  notify,
} from "@tnajem/db";
import {
  vText, vOptionalText, vFutureDate, vInt, vPrice, vOptionalUrl, isUuid,
  MONTHS_FR,
  type ClassItem, type DashboardResult, type DashboardBooking,
  isEffectivelyFreeFirst,
  cancellationOutcome,
  publicProfile,
  publicInitials,
} from "@tnajem/shared";
import { paymentsEnabled, tutorBalanceTnd } from "@tnajem/shared/payments";
import { resolveMeetUrl } from "@tnajem/shared/live";
import { db } from "../db";
import { getSession } from "../lib/session";
import { recomputeTutorStats } from "../lib/stats";
import { assertNoContactInfo, CONTACT_ERROR } from "../lib/contact-guard";

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

    /* ZERO CONTACT EXCHANGE (Step 8). A class title and description are rendered
       on the PUBLIC storefront and in the class page's meta description, so a
       number here reaches the open internet, not just the students who book.
       Rejected, not masked: the tutor is on the form and can fix it now.

       After the auth and verification gates, because assertNoContactInfo WRITES
       flag rows and an unauthenticated caller must not be able to fill that table. */
    if (
      !(await assertNoContactInfo(session.profile.id, [
        { surface: "class_title", value: title.value },
        { surface: "class_description", value: description.value },
      ]))
    ) {
      return { ok: false, error: CONTACT_ERROR };
    }

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

    // A pack title is public storefront copy too. Same rule, same reason.
    if (
      !(await assertNoContactInfo(session.profile.id, [
        { surface: "pack_title", value: title.value },
        { surface: "pack_title", value: meta.value },
      ]))
    ) {
      return { ok: false, error: CONTACT_ERROR };
    }

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

  /* ── POST /classes/:id/cancel — the TUTOR calls it off ──────────────────────

     100% RELEASE, ALWAYS. Retaining a share of a seat the student still wanted
     would be charging them for someone else's decision. The ledger records this
     as `waived` rather than pretending the cancellation was early — see the note
     on that flag in @tnajem/shared/cancellation.ts.

     The class status, every booking, the seat count and the ledger rows move in
     ONE transaction. A half-cancelled class — status flipped, students still
     holding seats — is worse than not cancelling at all: they would turn up. */
  app.post<{ Params: { id: string } }>("/classes/:id/cancel", async (req) => {
    const parsed = z.object({ reason: z.string().optional() }).safeParse(req.body ?? {});
    if (!parsed.success) return { ok: false, error: "bad-request" };
    const reason = vOptionalText(parsed.data.reason, { field: "reason", max: 500 });
    if (!reason.ok) return { ok: false, error: reason.error };

    const session = await getSession(req);
    if (!session) return { ok: false, error: "not-authenticated" };
    if (!isUuid(req.params.id)) return { ok: false, error: "not-found" };

    const [c] = await db
      .select({
        id: classes.id,
        title: classes.title,
        status: classes.status,
        scheduledAt: classes.scheduledAt,
        priceTnd: classes.priceTnd,
        tutorId: classes.tutorId,
        tutorProfileId: tutors.profileId,
        slug: tutors.slug,
      })
      .from(classes)
      .innerJoin(tutors, eq(classes.tutorId, tutors.id))
      .where(eq(classes.id, req.params.id))
      .limit(1);
    if (!c) return { ok: false, error: "not-found" };
    /* Ownership, not just authentication: a class id is a bare uuid, and
       "not-found" rather than "forbidden" so it does not confirm the id exists. */
    if (c.tutorProfileId !== session.profile.id) return { ok: false, error: "not-found" };
    if (c.status === "cancelled") return { ok: true, already: true }; // idempotent
    if (c.status === "done") return { ok: false, error: "already-started" };
    if (new Date(c.scheduledAt).getTime() <= Date.now()) {
      return { ok: false, error: "already-started" };
    }

    /* Read the live bookings BEFORE the transaction, so the notifications after it
       know who to tell. notify() does I/O and must never run inside a write tx. */
    const live = await db
      .select({ id: bookings.id, studentId: bookings.studentId, isFree: bookings.isFree })
      .from(bookings)
      .where(
        and(
          eq(bookings.classId, c.id),
          raw`coalesce(${bookings.status}, 'reserved') <> 'cancelled'`,
        ),
      );

    const now = Date.now();
    await db.transaction(async (tx) => {
      await tx
        .update(classes)
        /* Seats to zero rather than decremented per booking: the class is gone, so
           there is no arithmetic left to get wrong. */
        .set({ status: "cancelled", seatsTaken: 0 })
        .where(eq(classes.id, c.id));

      await tx
        .update(bookings)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(bookings.classId, c.id),
            raw`coalesce(${bookings.status}, 'reserved') <> 'cancelled'`,
          ),
        );

      for (const b of live) {
        const outcome = cancellationOutcome({
          scheduledAt: c.scheduledAt,
          amountTnd: b.isFree ? 0 : Number(c.priceTnd ?? 0),
          now,
          waived: true, // the tutor cancelled — the student owes nothing
        });
        await tx
          .insert(cancellations)
          .values({
            bookingId: b.id,
            classId: c.id,
            actorProfileId: session.profile.id,
            actor: "tutor",
            hoursBeforeStart: (outcome.msBeforeStart / 3_600_000).toFixed(2),
            late: outcome.late,
            amountTnd: outcome.amountTnd.toFixed(2),
            retainedTnd: outcome.retainedTnd.toFixed(2),
            releasedTnd: outcome.releasedTnd.toFixed(2),
            retainedPct: outcome.retainedPct.toFixed(3),
            paymentsEnabled: paymentsEnabled(),
            reason: reason.value ?? "cancelled-by-tutor",
          })
          .onConflictDoNothing();
      }

      await recomputeTutorStats(c.tutorId, tx);
    });

    const whenLabel = new Date(c.scheduledAt).toLocaleString("fr-FR", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
    for (const b of live) {
      await notify(db, b.studentId, {
        kind: "booking_cancelled",
        title: "Séance annulée",
        body: `« ${c.title} » (${whenLabel}) est annulée par le prof. Tu ne dois rien.`,
        href: "/student",
      });
    }

    return { ok: true, cancelled: live.length, revalidate: { tutors: [c.slug] } };
  });

  /* ── POST /classes/:id/reschedule — the TUTOR moves it ──────────────────────

     Moving a class does NOT cancel anyone. Most students will simply come at the
     new time, and cancelling their seats to force a re-book would lose the ones
     who never read the notification — the opposite of helping them.

     What it does is WAIVE the 48h window for everyone who booked the OLD time.
     They agreed to an appointment that no longer exists; holding them to a
     deadline measured against a time they never chose would charge them for the
     tutor's change of plan. classes.rescheduled_at is the whole mechanism — see
     the column comment for why it is not a per-booking flag. */
  app.post<{ Params: { id: string } }>("/classes/:id/reschedule", async (req) => {
    const parsed = z.object({ scheduledAt: z.string() }).safeParse(req.body);
    if (!parsed.success) return { ok: false, error: "bad-request" };

    const session = await getSession(req);
    if (!session) return { ok: false, error: "not-authenticated" };
    if (!isUuid(req.params.id)) return { ok: false, error: "not-found" };

    // The same validator createClass uses: a past date is refused on both paths.
    const when = vFutureDate(parsed.data.scheduledAt, { field: "date" });
    if (!when.ok) return { ok: false, error: when.error };

    const [c] = await db
      .select({
        id: classes.id,
        title: classes.title,
        status: classes.status,
        scheduledAt: classes.scheduledAt,
        tutorProfileId: tutors.profileId,
        slug: tutors.slug,
      })
      .from(classes)
      .innerJoin(tutors, eq(classes.tutorId, tutors.id))
      .where(eq(classes.id, req.params.id))
      .limit(1);
    if (!c) return { ok: false, error: "not-found" };
    if (c.tutorProfileId !== session.profile.id) return { ok: false, error: "not-found" };
    if (c.status === "cancelled" || c.status === "done") return { ok: false, error: "unavailable" };
    if (new Date(c.scheduledAt).getTime() <= Date.now()) {
      return { ok: false, error: "already-started" };
    }

    await db
      .update(classes)
      .set({ scheduledAt: when.value, rescheduledAt: raw`now()` })
      .where(eq(classes.id, c.id));

    const live = await db
      .select({ studentId: bookings.studentId })
      .from(bookings)
      .where(
        and(
          eq(bookings.classId, c.id),
          raw`coalesce(${bookings.status}, 'reserved') <> 'cancelled'`,
        ),
      );

    const whenLabel = when.value.toLocaleString("fr-FR", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
    for (const b of live) {
      /* The notification SAYS they can cancel free. A student who cannot make the
         new time needs to know that before they go looking for the deadline. */
      await notify(db, b.studentId, {
        kind: "class_reminder",
        title: "Séance déplacée",
        body: `« ${c.title} » est déplacée au ${whenLabel}. Si ça ne te convient pas, tu peux annuler sans frais.`,
        href: "/student",
      });
    }

    return { ok: true, notified: live.length, revalidate: { tutors: [c.slug] } };
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

    /* Who actually booked — A FIRST NAME AND NOTHING ELSE.

       Step 8 closed this. It used to select profiles.phone and profiles.email and
       the dashboard rendered them as a `tel:` link and a `mailto:` link with the
       address as the visible label: the product's largest counterparty-PII
       surface, contradicted by its own copy ("Ton numéro reste privé").

       THE COLUMNS ARE NOT SELECTED AT ALL. Not selected-then-dropped, not
       selected-then-nulled — absent from the query, so there is no value in this
       process to leak through a log line, an error payload or a future field. */
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
      // publicProfile is the ALLOW-LIST: it builds a new object from named
      // fields, so a column added to profiles tomorrow cannot ride along.
      studentName: publicProfile({ fullName: b.studentName }).name,
      studentInitials: publicInitials(b.studentName),
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
