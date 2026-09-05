-- 0008 — the free first session becomes OPT-IN, per tutor, default OFF.
--
-- WHAT WAS TRUE BEFORE THIS FILE
--   classes.is_free_first  boolean  NULL  DEFAULT true
--
-- There was no tutor-level column at all, and the per-class one defaulted to
-- true. So the platform promised a free first session on behalf of every tutor
-- who never touched the checkbox — and told students so on the storefront, in
-- the JSON-LD Offer, in the meta description and in llms.txt. Terms §5 has
-- always said a tutor "peut choisir"; the product never let them. This file is
-- the database half of closing that gap.
--
-- THE EFFECTIVE RULE, after this migration, is an AND of two columns:
--
--     tutors.offers_free_first_session  AND  classes.is_free_first
--
-- Two columns rather than one because they answer different questions. The tutor
-- one is a policy — "do I ever give a first session away?" — and is the master
-- switch a student-facing claim must be gated on. The class one stays a
-- per-listing detail, so a tutor who opts in can still run a paid intensive.
-- Collapsing them into one would force a tutor to re-decide on every class, and
-- collapsing the other way would lose the per-class choice that already exists.
--
-- WHY BOTH ARE BACKFILLED TO false, INCLUDING ROWS THAT SAY true TODAY
--
-- A stored `true` is not evidence a tutor chose anything: it is what the column
-- defaulted to. There is no way to tell "ticked the box" from "never saw it",
-- and the two must not be guessed at, because the guess is a promise about money
-- made to a student. Backfilling to false can only ever UNDER-promise; leaving
-- the trues would keep a claim nobody made. A tutor who does want to offer it
-- turns it on and says so themselves — which is the entire point of the change.
--
-- This is data loss in the narrow sense that three dev classes lose an
-- is_free_first value. It is deliberate, it is stated here, and there are no
-- real users yet (7 tutors, 3 classes, 1 booking, all seeded during development).
--
-- NOT NULL on both. Nullable made "not set" and "declined" indistinguishable,
-- and every read site then had to invent a meaning for null — which is exactly
-- how a default of true turned into a claim on 30-odd screens.
--
-- IDEMPOTENT: every statement is guarded, and re-running is a no-op. Note the
-- backfill is guarded on the COLUMN not existing yet — replaying it
-- unconditionally would silently switch off any tutor who had since opted in.

BEGIN;

-- ── tutors.offers_free_first_session ─────────────────────────────────────────
ALTER TABLE "tutors"
  ADD COLUMN IF NOT EXISTS "offers_free_first_session" boolean NOT NULL DEFAULT false;

-- ── classes.is_free_first ────────────────────────────────────────────────────
-- The one-time backfill runs ONLY on the first application of this file. After
-- that the column is already NOT NULL, and re-running must not touch a single
-- row: by then the values are real tutor decisions.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'classes'
       AND column_name = 'is_free_first'
       AND is_nullable = 'YES'
  ) THEN
    -- Everything to false: see "WHY BOTH ARE BACKFILLED" above.
    UPDATE "classes" SET "is_free_first" = false WHERE "is_free_first" IS DISTINCT FROM false;
  END IF;
END $$;

ALTER TABLE "classes" ALTER COLUMN "is_free_first" SET DEFAULT false;
ALTER TABLE "classes" ALTER COLUMN "is_free_first" SET NOT NULL;

COMMIT;
