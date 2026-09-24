import { and, eq, sql as raw, bookings, cancellations, classes } from "@tnajem/db";
import { FREE_FIRST_SPENT_REASON } from "@tnajem/shared";
import { db } from "../db";

/* THE FREE FIRST SESSION, ONCE PER STUDENT PER TUTOR (D2) — the read side.

   Has this student still got their free first session with this tutor? No if they
   hold a live free booking with them, or spent it by cancelling a free seat late
   (the ledger reason the cancel handler writes; @tnajem/shared/free-first.ts says
   when it comes back).

   ONE implementation, two callers (phase-a/integrate):
     • POST /bookings — inside the seat-claim transaction, AFTER taking the
       (student, tutor) advisory lock, so the answer cannot race (routes/bookings.ts).
     • GET /classes/:id — outside any transaction, only to decide what the class
       page and checkout PROMISE. A page must not advertise "1ʳᵉ séance gratuite"
       to a student the booking would then charge. A stale answer there is
       harmless: the booking re-asks under the lock. */
type Reader = Pick<typeof db, "select">;

export async function freeFirstStillAvailable(q: Reader, studentId: string, tutorId: string): Promise<boolean> {
  const [held] = await q
    .select({ id: bookings.id })
    .from(bookings)
    .innerJoin(classes, eq(bookings.classId, classes.id))
    .where(
      and(
        eq(bookings.studentId, studentId),
        eq(classes.tutorId, tutorId),
        eq(bookings.isFree, true),
        raw`coalesce(${bookings.status}, 'reserved') <> 'cancelled'`,
      ),
    )
    .limit(1);
  if (held) return false;
  const [spent] = await q
    .select({ id: cancellations.id })
    .from(cancellations)
    .innerJoin(classes, eq(cancellations.classId, classes.id))
    .where(
      and(
        eq(cancellations.actorProfileId, studentId),
        eq(cancellations.actor, "student"),
        eq(classes.tutorId, tutorId),
        eq(cancellations.reason, FREE_FIRST_SPENT_REASON),
      ),
    )
    .limit(1);
  return !spent;
}
