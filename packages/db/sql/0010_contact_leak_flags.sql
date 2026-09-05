-- 0010 — contact-leak flags, for Step 8 (zero contact exchange).
--
-- ⚠ THE RAW MATCH IS NEVER STORED. This table records the pattern CLASS (phone,
-- email, url, social handle, …), the surface it was written on, and what we did
-- about it. Nothing else.
--
-- That restraint is the point, not an oversight. Step 8 exists to stop contact
-- details moving between people. A moderation table holding the phone number it
-- caught has copied that number into a second place, made it readable by every
-- admin, and given /privacy a new category to declare and the retention job a new
-- thing to promise about. If a `matched_text` column ever appears here, the
-- feature has inverted into the thing it was built to prevent.
--
-- NO UNIQUE CONSTRAINT, deliberately. Repeated attempts ARE the signal: one flag
-- is a typo, eleven in an evening is somebody working around the filter, and that
-- shape is only visible if every attempt is its own row.
--
-- The enums are closed sets rather than text because these are the columns a
-- moderator filters on, and "review" / "reviews" / "Review" would silently split
-- the same thing into three. leak_kind MIRRORS ContactKind in
-- packages/shared/src/contact-info.ts — add to both together or the API will
-- write a value the type does not accept.
--
-- IDEMPOTENT: guarded CREATE TYPE, CREATE TABLE IF NOT EXISTS, guarded FK.

BEGIN;

DO $$
BEGIN
  CREATE TYPE "leak_surface" AS ENUM (
    'tutor_bio', 'tutor_name', 'tutor_subject',
    'class_title', 'class_description',
    'pack_title', 'review', 'message'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "leak_kind" AS ENUM (
    'phone', 'email', 'url', 'social-handle', 'social-platform', 'spelled-digits'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "leak_action" AS ENUM ('rejected', 'masked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "contact_leak_flags" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "profile_id" uuid,
  "surface"    "leak_surface" NOT NULL,
  "kind"       "leak_kind" NOT NULL,
  "action"     "leak_action" NOT NULL,
  "hits"       integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- SET NULL, not CASCADE: Step 15 deletes accounts, and a moderation history must
-- survive the account it describes closing. The row stops naming a person and
-- keeps counting as a pattern.
DO $$
BEGIN
  ALTER TABLE "contact_leak_flags"
    ADD CONSTRAINT "contact_leak_flags_profile_id_profiles_id_fk"
    FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- "Show me everything this person tried, newest first" — the only query a
-- moderator actually runs against this table.
CREATE INDEX IF NOT EXISTS "contact_leak_flags_profile_id_created_at_idx"
  ON "contact_leak_flags" USING btree ("profile_id", "created_at");

COMMIT;
