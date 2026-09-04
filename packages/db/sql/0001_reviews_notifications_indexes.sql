-- 0001 — pilot schema: reviews + notifications tables, and the performance indexes.
--
-- WHY THIS FILE EXISTS (do not delete it):
-- `drizzle-kit push` (0.28.x) is NOT compatible with PostgreSQL 17. PG17 stores
-- NOT NULL as *named* catalog constraints; drizzle-kit 0.28 doesn't know that, sees
-- constraints it didn't author, and emits `ALTER TABLE ... DROP CONSTRAINT
-- "<table>_<col>_not_null"` for ~60 columns. Postgres aborts the batch with
-- 42P16 ("column id is in a primary key") — which is the ONLY reason the rest of
-- that batch didn't run and quietly strip NOT NULL off most of the database.
--
-- So: apply schema changes with this file (`npm run db:sql`) instead of `db:push`,
-- until drizzle-kit is upgraded to a PG17-aware release.
--
-- Everything here is ADDITIVE and IDEMPOTENT — safe to run more than once.
-- It contains exactly the statements drizzle-kit itself generated, minus the
-- destructive DROP CONSTRAINT noise.

-- ── Tables ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "notifications" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "kind"       text NOT NULL,
  "title"      text NOT NULL,
  "body"       text NOT NULL,
  "href"       text,
  "read_at"    timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "reviews" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tutor_id"   uuid NOT NULL REFERENCES "tutors"("id")    ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "profiles"("id")  ON DELETE CASCADE,
  "class_id"   uuid          REFERENCES "classes"("id")   ON DELETE SET NULL,
  "rating"     integer NOT NULL,
  "text"       text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- One review per student per class. This is the correctness guarantee behind
  -- createReview()'s "already-reviewed" error — not just an index.
  CONSTRAINT "reviews_student_id_class_id_unique" UNIQUE("student_id","class_id")
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
-- Each one serves a real query (see SCALABILITY.md §1). Before these, the hot
-- auth lookups (sessions.token, profiles.phone, otp_codes.phone) were sequential
-- scans on every single authenticated request.

-- getNotifications / markNotificationsRead
CREATE INDEX IF NOT EXISTS "notifications_profile_id_created_at_idx" ON "notifications" USING btree ("profile_id","created_at");
CREATE INDEX IF NOT EXISTS "notifications_profile_id_read_at_idx"    ON "notifications" USING btree ("profile_id","read_at");

-- getTutorReviews (ORDER BY created_at DESC LIMIT 50 → backward index scan, no sort)
CREATE INDEX IF NOT EXISTS "reviews_tutor_id_created_at_idx"         ON "reviews"       USING btree ("tutor_id","created_at");

-- getStorefront + getDashboard
CREATE INDEX IF NOT EXISTS "packs_tutor_id_idx"                      ON "packs"         USING btree ("tutor_id");

-- Login path: 4 identifier lookups per sign-in, all seq scans before this.
-- Guarded on the COLUMN, not just the index name: 0005 renames otp_codes.phone
-- to .identifier (and renames this index with it), so on an already-migrated
-- database a bare CREATE INDEX here fails with 42703 and takes the whole replay
-- down. `IF NOT EXISTS` only checks the index name, which is not enough.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'otp_codes' AND column_name = 'phone'
  ) THEN
    CREATE INDEX IF NOT EXISTS "otp_codes_phone_idx" ON "otp_codes" USING btree ("phone");
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "otp_codes_expires_at_idx"                ON "otp_codes"     USING btree ("expires_at");

-- verifyOtp runs this on EVERY student login
CREATE INDEX IF NOT EXISTS "consents_minor_id_idx"                   ON "consents"      USING btree ("minor_id");

-- Session lookup + the expired-session purge
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx"                 ON "sessions"      USING btree ("expires_at");
CREATE INDEX IF NOT EXISTS "sessions_profile_id_idx"                 ON "sessions"      USING btree ("profile_id");

-- getStorefront (the page that goes viral) + getDashboard + class reminders
CREATE INDEX IF NOT EXISTS "classes_tutor_id_scheduled_at_idx"       ON "classes"       USING btree ("tutor_id","scheduled_at");
CREATE INDEX IF NOT EXISTS "classes_scheduled_at_idx"                ON "classes"       USING btree ("scheduled_at");

-- getStudentDashboard
CREATE INDEX IF NOT EXISTS "bookings_student_id_status_idx"          ON "bookings"      USING btree ("student_id","status");

-- /explore: WHERE status='verified' ORDER BY rating DESC
CREATE INDEX IF NOT EXISTS "tutors_status_rating_idx"                ON "tutors"        USING btree ("status","rating");

-- The hottest authenticated query: "which tutor is this signed-in profile?"
CREATE INDEX IF NOT EXISTS "tutors_profile_id_idx"                   ON "tutors"        USING btree ("profile_id");

-- Admin review queue + the 90-day ID-document retention purge
CREATE INDEX IF NOT EXISTS "verification_docs_tutor_id_idx"          ON "verification_docs" USING btree ("tutor_id");
