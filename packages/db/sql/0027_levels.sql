-- 0027 — school levels, as canonical codes (Phase A · A18.7, lane L5).
--
-- There was no level field anywhere. tutors.level (text, DEFAULT 'Bac') was never
-- written by any code path, so every tutor carried 'Bac' and was labelled "Bac".
--
--   tutors.levels  text[]  — the levels a tutor teaches, as codes from
--                            @tnajem/shared LEVEL_CODES: primaire · college ·
--                            secondaire · bac · universite. NOT NULL DEFAULT '{}'.
--   classes.level  text    — optional: the one level a class is for. Nullable.
--   tutors.level           — KEPT (never dropped), no longer defaulted to 'Bac'.
--
-- HOW EXISTING ROWS ARE KEPT
--   • No row loses anything: tutors.level keeps every value it holds; classes and
--     tutors only gain columns.
--   • tutors.levels is BACKFILLED from tutors.level where the value maps cleanly to
--     one code (e.g. 'Collège' → {college}, 'Lycée' → {secondaire}), and left empty
--     otherwise. The one exception is the exact string 'Bac': it is the column's
--     old DEFAULT, which no tutor ever chose (nothing wrote the column), so copying
--     it would re-create the very bug — every tutor labelled "Bac". Those tutors
--     keep level = 'Bac' untouched and simply have no levels until they pick them.
--   • The backfill runs ONCE, in the same block that creates the column, so a later
--     `npm run db:sql` never refills levels a tutor has since cleared.
--   • Dropping the 'Bac' default changes only rows inserted from now on.
--
-- IDEMPOTENT: every statement is guarded (IF NOT EXISTS / DROP DEFAULT).
--
-- ROLLBACK (manual):
--   ALTER TABLE "tutors"  DROP COLUMN IF EXISTS "levels";
--   ALTER TABLE "classes" DROP COLUMN IF EXISTS "level";
--   ALTER TABLE "tutors"  ALTER COLUMN "level" SET DEFAULT 'Bac';

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tutors' AND column_name = 'levels'
  ) THEN
    ALTER TABLE "tutors" ADD COLUMN IF NOT EXISTS "levels" text[] NOT NULL DEFAULT '{}'::text[];

    UPDATE "tutors" t
       SET "levels" = ARRAY[m.code]
      FROM (VALUES
        ('primaire', 'primaire'), ('ابتدائي', 'primaire'),
        ('collège', 'college'), ('college', 'college'), ('إعدادي', 'college'), ('اعدادي', 'college'),
        ('secondaire', 'secondaire'), ('lycée', 'secondaire'), ('lycee', 'secondaire'), ('ثانوي', 'secondaire'),
        ('bac', 'bac'), ('baccalauréat', 'bac'), ('باك', 'bac'), ('باكالوريا', 'bac'),
        ('université', 'universite'), ('universite', 'universite'), ('supérieur', 'universite'),
        ('superieur', 'universite'), ('جامعة', 'universite'), ('جامعي', 'universite')
      ) AS m(label, code)
     WHERE lower(btrim(t."level")) = m.label
       AND t."level" <> 'Bac';  -- the old column DEFAULT: never a tutor's choice
  END IF;
END $$;

ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "level" text;

ALTER TABLE "tutors" ALTER COLUMN "level" DROP DEFAULT;

COMMIT;
