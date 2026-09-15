-- 0023 — consent records carry a version, a date, and can be withdrawn
-- (production readiness, Stage 5).
--
-- consents.policy_version   the privacy-policy version the consent was given under
--                           (CONSENT_POLICY_VERSION, @tnajem/shared/legal). Rows signed
--                           before this file say 'unversioned' rather than a guess.
-- consents.signed_at        already existed; it is now REFRESHED whenever the consent
--                           is given again, instead of keeping the first date forever.
-- consents.withdrawn_at /   a guardian withdrawing consent. The row is kept (it is the
-- consents.withdrawn_by     record that consent was given, then withdrawn); a
--                           withdrawn consent counts as no consent everywhere.
-- profiles.terms_version /  the /terms version an account was created under, and when.
-- profiles.terms_accepted_at  Accounts created before this file have neither.
--
-- LEGAL-REVIEW: whether a consent entered by a minor on a guardian's behalf (self-
-- attested, unverified) is sufficient, and whether re-acceptance of a new terms
-- version is required, are open.
--
-- IDEMPOTENT. Additive only.

BEGIN;

ALTER TABLE "consents" ADD COLUMN IF NOT EXISTS "policy_version" text;
UPDATE "consents" SET "policy_version" = 'unversioned' WHERE "policy_version" IS NULL;
ALTER TABLE "consents" ALTER COLUMN "policy_version" SET NOT NULL;
ALTER TABLE "consents" ADD COLUMN IF NOT EXISTS "withdrawn_at" timestamp with time zone;
ALTER TABLE "consents" ADD COLUMN IF NOT EXISTS "withdrawn_by" uuid;
DO $$
BEGIN
  ALTER TABLE "consents"
    ADD CONSTRAINT "consents_withdrawn_by_profiles_id_fk"
    FOREIGN KEY ("withdrawn_by") REFERENCES "profiles"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "terms_version" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "terms_accepted_at" timestamp with time zone;

COMMIT;
