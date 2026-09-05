-- 0013 — classes.rescheduled_at, for Step 11 (a tutor moves or cancels a class).
--
-- ONE COLUMN, and it answers one question: "did the tutor move this class after
-- a given student booked it?"
--
-- A student who booked BEFORE this timestamp agreed to a time that no longer
-- exists. Measuring the 48h cancellation window against the NEW time would hold
-- them to a deadline for an appointment they never made, so they cancel free —
-- `waived` in packages/shared/src/cancellation.ts.
--
-- WHY NOT A PER-BOOKING FLAG: a reschedule would have to write to every booking
-- on the class, and the first time one of those writes failed the rows would
-- disagree with each other with nothing to reconcile them from. Comparing
-- bookings.created_at to a single timestamp on the class cannot drift.
--
-- NULLABLE, with no default: null means "never moved", which is true of every
-- class that exists today and is not the same as "moved at the epoch".
--
-- A CANCELLED class needs no new column — classes.status already has 'cancelled'.
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS.

BEGIN;

ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "rescheduled_at" timestamp with time zone;

COMMIT;
