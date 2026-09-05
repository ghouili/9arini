-- 0009 — the cancellation ledger, for the 48h / 40% rule.
--
-- WHAT CHANGES IN BEHAVIOUR (the migration itself only adds a table, but this is
-- the file people will read to find out why):
--
--   BEFORE  cancelBooking refused inside 24 hours — `too-late`. No seat released,
--           no record kept, and the student was told to message their tutor. The
--           seat stayed locked to someone who was not coming, so the tutor could
--           not resell it and ran the class a head short.
--   AFTER   a late cancellation SUCCEEDS. The seat returns to the pool at once
--           and 40% of the seat's value is recorded as retained for the tutor.
--
-- So this LOOSENS a restriction. Late cancellation becomes newly possible, not
-- newly punished.
--
-- ⚠ NOTHING IS CHARGED. Payments are off (paymentsEnabled() is false unless
-- PAYMENTS_ENABLED="1"), Tnajem holds no money, and no student is debited by
-- anything here. retained_tnd is what WOULD be retained. The payments_enabled
-- column records the state at write time so that, the day payments open, a
-- reader can still tell every historical "would have been" row from a real one.
-- Dropping that column would make the whole table ambiguous in retrospect.
--
-- WHY UNIQUE ON booking_id: a booking is cancelled once. The endpoint is
-- idempotent and the status flip is atomic, but two concurrent cancels racing
-- past the ledger insert would write two rows and double the retained amount.
-- That is exactly the bug 0007 fixed on bookings, and it is cheaper to prevent
-- here than to reconcile later.
--
-- WHY retained_pct IS STORED: if the rate ever moves off 40%, history must keep
-- the rate that was actually applied. A ledger that recomputes itself from
-- today's constant is not a ledger.
--
-- MONEY IS numeric(7,2) THROUGHOUT, matching classes.price_tnd exactly, so an
-- amount survives the round trip. retained + released = amount is an invariant
-- the application guarantees by computing released as the remainder rather than
-- rounding twice (see packages/shared/src/cancellation.ts).
--
-- IDEMPOTENT: guarded CREATE TYPE, CREATE TABLE IF NOT EXISTS, and FKs added
-- only when absent. Re-running is a no-op.

BEGIN;

DO $$
BEGIN
  CREATE TYPE "cancel_actor" AS ENUM ('student', 'tutor', 'system');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "cancellations" (
  "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "booking_id"         uuid NOT NULL,
  "class_id"           uuid NOT NULL,
  "actor_profile_id"   uuid,
  "actor"              "cancel_actor" NOT NULL,
  "cancelled_at"       timestamp with time zone DEFAULT now() NOT NULL,
  "hours_before_start" numeric(10, 2) NOT NULL,
  "late"               boolean NOT NULL,
  "amount_tnd"         numeric(7, 2) DEFAULT '0' NOT NULL,
  "retained_tnd"       numeric(7, 2) DEFAULT '0' NOT NULL,
  "released_tnd"       numeric(7, 2) DEFAULT '0' NOT NULL,
  "retained_pct"       numeric(4, 3) DEFAULT '0' NOT NULL,
  "payments_enabled"   boolean DEFAULT false NOT NULL,
  "reason"             text,
  "created_at"         timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "cancellations_booking_id_unique" UNIQUE("booking_id")
);

-- Foreign keys, guarded. ON DELETE CASCADE from booking and class: the ledger row
-- describes that booking, and it cannot outlive it meaningfully. SET NULL on the
-- actor: Step 15 deletes accounts, and a tutor's record of what happened must not
-- disappear because the student closed theirs.
DO $$
BEGIN
  ALTER TABLE "cancellations"
    ADD CONSTRAINT "cancellations_booking_id_bookings_id_fk"
    FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "cancellations"
    ADD CONSTRAINT "cancellations_class_id_classes_id_fk"
    FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "cancellations"
    ADD CONSTRAINT "cancellations_actor_profile_id_profiles_id_fk"
    FOREIGN KEY ("actor_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "cancellations_class_id_idx"         ON "cancellations" USING btree ("class_id");
CREATE INDEX IF NOT EXISTS "cancellations_actor_profile_id_idx" ON "cancellations" USING btree ("actor_profile_id");

COMMIT;
