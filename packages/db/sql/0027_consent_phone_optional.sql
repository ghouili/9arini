-- 0027 (a) — the guardian's phone is no longer required (Phase A · A18.2, lane L5).
--
-- The consent form asked the child for their guardian's phone, required it, stored
-- it, and never used it for anything: login is e-mail OTP and the guardian's
-- account resolves from guardian_email (0015). Data minimisation: the form no
-- longer collects it and the API accepts a consent without one. Such a consent
-- stores NULL — "not collected" — rather than an empty placeholder.
--
-- The column was created NOT NULL in 0000_init. This relaxes that constraint and
-- nothing else.
--
-- HOW EXISTING ROWS ARE KEPT: untouched. No row is updated or deleted; every phone
-- already on file stays exactly as it is (its retention is A27's / the lawyer's
-- question, not this migration's). Only future rows may carry NULL.
--
-- LEGAL-REVIEW: whether consent records already holding a guardian phone should be
-- purged of it (data minimisation) — not decided here, nothing is erased.
--
-- IDEMPOTENT: DROP NOT NULL on a nullable column is a no-op.
--
-- ROLLBACK (manual, only if no NULL was written yet — otherwise fill them first):
--   UPDATE "consents" SET "guardian_phone" = '' WHERE "guardian_phone" IS NULL;
--   ALTER TABLE "consents" ALTER COLUMN "guardian_phone" SET NOT NULL;

BEGIN;

ALTER TABLE "consents" ALTER COLUMN "guardian_phone" DROP NOT NULL;

COMMIT;
