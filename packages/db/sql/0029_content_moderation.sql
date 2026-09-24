-- 0029 — content moderation + a verified tutor's rename under review (Phase A, lane L4).
--
-- A26 · tutors.pending_full_name
--   A verified tutor used to rename themselves with no review and keep the badge.
--   The requested name now waits here; tutors.full_name (what every public surface
--   reads) keeps the APPROVED name until an admin approves the new one, at which
--   point the API copies it across and clears this column. NULL = no rename pending.
--
-- IDEMPOTENT. Additive only: one nullable column, no default, no backfill, no
-- existing row is rewritten (every existing tutor simply has no pending rename).
--
-- MANUAL ROLLBACK (loses only renames still waiting for review):
--   ALTER TABLE "tutors" DROP COLUMN IF EXISTS "pending_full_name";

BEGIN;

ALTER TABLE "tutors" ADD COLUMN IF NOT EXISTS "pending_full_name" text;

COMMIT;
