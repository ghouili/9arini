-- 0004 — student profile fields (the student half of onboarding).
--
-- WHY: `profiles.full_name` was only ever written by createTutor(), so every
-- STUDENT was permanently nameless. The visible cost of that, before this change:
--   • the tutor's dashboard listed every booking as "Élève" + a raw phone number —
--     for a minor, that phone was the tutor's ONLY identifier for the child
--   • the new_booking notification read "Un élève a réservé …", always
--   • public reviews shipped with no author (publicName(null) → null)
-- /student/welcome now collects a name on first login and saveStudentProfile()
-- writes it, which fixes all three surfaces at once with no further change.
--
-- `level` and `subjects` back the same screen: school level drives the tutor
-- matching we want on /explore, and subjects is a comma-joined list — the same
-- shape `tutors.languages` already uses, deliberately, so we don't introduce a
-- second convention for "a short list of tags" in one schema.
--
-- Both columns are NULLABLE with no default: a student who skips the screen (the
-- skip link exists so onboarding can never cost a booking) is a valid row, and
-- every profile written before this migration stays valid.
--
-- Additive + idempotent — safe to run more than once. Apply with `npm run db:sql`.

ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "level"    text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "subjects" text;
