-- 0024 — the Décret n° 2015-1619 declaration (production readiness, Stage 5).
--
-- The product must never feature an identifiable serving public-school teacher.
-- A tutor now declares, before an application can be submitted, that they do not
-- teach in a public school; the declaration and its wording version are stored
-- with the application, and the admin queue shows both beside the institution the
-- tutor named, so the reviewer checks one against the other.
--
-- LEGAL-REVIEW: the wording (@tnajem/shared/legal PUBLIC_TEACHER_DECLARATION), and
-- whether a declaration plus an admin check meets the obligation.
--
-- IDEMPOTENT. Additive only.

BEGIN;

ALTER TABLE "tutors" ADD COLUMN IF NOT EXISTS "public_teacher_declared_at" timestamp with time zone;
ALTER TABLE "tutors" ADD COLUMN IF NOT EXISTS "public_teacher_declaration_version" text;

COMMIT;
