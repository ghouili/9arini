import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  and, desc, eq, ne, sql as raw,
  bookings, classes, consents, tutors,
  notify,
} from "@tnajem/db";
import {
  vUuid, isMinorBirthYear, MONTHS_FR,
  type StudentDashboard,
  isEffectivelyFreeFirst,
} from "@tnajem/shared";
import { resolveMeetUrl } from "@tnajem/shared/live";
import { db } from "../db";
import { getSession } from "../lib/session";
import { checkRateLimit } from "../lib/rate-limit";
import { recomputeTutorStats } from "../lib/stats";

/* bookings — reserveSeat, cancelBooking, getStudentDashboard.

   ══════════════════════════════════════════════════════════════════════════════
   THE SEAT CLAIM IS TRANSCRIBED STATEMENT FOR STATEMENT. DO NOT "CLEAN IT UP".
   ══════════════════════════════════════════════════════════════════════════════
   Any rewrite of the claim is where overselling comes back. It is guarded by
   e2e/seat-claim.race.spec.ts (16 genuinely concurrent claims on the last seat)
   and by the product-level invariant in e2e/student.spec.ts.

   recomputeTutorStats already moved to apps/api/src/lib/stats.ts in the classes
   domain, precisely so it could join THIS transaction. If it had stayed on the web
   side, the seat claim and the stats update would no longer share a transaction —
   and the lost-update race would return, reintroduced by the refactor. */

const reserveBody = z.object({ classId: z.string() });
const cancelBody = z.object({ bookingId: z.string() });

/** The UI promises free cancellation up to 24h before — enforced here, not in copy.
    Step 7 replaces this with 48h/40%; until then the rule is unchanged. */
