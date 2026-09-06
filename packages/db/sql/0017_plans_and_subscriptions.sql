-- 0017 — plans, subscriptions and server-side entitlements (Step 16).
--
-- WHAT THIS TABLE IS, AND WHAT IT IS NOT.
-- `plans` is the catalogue of record and the FK target for a grant. It is NOT
-- what the server enforces: packages/shared/src/plans.ts is. Which plan a tutor
-- is on is data — an admin grants it, it expires, it differs per tutor. What a
-- plan GIVES you is a product decision, and a product decision has to ship with
-- the deploy that implements it. An UPDATE in psql must not be able to change
-- what every tutor on Pro is entitled to, with no diff and no review.
--
-- The seed below and the shared catalogue carry the same numbers, and a test
-- reads this table and compares it to that array. If either moves without the
-- other, the test fails — so the rows can never quietly become a lie to whoever
-- reads the database.
--
-- THE FK ON plan_code IS A REAL GUARDRAIL. Without it, granting 'pr0' would
-- store fine, resolve to no plan, and silently fall back to the DEFAULT — giving
-- a tutor less than the admin meant to give them, with no error anywhere.
--
-- ONE ACTIVE SUBSCRIPTION PER TUTOR, enforced by a partial unique index. Two
-- active rows would make "which plan am I on?" a question answered by whichever
-- row the planner happened to return first. Drizzle cannot express a WHERE-clause
-- index, so it lives here; schema.ts points at this file.
--
-- NOTHING HERE BILLS ANYONE. Payments are off (PAYMENTS_ENABLED unset). Prices
-- are stored because they are the final model and /tarifs publishes them as
-- future; no row in `subscriptions` implies a payment or a debt.
--
-- IDEMPOTENT throughout.

BEGIN;

DO $$
BEGIN
  CREATE TYPE "public"."subscription_status" AS ENUM('active', 'expired', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "plans" (
	"code" text PRIMARY KEY NOT NULL,
	-- Millimes, integer. 1 TND = 1000 millimes. Never a float, never numeric:
	-- money is an integer count of the smallest unit or it is a rounding bug.
	"monthly_millimes" integer NOT NULL,
	"yearly_millimes" integer NOT NULL,
	-- NULL = unlimited. Not 0, not -1: "no limit" is the absence of a limit.
	"max_classes" integer,
	"explore_boost" integer DEFAULT 0 NOT NULL,
	"listed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutor_id" uuid NOT NULL,
	"plan_code" text NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"granted_by" uuid,
	"note" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tutor_id_tutors_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_code_plans_code_fk" FOREIGN KEY ("plan_code") REFERENCES "public"."plans"("code") ON DELETE no action ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_granted_by_profiles_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "subscriptions_tutor_id_status_idx" ON "subscriptions" ("tutor_id","status");

-- THE GUARDRAIL. At most one live grant per tutor.
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_one_active_per_tutor"
  ON "subscriptions" ("tutor_id") WHERE "status" = 'active';

-- ── THE CATALOGUE ────────────────────────────────────────────────────────────
-- Upsert, not INSERT ... ON CONFLICT DO NOTHING: a price change in the shared
-- catalogue has to reach an existing database, or this table drifts into being
-- wrong the first time a number moves. `listed` and the entitlements are
-- overwritten for the same reason.
--
-- `pilot` is not listed. It is what every tutor is on while payments are off,
-- and it grants everything — which is exactly what /tarifs promises today.
-- Enforcing the Gratuit plan's 1-class limit while telling tutors nothing is
-- billed yet would be charging them in capability and calling it free.
INSERT INTO "plans" ("code", "monthly_millimes", "yearly_millimes", "max_classes", "explore_boost", "listed")
VALUES
  ('pilot',          0,      0, NULL, 0, false),
  ('gratuit',        0,      0,    1, 0, true),
  ('essentiel', 29000, 290000,    5, 0, true),
  ('pro',       59000, 590000, NULL, 1, true),
  ('prestige',  99000, 990000, NULL, 2, true)
ON CONFLICT ("code") DO UPDATE SET
  "monthly_millimes" = EXCLUDED."monthly_millimes",
  "yearly_millimes"  = EXCLUDED."yearly_millimes",
  "max_classes"      = EXCLUDED."max_classes",
  "explore_boost"    = EXCLUDED."explore_boost",
  "listed"           = EXCLUDED."listed";

COMMIT;
