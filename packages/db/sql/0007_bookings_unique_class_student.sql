-- 0007 — the UNIQUE(class_id, student_id) index on bookings that was declared but
-- never created.
--
-- WHY THIS MATTERS: packages/db/src/schema.ts declares `uniqClassStudent`, and
-- SCALABILITY.md documents it as "what makes reserveSeat idempotent -- it catches
-- the conflict instead of double-booking". The index was never applied to the
-- database, because db:push is deliberately blocked and no SQL migration ever
-- created it. So the guarantee the booking code is written around did not exist.
--
-- The observable bug, reproduced before this migration: six simultaneous POSTs
-- from ONE student against a 5-seat class produced FIVE bookings and consumed
-- FIVE seats. One student could drain a class on their own.
--
-- The sequential case always looked fine, which is why this survived: the
-- in-transaction "already booked?" SELECT catches a second click that arrives
-- after the first has committed. It is the CONCURRENT case that leaks -- a
-- double-tap on a slow phone, which is exactly the real-world scenario on the 3G
-- connections this product targets.
--
-- reviews(student_id, class_id) DOES have its unique index, so createReview's
-- "already-reviewed" path was never affected. Only bookings was missing.
--
-- SAFETY: dedupe first. CREATE UNIQUE INDEX fails outright if duplicates exist,
-- and this file has to be re-runnable. Keeping the OLDEST row per pair preserves
-- the booking the student actually made first; any later duplicates were seats
-- that should never have been issued.

DELETE FROM bookings a
 USING bookings b
 WHERE a.class_id = b.class_id
   AND a.student_id = b.student_id
   AND a.created_at > b.created_at;

-- Tie-break on id for rows sharing a created_at to the microsecond.
DELETE FROM bookings a
 USING bookings b
 WHERE a.class_id = b.class_id
   AND a.student_id = b.student_id
   AND a.created_at = b.created_at
   AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS "bookings_class_id_student_id_unique"
    ON "bookings" USING btree ("class_id", "student_id");

-- NOTE for the seat counter: this index stops NEW duplicates. It does not repair
-- a seats_taken value that was already inflated by one. recomputeTutorStats
-- recounts students from real rows on every booking and cancellation, and
-- seats_taken is corrected by the atomic claim/release path from here on.
