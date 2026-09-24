-- 0029 — content moderation + a verified tutor's rename under review (Phase A, lane L4).
--
-- A26 · tutors.pending_full_name
--   A verified tutor used to rename themselves with no review and keep the badge.
--   The requested name now waits here; tutors.full_name (what every public surface
--   reads) keeps the APPROVED name until an admin approves the new one, at which
--   point the API copies it across and clears this column. NULL = no rename pending.
--
-- A28 · messages / reviews: hidden_at, hidden_by, hidden_reason
--   /terms says "Nous pouvons retirer un contenu"; admins could only close a report.
--   An admin can now HIDE a message or a review from the moderation queue. A soft
--   delete: body/text stay as evidence and admins still read them; everyone else
--   sees "Contenu retiré par la modération". hidden_by → the admin (SET NULL if that
--   profile goes), hidden_reason → why (required by the API). NULL hidden_at = shown.
--
-- IDEMPOTENT. Additive only: nullable columns, no default, no backfill, no existing
-- row is rewritten (every tutor has no pending rename, nothing is hidden).
--
-- MANUAL ROLLBACK (loses only pending renames, and un-hides hidden content):
--   ALTER TABLE "tutors" DROP COLUMN IF EXISTS "pending_full_name";
--   ALTER TABLE "messages" DROP COLUMN IF EXISTS "hidden_at", DROP COLUMN IF EXISTS "hidden_by", DROP COLUMN IF EXISTS "hidden_reason";
--   ALTER TABLE "reviews"  DROP COLUMN IF EXISTS "hidden_at", DROP COLUMN IF EXISTS "hidden_by", DROP COLUMN IF EXISTS "hidden_reason";

BEGIN;

ALTER TABLE "tutors" ADD COLUMN IF NOT EXISTS "pending_full_name" text;

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "hidden_at" timestamp with time zone;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "hidden_by" uuid;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "hidden_reason" text;
DO $$
BEGIN
  ALTER TABLE "messages"
    ADD CONSTRAINT "messages_hidden_by_profiles_id_fk"
    FOREIGN KEY ("hidden_by") REFERENCES "profiles"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "hidden_at" timestamp with time zone;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "hidden_by" uuid;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "hidden_reason" text;
DO $$
BEGIN
  ALTER TABLE "reviews"
    ADD CONSTRAINT "reviews_hidden_by_profiles_id_fk"
    FOREIGN KEY ("hidden_by") REFERENCES "profiles"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
