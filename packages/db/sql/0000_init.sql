-- 0000 — the BASE SCHEMA. Every table, enum, index and foreign key.
--
-- WHY THIS EXISTS: 0001-0007 are all INCREMENTAL. They were written against a
-- database that drizzle-kit `db:push` had already created — and db:push is
-- deliberately blocked (not PG18-safe: it emits DROP CONSTRAINT for ~60 NOT NULL
-- columns). So the migration set could not build a database from nothing. A fresh
-- Postgres got as far as 0001 and died with
--
--     PostgresError: relation "profiles" does not exist
--
-- which means NO NEW ENVIRONMENT COULD BE PROVISIONED AT ALL — no staging, no
-- second region, no restore-from-empty. It stayed invisible for as long as every
-- run targeted the one hand-created development database; `docker compose up`
-- against an empty volume is what finally surfaced it.
--
-- Generated from packages/db/src/schema.ts with `drizzle-kit generate`. Tables
-- come out as CREATE TABLE IF NOT EXISTS and drizzle already wraps every foreign
-- key in its own duplicate_object guard; only CREATE TYPE needed wrapping by
-- hand, because Postgres has no IF NOT EXISTS for a type. Re-running this file on
-- an existing database is a no-op, which is the contract every file here holds to.
--
-- KEEP IT IN SYNC with schema.ts: regenerate and diff, never hand-edit the two
-- apart.

-- ── Legacy repair, before the constraints go on ──────────────────────────────
-- On a FRESH database everything below is a no-op: the tables do not exist yet
-- and this file creates them complete.
--
-- On the ORIGINAL development database it is not. `reviews` and `notifications`
-- were created by 0001, which declares their foreign keys INLINE — but the tables
-- already existed (drizzle-kit db:push had made them without constraints), so
-- `CREATE TABLE IF NOT EXISTS` was a silent no-op and the REFERENCES clauses were
-- never applied. The result: both tables had ZERO foreign keys, and 41 of 42
-- reviews and 325 of 334 notifications pointed at profiles that no longer exist.
--
-- That is not just untidy. The schema declares ON DELETE CASCADE, so deleting a
-- profile is supposed to remove their reviews and notifications with it. Without
-- the constraint it does not — personal data outlives the account that owned it,
-- which is precisely the guarantee Step 15 (self-service deletion) has to make.
--
-- to_regclass() returns NULL for a table that does not exist, so each block is
-- skipped entirely on a fresh database rather than erroring.

