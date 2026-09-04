import { eq, sql as raw, bookings, classes, reviews, tutors } from "@tnajem/db";
import { db } from "../db";

/* Recompute a tutor's public stats from real rows — never a fabricated number.

   ══════════════════════════════════════════════════════════════════════════════
   THIS MOVED BEFORE ITS CALLERS, DELIBERATELY.
   ══════════════════════════════════════════════════════════════════════════════
   reserveSeat, cancelBooking and createReview all call this INSIDE their
   db.transaction. If it had stayed on the web side while reserveSeat moved here,
   the seat claim and the stats update would stop sharing a transaction — and the
   lost-update race this function's shape exists to prevent would come straight
   back, reintroduced by the refactor rather than by a code change.

   Hence the governing rule for the rest of Step 4: an action and every function
   it calls inside a transaction move together, in one commit, always.

   The single UPDATE with correlated subqueries is also load-bearing. Computing
   these in JS and writing the result back is a read-then-write: two concurrent
   bookings would both read the old count and both write the same new one, losing
   one. Postgres evaluates the subqueries against the transaction's own snapshot,
   so the arithmetic never leaves the database. */

/** Any drizzle handle — the caller passes its transaction so the write joins it. */
type Updater = Pick<typeof db, "update">;

export async function recomputeTutorStats(
  tutorId: string,
  tx: Updater = db,
): Promise<void> {
  await tx
    .update(tutors)
    .set({
      rating: raw`coalesce((
        select round(avg(${reviews.rating})::numeric, 1)
        from ${reviews} where ${reviews.tutorId} = ${tutorId}
      ), 0)`,
      studentsCount: raw`(
        select count(distinct ${bookings.studentId})::int
        from ${bookings}
        join ${classes} on ${bookings.classId} = ${classes.id}
        where ${classes.tutorId} = ${tutorId} and ${bookings.status} <> 'cancelled'
      )`,
    })
    .where(eq(tutors.id, tutorId));
}
