-- 0011 — in-app messaging (Step 8b), the replacement channel for the contact
-- details Step 8 closed. Without it, "we removed the phone number" is a removal
-- rather than a redesign, and the pressure to work around the filter is entirely
-- on the users.
--
-- SCOPED TO A BOOKING, ENFORCED BY THE DATABASE. `message_threads.booking_id` is
-- UNIQUE and NOT NULL, so a thread cannot exist without a seat actually taken in
-- that tutor's class. No cold DMs, no way to address a stranger, and no reliance
-- on a check in application code that somebody later forgets on a new endpoint.
--
-- WHY NOT A THREAD PER (tutor, student) PAIR: it would outlive the booking that
-- justified it. One cancelled seat would leave a permanent private channel to a
-- minor, which is the exact shape of the problem this product cannot have.
--
-- student_is_minor IS SNAPSHOTTED, not recomputed from birth_year at read time. A
-- thread that began with a fifteen-year-old stays a minor's thread for its whole
-- retention life even after they turn eighteen — the messages in it were still
-- written to a child, and the retention and review rules follow the message, not
-- today's age.
--
-- ⚠ messages.body IS PLAIN TEXT AND MUST STAY THAT WAY. It is the product's only
-- stored-XSS surface: user-authored, persisted, and rendered to a DIFFERENT user.
-- Markup is stripped on the way in (apps/api) and React escapes on the way out.
-- If anyone ever renders this column through dangerouslySetInnerHTML, every
-- message becomes script injection against the person it was sent to.
--
-- ON DELETE: threads and messages CASCADE from the booking and the thread — the
-- conversation has no meaning without them. Sender and participant ids are SET
-- NULL, because deleting one account must not rewrite the other side's
-- conversation into a monologue. Step 15 anonymises rather than erases, for the
-- same reason it anonymises reviews rather than deleting them.
--
-- IDEMPOTENT: CREATE TABLE IF NOT EXISTS, guarded FKs, IF NOT EXISTS indexes.

BEGIN;

CREATE TABLE IF NOT EXISTS "message_threads" (
  "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "booking_id"         uuid NOT NULL,
  "class_id"           uuid NOT NULL,
  "tutor_profile_id"   uuid,
  "student_profile_id" uuid,
  "student_is_minor"   boolean DEFAULT false NOT NULL,
  "created_at"         timestamp with time zone DEFAULT now() NOT NULL,
  "last_message_at"    timestamp with time zone,
  CONSTRAINT "message_threads_booking_id_unique" UNIQUE("booking_id")
);

CREATE TABLE IF NOT EXISTS "messages" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "thread_id"         uuid NOT NULL,
  "sender_profile_id" uuid,
  "body"              text NOT NULL,
  "masked"            boolean DEFAULT false NOT NULL,
  "created_at"        timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "message_reports" (
  "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "message_id"           uuid NOT NULL,
  "reporter_profile_id"  uuid,
  "reason"               text,
  "created_at"           timestamp with time zone DEFAULT now() NOT NULL,
  -- One report per person per message: pressing the button twice is not two
  -- reports, and a moderation queue that double-counts is one nobody trusts.
  CONSTRAINT "message_reports_message_id_reporter_profile_id_unique"
    UNIQUE("message_id", "reporter_profile_id")
);

DO $$
BEGIN
  ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_booking_id_bookings_id_fk"
    FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_class_id_classes_id_fk"
    FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_tutor_profile_id_profiles_id_fk"
    FOREIGN KEY ("tutor_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_student_profile_id_profiles_id_fk"
    FOREIGN KEY ("student_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_message_threads_id_fk"
    FOREIGN KEY ("thread_id") REFERENCES "message_threads"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_profile_id_profiles_id_fk"
    FOREIGN KEY ("sender_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "message_reports" ADD CONSTRAINT "message_reports_message_id_messages_id_fk"
    FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "message_reports" ADD CONSTRAINT "message_reports_reporter_profile_id_profiles_id_fk"
    FOREIGN KEY ("reporter_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "message_threads_tutor_profile_id_idx"
  ON "message_threads" USING btree ("tutor_profile_id", "last_message_at");
CREATE INDEX IF NOT EXISTS "message_threads_student_profile_id_idx"
  ON "message_threads" USING btree ("student_profile_id", "last_message_at");
CREATE INDEX IF NOT EXISTS "messages_thread_id_created_at_idx"
  ON "messages" USING btree ("thread_id", "created_at");

COMMIT;