DO $$ BEGIN
  IF to_regclass('public.reviews') IS NOT NULL THEN
    DELETE FROM reviews r WHERE NOT EXISTS (SELECT 1 FROM tutors   t WHERE t.id = r.tutor_id);
    DELETE FROM reviews r WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = r.student_id);
    UPDATE reviews r SET class_id = NULL
     WHERE r.class_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM classes c WHERE c.id = r.class_id);
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.notifications') IS NOT NULL THEN
    DELETE FROM notifications n
     WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = n.profile_id);
  END IF;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."booking_status" AS ENUM('reserved', 'paid', 'attended', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "public"."class_status" AS ENUM('scheduled', 'live', 'done', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "public"."doc_kind" AS ENUM('id_front', 'id_back', 'selfie', 'diploma', 'certificate', 'role_proof', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "public"."pay_rail" AS ENUM('flouci', 'konnect', 'd17');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "public"."pay_status" AS ENUM('pending', 'paid', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "public"."payout_method" AS ENUM('flouci_wallet', 'bank_rib');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "public"."tutor_status" AS ENUM('draft', 'pending', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "public"."user_role" AS ENUM('tutor', 'student', 'guardian');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE TABLE IF NOT EXISTS "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"is_free" boolean DEFAULT false,
	"status" "booking_status" DEFAULT 'reserved',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_class_id_student_id_unique" UNIQUE("class_id","student_id")
);

CREATE TABLE IF NOT EXISTS "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutor_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"scheduled_at" timestamp with time zone NOT NULL,
	"duration_min" integer DEFAULT 90,
	"price_tnd" numeric(7, 2) DEFAULT '0' NOT NULL,
	"seats" integer DEFAULT 20,
	"seats_taken" integer DEFAULT 0,
	"is_free_first" boolean DEFAULT true,
	"meet_url" text,
	"whiteboard_url" text,
	"quiz_url" text,
	"replay_url" text,
	"status" "class_status" DEFAULT 'scheduled',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"minor_id" uuid NOT NULL,
	"guardian_name" text NOT NULL,
	"guardian_phone" text NOT NULL,
	"consent_text" text NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"href" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutor_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"price_tnd" numeric(7, 2) DEFAULT '0' NOT NULL,
	"file_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid,
	"pack_id" uuid,
	"payer_id" uuid,
	"amount_tnd" numeric(7, 2) NOT NULL,
	"platform_fee_tnd" numeric(7, 2) DEFAULT '0' NOT NULL,
	"rail" "pay_rail",
	"status" "pay_status" DEFAULT 'pending',
	"provider_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutor_id" uuid NOT NULL,
	"amount_tnd" numeric(7, 2) NOT NULL,
	"method" "payout_method" NOT NULL,
	"status" "pay_status" DEFAULT 'pending',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "user_role" DEFAULT 'student' NOT NULL,
	"full_name" text,
	"email" text,
	"phone" text,
	"locale" text DEFAULT 'fr' NOT NULL,
	"birth_year" integer,
	"level" text,
	"subjects" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_email_unique" UNIQUE("email"),
	CONSTRAINT "profiles_phone_unique" UNIQUE("phone")
);

CREATE TABLE IF NOT EXISTS "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inviter_id" uuid,
	"invitee_id" uuid,
	"code" text NOT NULL,
	"rewarded" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referrals_code_unique" UNIQUE("code")
);

CREATE TABLE IF NOT EXISTS "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutor_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"class_id" uuid,
	"rating" integer NOT NULL,
	"text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_student_id_class_id_unique" UNIQUE("student_id","class_id")
);

CREATE TABLE IF NOT EXISTS "sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"profile_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "tutors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid,
	"slug" text NOT NULL,
	"full_name" text NOT NULL,
	"subject" text NOT NULL,
	"level" text DEFAULT 'Bac',
	"bio" text,
	"avatar_url" text,
	"intro_video_url" text,
	"rating" numeric(2, 1) DEFAULT '0',
	"students_count" integer DEFAULT 0,
	"verified" boolean DEFAULT false,
	"status" "tutor_status" DEFAULT 'draft' NOT NULL,
	"experience_years" integer,
	"institution" text,
	"languages" text,
	"pitch" text,
	"linkedin_url" text,
	"instagram_url" text,
	"tiktok_url" text,
	"youtube_url" text,
	"facebook_url" text,
	"website_url" text,
	"submitted_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"payout_method" "payout_method",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tutors_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "verification_docs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutor_id" uuid NOT NULL,
	"kind" "doc_kind" NOT NULL,
	"file_name" text NOT NULL,
	"storage_path" text NOT NULL,
	"mime" text,
	"size_bytes" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_student_id_profiles_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "classes" ADD CONSTRAINT "classes_tutor_id_tutors_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "consents" ADD CONSTRAINT "consents_minor_id_profiles_id_fk" FOREIGN KEY ("minor_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "packs" ADD CONSTRAINT "packs_tutor_id_tutors_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_payer_id_profiles_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "payouts" ADD CONSTRAINT "payouts_tutor_id_tutors_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "referrals" ADD CONSTRAINT "referrals_inviter_id_profiles_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "referrals" ADD CONSTRAINT "referrals_invitee_id_profiles_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "reviews" ADD CONSTRAINT "reviews_tutor_id_tutors_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "reviews" ADD CONSTRAINT "reviews_student_id_profiles_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "reviews" ADD CONSTRAINT "reviews_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "tutors" ADD CONSTRAINT "tutors_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "verification_docs" ADD CONSTRAINT "verification_docs_tutor_id_tutors_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "bookings_student_id_status_idx" ON "bookings" USING btree ("student_id","status");
CREATE INDEX IF NOT EXISTS "classes_tutor_id_scheduled_at_idx" ON "classes" USING btree ("tutor_id","scheduled_at");
CREATE INDEX IF NOT EXISTS "classes_scheduled_at_idx" ON "classes" USING btree ("scheduled_at");
CREATE INDEX IF NOT EXISTS "consents_minor_id_idx" ON "consents" USING btree ("minor_id");
CREATE INDEX IF NOT EXISTS "notifications_profile_id_created_at_idx" ON "notifications" USING btree ("profile_id","created_at");
CREATE INDEX IF NOT EXISTS "notifications_profile_id_read_at_idx" ON "notifications" USING btree ("profile_id","read_at");
CREATE INDEX IF NOT EXISTS "otp_codes_identifier_idx" ON "otp_codes" USING btree ("identifier");
CREATE INDEX IF NOT EXISTS "otp_codes_expires_at_idx" ON "otp_codes" USING btree ("expires_at");
CREATE INDEX IF NOT EXISTS "packs_tutor_id_idx" ON "packs" USING btree ("tutor_id");
CREATE INDEX IF NOT EXISTS "rate_limits_reset_at_idx" ON "rate_limits" USING btree ("reset_at");
CREATE INDEX IF NOT EXISTS "reviews_tutor_id_created_at_idx" ON "reviews" USING btree ("tutor_id","created_at");
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");
CREATE INDEX IF NOT EXISTS "sessions_profile_id_idx" ON "sessions" USING btree ("profile_id");
CREATE INDEX IF NOT EXISTS "tutors_status_rating_idx" ON "tutors" USING btree ("status","rating");
CREATE INDEX IF NOT EXISTS "tutors_profile_id_idx" ON "tutors" USING btree ("profile_id");
CREATE INDEX IF NOT EXISTS "verification_docs_tutor_id_idx" ON "verification_docs" USING btree ("tutor_id");
