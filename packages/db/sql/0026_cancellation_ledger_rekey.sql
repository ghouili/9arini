-- 0026 — the cancellation ledger: one row per CANCELLATION, not one per booking.
-- (Phase A, lane L3, task A8.)
--
-- WHY: bookings is unique on (class_id, student_id), so re-booking a seat you
-- cancelled REACTIVATES the same bookings row. The ledger was UNIQUE on booking_id,
-- so the second cancellation of that row hit onConflictDoNothing and was never
-- written, while the student's screen reported a late cancellation. A ledger that
-- silently drops an event is not a ledger.
--
-- WHAT:
--   • drop the unique on booking_id;
--   • add a unique index on (booking_id, cancelled_at).
--   The row's existing uuid primary key (`id`) IS the cancellation id. The new
--   index keeps the original protection against a double-write of ONE
--   cancellation: cancelled_at defaults to now(), the transaction's start time, so
--   two inserts for one booking in one transaction still collide, while two
--   separate cancellations (two transactions) never do. booking_id stays the
--   leading column, so every `where booking_id = ?` the old unique served is still
--   an index lookup.
--
-- NO bookedAt COLUMN. Re-booking resets bookings.created_at to now() instead
-- (apps/api/src/routes/bookings.ts), which is exactly what the reschedule waiver
-- compares to classes.rescheduled_at. Nothing is added to bookings.
--
-- HOW EXISTING ROWS ARE KEPT: nothing is deleted, updated or rewritten. Every
-- existing row already satisfies the new index — the old unique allowed at most one
-- row per booking_id, and NULL booking_ids (ledger rows whose booking was erased,
-- 0016) never collide in a unique index.
--
-- IDEMPOTENT: DROP ... IF EXISTS / CREATE ... IF NOT EXISTS. db:sql re-runs every
-- file; 0009 is CREATE TABLE IF NOT EXISTS, so it never re-adds the old unique on an
-- existing table, and on a fresh database this file removes it again.
--
-- ROLLBACK (manual; valid only while no booking has two ledger rows):
--   DROP INDEX IF EXISTS "cancellations_booking_id_cancelled_at_unique";
--   ALTER TABLE "cancellations" ADD CONSTRAINT "cancellations_booking_id_unique" UNIQUE ("booking_id");

ALTER TABLE "cancellations" DROP CONSTRAINT IF EXISTS "cancellations_booking_id_unique";
-- In case a database ever carried it as a bare unique index rather than a constraint.
DROP INDEX IF EXISTS "cancellations_booking_id_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "cancellations_booking_id_cancelled_at_unique"
  ON "cancellations" USING btree ("booking_id", "cancelled_at");