const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function bookingRoutes(app: FastifyInstance): Promise<void> {
  /* ── POST /bookings ──────────────────────────────────────────────────────── */
  app.post("/bookings", async (req, reply) => {
    const parsed = reserveBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad-request" });

    const classId = vUuid(parsed.data.classId, { field: "class" });
    if (!classId.ok) return { ok: false, error: "not-found" };

    const session = await getSession(req);
    if (!session) return { ok: false, error: "not-authenticated" };
    const uid = session.profile.id;

    // Booking is a DB-write endpoint anyone with a session can hammer.
    const rl = await checkRateLimit(`book:${uid}`, 20, 60_000);
    if (!rl.ok) return { ok: false, error: "too-many-requests" };

    /* ---- GUARDIAN CONSENT (INPDP / Loi 2004-63) ----
       This was once a promise, not a control. verifyOtp returns needsConsent and
       the client routes to /auth/consent, but NOTHING server-side re-checked the
       row — so a student who closed that page, hit Back, or went straight to
       /checkout?class=<id> booked a real tutor with no consent on file. The legal
       record we publicly commit to collecting was optional in practice, and the
       one surface that could enforce it — the booking, the moment a minor actually
       engages a tutor — did not look.

       Distinct error code so the UI routes to /auth/consent rather than showing
       "réessaie" for something retrying can never fix.

       Scoped to a MINOR student: an adult books without it, while a minor — or a
       student whose age we do not know (null fails SAFE via isMinorBirthYear) —
       must have a consent row. */
    if (session.profile.role === "student" && isMinorBirthYear(session.profile.birthYear)) {
      const [consent] = await db
        .select({ id: consents.id })
        .from(consents)
        .where(eq(consents.minorId, uid))
        .limit(1);
      if (!consent) return { ok: false, error: "needs-consent" };
    }

    const [cls] = await db.select().from(classes).where(eq(classes.id, classId.value)).limit(1);
    if (!cls) return { ok: false, error: "not-found" };
    if (cls.status === "cancelled" || cls.status === "done") return { ok: false, error: "unavailable" };
    // A class in the past cannot be booked (there was no check at all — you could
    // reserve a seat in last month's session and then review it).
    if (new Date(cls.scheduledAt).getTime() < Date.now()) return { ok: false, error: "unavailable" };

    /* The tutor must actually be verified. The discovery surfaces hide non-verified
       tutors, but NOTHING stopped a draft/pending/REJECTED tutor from handing out a
       direct /class/<id> link and taking real bookings from minors — the id was all
       you needed. The gate has to live on the booking path, not only on discovery. */
    const [tut] = await db.select().from(tutors).where(eq(tutors.id, cls.tutorId)).limit(1);
    if (!tut || tut.status !== "verified") return { ok: false, error: "unavailable" };
    if (tut.profileId === uid) return { ok: false, error: "own-class" }; // no self-booking

    /* ---- Atomic seat claim ----
       BEFORE: read seats_taken → compare to seats → UPDATE seats_taken + 1. Two
       students hitting "Réserver" on the last seat both read 19 of 20, both passed,
       both incremented → 21 bookings on a 20-seat class. Classic TOCTOU; on a
       "1ère séance gratuite" launch with a popular tutor it fires on day one.

       AFTER: the availability test IS the UPDATE's WHERE clause, evaluated by
       Postgres under a row lock. The loser matches zero rows and gets "full"
       instead of a phantom seat. Insert + claim + stats ride ONE transaction, so a
       failure anywhere (e.g. unique(class,student) on a double-submit) rolls back
       the seat too — no leaked seats.

       The transaction RETURNS its outcome rather than assigning to a captured
       variable: TypeScript cannot know a callback ran, so a captured
       `let outcome = "full"` stays narrowed to that literal and every later
       comparison becomes a compile error. */
    type SeatOutcome = "booked" | "already" | "full";
    let outcome: SeatOutcome;
    try {
      outcome = await db.transaction(async (tx): Promise<SeatOutcome> => {
        const [existing] = await tx
          .select()
          .from(bookings)
          .where(and(eq(bookings.classId, classId.value), eq(bookings.studentId, uid)))
          .limit(1);
        if (existing && existing.status !== "cancelled") return "already";

        const claimed = await tx
          .update(classes)
          .set({ seatsTaken: raw`coalesce(${classes.seatsTaken}, 0) + 1` })
          .where(
            and(
              eq(classes.id, classId.value),
              raw`coalesce(${classes.seatsTaken}, 0) < coalesce(${classes.seats}, 0)`,
            ),
          )
          .returning({ id: classes.id });
        if (claimed.length === 0) return "full"; // sold out — nobody oversells

        if (existing) {
          await tx.update(bookings).set({ status: "reserved" }).where(eq(bookings.id, existing.id));
        } else {
          await tx.insert(bookings).values({
            classId: classId.value,
            studentId: uid,
            /* THE ENFORCEMENT POINT for the opt-in free first session.
               Not Boolean(cls.isFreeFirst): that trusted a per-class flag alone,
               so a tutor who never opted in — or who opted OUT — could still have
               a booking written against them marked free, by a crafted request or
               simply by a class row left over from when the column defaulted to
               true. is_free on a booking is what decides whether money is owed;
               it does not get to be a UI detail. */
            isFree: isEffectivelyFreeFirst(tut.offersFreeFirstSession, cls.isFreeFirst),
            status: "reserved",
          });
        }

        /* students_count used to be a blind +1 per booking, so ONE student booking
           three classes advertised the tutor as having three students. Recompute
           the real distinct count instead — single statement, inside the tx. */
        await recomputeTutorStats(cls.tutorId, tx);
        return "booked";
      });
    } catch {
      /* unique(class_id, student_id) → a concurrent double-submit from the same
         student. The tx rolled back, so the seat was NOT consumed. Idempotent. */
      return { ok: true, already: true };
    }

    if (outcome === "already") return { ok: true, already: true };
    if (outcome === "full") return { ok: false, error: "full" };

    /* Notifications AFTER the commit. notify() never throws, and it does SMS I/O:
       running it inside the transaction would hold the seat lock open across a
       network round-trip, pinning one of the pool's connections. */
    const when = new Date(cls.scheduledAt);
    const whenLabel = when.toLocaleString("fr-FR", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });

    await notify(db, uid, {
      kind: "booking_confirmed",
      title: "Place réservée ✅",
      body: `${cls.title} — ${whenLabel}${tut ? ` avec ${tut.fullName}` : ""}.`,
      href: `/class/${cls.id}`,
      sms: `Tnajem : ta place pour « ${cls.title} » le ${whenLabel} est réservée. Lien de la séance dans ton espace élève.`,
    });
    if (tut?.profileId) {
      await notify(db, tut.profileId, {
        kind: "new_booking",
        title: "Nouvelle réservation 🎉",
        body: `${session.profile.fullName ?? "Un élève"} a réservé « ${cls.title} » (${whenLabel}).`,
        href: "/dashboard",
      });
    }

    /* seats_left just moved and the storefront caches it for 60s — a class the
       cache still shows as "3 places" is how a student reaches the checkout of a
       sold-out session. The web busts it from this envelope. */
    return { ok: true, revalidate: { tutors: [tut.slug] } };
  });

  /* ── POST /bookings/cancel ───────────────────────────────────────────────── */
  app.post("/bookings/cancel", async (req, reply) => {
    const parsed = cancelBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad-request" });

    const bookingId = vUuid(parsed.data.bookingId, { field: "booking" });
    if (!bookingId.ok) return { ok: false, error: "not-found" };

    const session = await getSession(req);
    if (!session) return { ok: false, error: "not-authenticated" };
    const uid = session.profile.id;

    const [bk] = await db.select().from(bookings).where(eq(bookings.id, bookingId.value)).limit(1);
    if (!bk) return { ok: false, error: "not-found" };
    // IDOR guard: a booking id is a bare uuid, so ownership must be checked.
    if (bk.studentId !== uid) return { ok: false, error: "forbidden" };
    if (bk.status === "cancelled") return { ok: true }; // idempotent

    const [cls] = await db.select().from(classes).where(eq(classes.id, bk.classId)).limit(1);
    if (!cls) return { ok: false, error: "not-found" };

    // Server time, never the client's.
    const startsInMs = new Date(cls.scheduledAt).getTime() - Date.now();
    if (startsInMs < CANCEL_WINDOW_MS) return { ok: false, error: "too-late" };

    const [tut] = await db.select().from(tutors).where(eq(tutors.id, cls.tutorId)).limit(1);

    /* Atomic seat release, mirroring the claim: the "still active?" test is the
       UPDATE's WHERE clause with RETURNING, so only ONE writer can decrement.
       Two concurrent cancels of the same booking would otherwise both pass a plain
       read and both give the seat back — freeing a seat that never existed. */
    const released = await db.transaction(async (tx) => {
      const rows = await tx
        .update(bookings)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(bookings.id, bookingId.value),
            /* coalesce(...,'reserved'), matching the original exactly: a NULL status
               is a live booking, and `status <> 'cancelled'` is NULL-false in SQL —
               which would silently refuse to release those seats. */
            raw`coalesce(${bookings.status}, 'reserved') <> 'cancelled'`,
          ),
        )
        .returning({ id: bookings.id });
      if (rows.length === 0) return false; // someone else already cancelled it

      await tx
        .update(classes)
        .set({ seatsTaken: raw`greatest(coalesce(${classes.seatsTaken}, 0) - 1, 0)` })
        .where(eq(classes.id, cls.id));

      await recomputeTutorStats(cls.tutorId, tx);
      return true;
    });

    if (!released) return { ok: true }; // already cancelled — idempotent

    if (tut?.profileId) {
      const when = new Date(cls.scheduledAt);
      const whenLabel = when.toLocaleString("fr-FR", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
      });
      await notify(db, tut.profileId, {
        kind: "booking_cancelled",
        title: "Annulation",
        body: `${session.profile.fullName ?? "Un élève"} a annulé sa place pour « ${cls.title} » (${whenLabel}). La place est de nouveau libre.`,
        href: "/dashboard",
      });
    }

    return { ok: true, revalidate: tut?.slug ? { tutors: [tut.slug] } : undefined };
  });

  /* ── GET /student/dashboard ──────────────────────────────────────────────
     Transcribed from getStudentDashboard. My first draft of this invented fields
     (reviewCount, tutorSlug, durationMin) and keyed on the BOOKING status where the
     original uses the CLASS status — caught by reading the original rather than
     trusting the draft. The shape below is exactly what StudentDashboard declares. */
  app.get("/student/dashboard", async (req): Promise<StudentDashboard | null> => {
    const session = await getSession(req);
    if (!session) return null;
    const uid = session.profile.id;

    const rows = await db
      .select({
        bookingId: bookings.id,
        isFree: bookings.isFree,
        classId: classes.id,
        title: classes.title,
        scheduledAt: classes.scheduledAt,
        status: classes.status,
        meetUrl: classes.meetUrl,
        replayUrl: classes.replayUrl,
        tutorName: tutors.fullName,
      })
      .from(bookings)
      .innerJoin(classes, eq(bookings.classId, classes.id))
      .innerJoin(tutors, eq(classes.tutorId, tutors.id))
      // Cancelled reservations disappear from the list — the seat is back on sale.
      .where(and(eq(bookings.studentId, uid), ne(bookings.status, "cancelled")))
      .orderBy(desc(classes.scheduledAt))
      .limit(300); // one join, bounded — no per-booking query

    const items = rows.map((r) => {
      const d = new Date(r.scheduledAt);
      return {
        bookingId: r.bookingId,
        classId: r.classId,
        title: r.title,
        tutorName: r.tutorName,
        day: String(d.getDate()),
        month: MONTHS_FR[d.getMonth()] ?? "",
        time: d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        ts: d.getTime(),
        isFree: Boolean(r.isFree),
        status: r.status ?? "scheduled",
        // Never blank: falls back to the room derived from the class id.
        meetUrl: resolveMeetUrl({ id: r.classId, meetUrl: r.meetUrl }),
        replayUrl: r.replayUrl ?? undefined,
      };
    });

    /* Keep a class "upcoming" for ~2h past its start: one that began 40 minutes ago
       is still the one the student is IN, and moving it to "past" mid-session takes
       the Join button away from someone sitting in the room. */
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    const upcoming = items.filter((i) => i.ts >= cutoff).sort((a, b) => a.ts - b.ts);
    const past = items.filter((i) => i.ts < cutoff).sort((a, b) => b.ts - a.ts);
    return { upcoming, past };
  });
}
