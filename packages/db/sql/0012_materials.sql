-- 0012 — teaching materials, copyright takedowns and strikes (Step 10).
--
-- Generated with `drizzle-kit generate` from packages/db/src/schema.ts, then made
-- idempotent: drizzle already wraps foreign keys in a duplicate_object guard and
-- emits IF NOT EXISTS for tables and indexes, so only CREATE TYPE needed wrapping
-- by hand. Same treatment as 0000.
--
-- ⚠ FILES NEVER GO IN public/. materials.storage_path points under STORAGE_DIR,
-- exactly like an identity document, and the only reader is an endpoint that
-- makes an access decision first. A static directory cannot ask "did this student
-- book the class?", so serving a `students`-visibility worksheet from one would
-- make the visibility column a decoration.
--
-- VIDEOS STORE AN ID, NOT A URL. parseYouTubeId (@tnajem/shared) normalises the
-- half-dozen shapes people paste down to 11 characters. A stored URL is a stored
-- redirect that some future surface renders as a link; an id can only ever be
-- embedded, and only through youtube-nocookie, so no tracking cookie is set on a
-- page a fifteen-year-old is reading.
--
-- VISIBILITY DEFAULTS TO `students`, not `public`. A tutor uploading a worksheet
-- is far more likely to mean "for the people in my class" than "for the internet",
-- and the safe default is the one that cannot surprise them.
--
-- TAKEDOWN IS A SOFT REMOVAL (materials.removed_at), never a DELETE. A copyright
-- dispute needs a record that the thing existed and was acted on; an upheld claim
-- that leaves no trace is indistinguishable from one that was never made. Every
-- read path filters on removed_at IS NULL.
--
-- THE TAKEDOWN WRITE PATH IS UNAUTHENTICATED, deliberately. A rights-holder is
-- almost never a user of this site, and requiring them to sign up to file a claim
-- is the same as not having a process at all. Hence claimant_name/claimant_email
-- as free text and a nullable reporter_profile_id.
--
-- ONE STRIKE PER UPHELD TAKEDOWN, enforced by unique(takedown_id): a moderator
-- refreshing the queue twice must not double a tutor's count. Strikes are COUNTED,
-- not enforced automatically — an automatic threshold would take someone's
-- livelihood off the platform with no human in the loop, and a wrong strike would
-- do it silently. Step 15 builds the surface that acts on them.

BEGIN;

DO $$
BEGIN
  CREATE TYPE "public"."material_kind" AS ENUM('file', 'youtube');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "public"."material_visibility" AS ENUM('public', 'students', 'private');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "public"."takedown_status" AS ENUM('open', 'upheld', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "material_takedowns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" uuid NOT NULL,
	"reporter_profile_id" uuid,
	"claimant_name" text NOT NULL,
	"claimant_email" text NOT NULL,
	"reason" text NOT NULL,
	"status" "takedown_status" DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutor_id" uuid NOT NULL,
	"class_id" uuid,
	"kind" "material_kind" NOT NULL,
	"visibility" "material_visibility" DEFAULT 'students' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"storage_path" text,
	"file_name" text,
	"mime" text,
	"size_bytes" integer,
	"youtube_id" text,
	"removed_at" timestamp with time zone,
	"removed_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "tutor_strikes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutor_id" uuid NOT NULL,
	"takedown_id" uuid,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tutor_strikes_takedown_id_unique" UNIQUE("takedown_id")
);

DO $$ BEGIN
 ALTER TABLE "material_takedowns" ADD CONSTRAINT "material_takedowns_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "material_takedowns" ADD CONSTRAINT "material_takedowns_reporter_profile_id_profiles_id_fk" FOREIGN KEY ("reporter_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "material_takedowns" ADD CONSTRAINT "material_takedowns_resolved_by_profiles_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "materials" ADD CONSTRAINT "materials_tutor_id_tutors_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "materials" ADD CONSTRAINT "materials_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "tutor_strikes" ADD CONSTRAINT "tutor_strikes_tutor_id_tutors_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "tutor_strikes" ADD CONSTRAINT "tutor_strikes_takedown_id_material_takedowns_id_fk" FOREIGN KEY ("takedown_id") REFERENCES "public"."material_takedowns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "material_takedowns_material_id_idx" ON "material_takedowns" USING btree ("material_id");

CREATE INDEX IF NOT EXISTS "material_takedowns_status_created_at_idx" ON "material_takedowns" USING btree ("status","created_at");

CREATE INDEX IF NOT EXISTS "materials_tutor_id_idx" ON "materials" USING btree ("tutor_id","created_at");

CREATE INDEX IF NOT EXISTS "materials_class_id_idx" ON "materials" USING btree ("class_id");

CREATE INDEX IF NOT EXISTS "tutor_strikes_tutor_id_idx" ON "tutor_strikes" USING btree ("tutor_id","created_at");

COMMIT;
