-- 0022 — an erased account is ANONYMISED, not deleted (production readiness, Stage 5).
--
-- Until now the purge ran `DELETE FROM profiles`, and the foreign keys decided the
-- rest. That did too much and too little at once:
--   too much    bookings cascaded away, and with them the other side's history
--               (a tutor's class roster, a guardian's record) and message threads;
--   too little  tutors.profile_id is SET NULL, so an erased tutor's storefront row
--               kept their name, bio and links, and their ID scans, materials and
--               photo stayed in storage with nothing left to find them by.
--
-- Now the profile row stays as a TOMBSTONE with no identity (packages/db/src/erasure.ts
-- does the work), so nothing cascades and every record that belongs to someone
-- else keeps its shape:
--
--   profiles.purged_at        set by the erasure; a CHECK guarantees a tombstone
--                             carries no e-mail, phone, name, birth year or profile.
--   profiles.last_seen_at     the inactivity clock (INACTIVE_ACCOUNT_RETENTION_DAYS in
--                             @tnajem/shared/legal), moved by getSession at most every
--                             15 minutes. Back-filled from sessions, else created_at.
--   tutors.erased_at          the tutor record of an erased account (also suspended,
--                             so every public read already excludes it).
--   retired_slugs             sha256 of every slug an erased tutor held, so nobody can
--                             claim the old address and impersonate them — without
--                             storing a slug that is often the person's name.
--   notifications.about_profile_id
--                             who a notification names, so an erasure can rewrite the
--                             OTHER person's notification that says "Amine a réservé…".
--
-- IDEMPOTENT. Additive only; the CHECK holds for every existing row (none is purged).

BEGIN;

ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "purged_at" timestamp with time zone;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamp with time zone;

UPDATE "profiles" p
   SET "last_seen_at" = GREATEST(
         p."created_at",
         COALESCE((SELECT max(s."last_seen_at") FROM "sessions" s WHERE s."profile_id" = p."id"), p."created_at")
       )
 WHERE p."last_seen_at" IS NULL;

ALTER TABLE "profiles" ALTER COLUMN "last_seen_at" SET DEFAULT now();
ALTER TABLE "profiles" ALTER COLUMN "last_seen_at" SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE "profiles"
    ADD CONSTRAINT "profiles_purged_has_no_identity"
    CHECK ("purged_at" IS NULL OR (
      "email" IS NULL AND "phone" IS NULL AND "full_name" IS NULL AND
      "birth_year" IS NULL AND "level" IS NULL AND "subjects" IS NULL
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "profiles_last_seen_at_idx" ON "profiles" ("last_seen_at") WHERE "purged_at" IS NULL;

ALTER TABLE "tutors" ADD COLUMN IF NOT EXISTS "erased_at" timestamp with time zone;

CREATE TABLE IF NOT EXISTS "retired_slugs" (
  "slug_hash" text PRIMARY KEY,
  "retired_at" timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "about_profile_id" uuid;
DO $$
BEGIN
  ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_about_profile_id_profiles_id_fk"
    FOREIGN KEY ("about_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "notifications_about_profile_id_idx" ON "notifications" ("about_profile_id") WHERE "about_profile_id" IS NOT NULL;

COMMIT;
