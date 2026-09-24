-- 0025 — birth MONTH on profiles (Phase A · A24, A14; decision D6: adult-only pilot).
--
-- The minor check used the birth YEAR alone, so a 17-year-old born later in the
-- year passed as 18 until 31 December. Sign-up (student and tutor) now collects
-- month + year, and @tnajem/shared isAdult() is fail-safe: adult only when the 18th
-- birthday fell in a month that is already over, in Africa/Tunis. A NULL month
-- counts as a minor.
--
-- HOW EXISTING ROWS ARE KEPT: the column is added NULLABLE with no default and no
-- back-fill. Every existing profile keeps exactly what it had (birth_year untouched)
-- and gets birth_month = NULL, which isAdult() treats as a minor — the fail-safe
-- direction. Nothing is rewritten, nothing is dropped. A student whose month is
-- unknown can supply it once at sign-in on /signup/eleve (verify fills an UNKNOWN
-- month only, and only for the birth year already on file).
--
-- Two CHECKs, both satisfied by every existing row (the column is NULL everywhere):
--   * 1..12 or NULL;
--   * an erased account (purged_at set) carries no birth month — the same promise
--     0022's profiles_purged_has_no_identity makes for birth_year. Added as its own
--     constraint so 0022's is not touched.
--
-- LEGAL-REVIEW: minimisation — a birth month + year is collected where a year
-- alone was, to enforce the adult-only pilot and the tutor age rule.
--
-- IDEMPOTENT. Additive only.
--
-- ROLLBACK (manual):
--   ALTER TABLE "profiles" DROP CONSTRAINT IF EXISTS "profiles_purged_has_no_birth_month";
--   ALTER TABLE "profiles" DROP CONSTRAINT IF EXISTS "profiles_birth_month_range";
--   ALTER TABLE "profiles" DROP COLUMN IF EXISTS "birth_month";

BEGIN;

ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "birth_month" integer;

DO $$
BEGIN
  ALTER TABLE "profiles"
    ADD CONSTRAINT "profiles_birth_month_range"
    CHECK ("birth_month" IS NULL OR ("birth_month" BETWEEN 1 AND 12));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "profiles"
    ADD CONSTRAINT "profiles_purged_has_no_birth_month"
    CHECK ("purged_at" IS NULL OR "birth_month" IS NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
