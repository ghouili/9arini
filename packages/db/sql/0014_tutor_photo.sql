-- 0014 — tutor profile photos (Step 13).
--
-- RENAMES `tutors.avatar_url` TO `avatar_path`, and the rename is safe to the
-- point of being boring: the column was declared in the schema and referenced by
-- NOTHING — zero occurrences in apps/ or packages/ outside the schema file — and
-- held zero non-null values across every row. Verified before writing this.
--
-- The rename is not pedantry. Nothing here is served statically: the bytes live
-- under STORAGE_DIR and an endpoint decides who may read them. A column called
-- "url" holding a storage path would mislead the next person to read the most
-- privacy-sensitive field this table has.
--
-- MODERATION IS A STATE, NOT A FLAG. Every upload lands as 'pending' and is
-- invisible to everyone but its owner until a human approves it. There is no code
-- path that writes 'approved' on upload. This is a photograph of a face, on a
-- public page, in a product whose users are largely children — "review it later"
-- is the version of this that ends up in a news story.
--
-- WHAT IS NOT STORED: the original file. sharp re-encodes to three fixed sizes and
-- drops every metadata block on the way, so the EXIF GPS tag that a phone camera
-- writes — the coordinates of the tutor's home, usually — never reaches disk. The
-- strip is a re-encode rather than a field deletion because deleting known tags
-- leaves the unknown ones.
--
-- IDEMPOTENT: the rename is guarded on the OLD column still existing, so a replay
-- after it has already run does nothing.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'tutors' AND column_name = 'avatar_url'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'tutors' AND column_name = 'avatar_path'
  ) THEN
    ALTER TABLE "tutors" RENAME COLUMN "avatar_url" TO "avatar_path";
  END IF;
END $$;

DO $$
BEGIN
  CREATE TYPE "avatar_status" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "tutors" ADD COLUMN IF NOT EXISTS "avatar_status" "avatar_status";
ALTER TABLE "tutors" ADD COLUMN IF NOT EXISTS "avatar_updated_at" timestamp with time zone;

COMMIT;
