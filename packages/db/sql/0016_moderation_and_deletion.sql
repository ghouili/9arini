-- 0016 — reporting, admin audit log, and self-service account deletion (Step 15).
--
-- THE TWO FOREIGN-KEY CHANGES AT THE BOTTOM ARE THE IMPORTANT PART. Both were
-- CASCADE, and both meant a person could erase somebody else's record by closing
-- their own account.
--
-- 1. reviews.student_id
--    A student deleting their account DELETED THEIR REVIEWS, silently rewriting a
--    tutor's rating and review count — downward, with no event anybody could see
--    and no way to explain the change. A tutor's public reputation is not the
--    student's to retract by leaving. The review now survives and loses its
--    author: publicDisplayName(null) is null, and the storefront already renders
--    an anonymous byline for exactly that case. This is what the plan means by
--    "anonymise reviews rather than delete".
--
-- 2. cancellations.booking_id
--    bookings.student_id cascades from a profile, so deleting an account deleted
--    the bookings and every ledger row hanging off them. A money ledger the
--    counterparty can erase by closing their account is not a ledger. The row now
--    survives carrying amounts and a class id and nothing that identifies a
--    person — actor_profile_id was already SET NULL. The UNIQUE constraint is
--    unaffected: Postgres does not treat NULLs as equal.
--
-- Rebuilding a foreign key is DROP + ADD, and the drop is guarded on the
-- constraint existing so a replay is a no-op. The columns are made nullable
-- first, because SET NULL on a NOT NULL column is a runtime error the day
-- somebody deletes an account, not a migration-time one — the worst possible
-- moment to find out.
--
-- REPORTS ARE WRITABLE WITHOUT AN ACCOUNT, deliberately. The person most likely
-- to need the button is a parent who found something on a public storefront and
-- has no login, or a student already driven off the platform by whatever they
-- are reporting. Requiring an account means the reports we most need never
-- arrive. reporter_profile_id and reporter_email are both nullable for the same
-- reason: a report nobody can follow up is still a signal.
--
-- ADMIN ACTIONS ARE APPEND-ONLY BY CONVENTION — there is no endpoint that deletes
-- from that table. admin_profile_id is SET NULL so the log outlives the admin: a
-- record of who did what that vanishes when they leave is not an audit log.
--
-- IDEMPOTENT throughout.

BEGIN;

DO $$
BEGIN
  CREATE TYPE "public"."deletion_status" AS ENUM('requested', 'cancelled', 'purged');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "public"."report_status" AS ENUM('open', 'actioned', 'dismissed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "public"."report_subject" AS ENUM('tutor', 'class', 'review', 'message', 'material', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "admin_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_profile_id" uuid,
	"action" text NOT NULL,
	"subject_kind" text,
	"subject_id" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_kind" "report_subject" NOT NULL,
	"subject_id" text,
	"reporter_profile_id" uuid,
	"reporter_email" text,
	"reason" text NOT NULL,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_admin_profile_id_profiles_id_fk" FOREIGN KEY ("admin_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_profile_id_profiles_id_fk" FOREIGN KEY ("reporter_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_profiles_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "admin_actions_admin_profile_id_created_at_idx" ON "admin_actions" USING btree ("admin_profile_id","created_at");

CREATE INDEX IF NOT EXISTS "admin_actions_subject_kind_subject_id_idx" ON "admin_actions" USING btree ("subject_kind","subject_id");

CREATE INDEX IF NOT EXISTS "reports_status_created_at_idx" ON "reports" USING btree ("status","created_at");

CREATE INDEX IF NOT EXISTS "reports_subject_kind_subject_id_idx" ON "reports" USING btree ("subject_kind","subject_id");

-- ── The two FK rebuilds ─────────────────────────────────────────────────────
-- Nullable FIRST. SET NULL against a NOT NULL column fails at DELETE time, which
-- is the moment an account is being erased — the worst place to discover it.
ALTER TABLE "reviews"        ALTER COLUMN "student_id" DROP NOT NULL;
ALTER TABLE "cancellations"  ALTER COLUMN "booking_id" DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_student_id_profiles_id_fk') THEN
    ALTER TABLE "reviews" DROP CONSTRAINT "reviews_student_id_profiles_id_fk";
  END IF;
END $$;

ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_student_id_profiles_id_fk"
  FOREIGN KEY ("student_id") REFERENCES "profiles"("id") ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cancellations_booking_id_bookings_id_fk') THEN
    ALTER TABLE "cancellations" DROP CONSTRAINT "cancellations_booking_id_bookings_id_fk";
  END IF;
END $$;

ALTER TABLE "cancellations"
  ADD CONSTRAINT "cancellations_booking_id_bookings_id_fk"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL;

-- ── Account deletion state ──────────────────────────────────────────────────
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "deletion_requested_at" timestamp with time zone;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "deletion_status" "deletion_status";

COMMIT;
