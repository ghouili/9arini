import { eq, sql as raw, bookings, classes, messageThreads, tutors } from "@tnajem/db";
import { THREAD_CLOSE_DAYS, type ThreadState } from "@tnajem/shared";
import { db } from "../db";

/* threadState — THE ONE PLACE that decides whether a conversation is open
   (phase-a lane L1, A2; CEO report finding 2).

   Sending used to be refused only when the booking was cancelled, so a thread
   outlived everything else: a tutor could keep writing to a minor through a
   months-old class, after the parent withdrew consent, after either account was
   blocked. POST /threads/:id/messages now asks this function and sends only on
   "open". The thread views call it too, so the UI can show the closed banner.

   One query, evaluated at the moment of asking and on the SERVER's clock — so a
   withdrawal or a block closes the thread on the very next send, with no job to
   run and nothing to back-fill. Reasons, most serious first:

     blocked            either profile has blocked_at (0019), or the tutor's
                        storefront is suspended (set with a block, and on erasure)
     consent-withdrawn  the student's consent is withdrawn (0023) and none stands.
                        A withdrawn consent is "no consent everywhere"; this is
                        where messaging starts agreeing with booking.
     booking-cancelled  the seat was given up (the rule that was already here)
     class-ended        THREAD_CLOSE_DAYS (FOUNDER default 7) after start + duration

   CLOSED IS NOT DELETED: reading and reporting do not consult this. */
export async function threadState(threadId: string): Promise<ThreadState> {
  const [row] = await db
    .select({
      bookingStatus: bookings.status,
      blocked: raw<boolean>`(
        ${tutors.suspendedAt} is not null
        or exists (
          select 1 from profiles p
          where p.blocked_at is not null
            and p.id in (${messageThreads.tutorProfileId}, ${messageThreads.studentProfileId})
        )
      )`,
      consentWithdrawn: raw<boolean>`(
        exists (
          select 1 from consents k
          where k.minor_id = ${messageThreads.studentProfileId} and k.withdrawn_at is not null
        )
        and not exists (
          select 1 from consents k
          where k.minor_id = ${messageThreads.studentProfileId} and k.withdrawn_at is null
        )
      )`,
      ended: raw<boolean>`(
        ${classes.scheduledAt}
          + make_interval(mins => coalesce(${classes.durationMin}, 90))
          + make_interval(days => ${THREAD_CLOSE_DAYS}::int)
        <= now()
      )`,
    })
    .from(messageThreads)
    .innerJoin(bookings, eq(bookings.id, messageThreads.bookingId))
    .innerJoin(classes, eq(classes.id, messageThreads.classId))
    .innerJoin(tutors, eq(tutors.id, classes.tutorId))
    .where(eq(messageThreads.id, threadId))
    .limit(1);

  /* No row: the booking or the class is gone. Nothing to send into — the same
     answer the cancelled-booking check gave before this function existed. */
  if (!row) return "closed:booking-cancelled";
  if (row.blocked) return "closed:blocked";
  if (row.consentWithdrawn) return "closed:consent-withdrawn";
  if (row.bookingStatus === "cancelled") return "closed:booking-cancelled";
  if (row.ended) return "closed:class-ended";
  return "open";
}
