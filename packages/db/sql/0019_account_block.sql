-- 0019 — an admin can block an account (production readiness, Stage 2).
--
-- There was no way to stop an account: "reject" was the only lever, it took any
-- tutor (verified included), required no reason, wrote no audit row, ended no
-- session and left every booking in place. A platform where adults teach minors
-- needs a real stop — and it must say what happens to the classes and bookings.
--
-- profiles.blocked_*   the account: sessions are refused, login is refused.
-- tutors.suspended_at  the storefront: hidden from every public read (storefront,
--                      explore, sitemap, reviews, materials) and unbookable. A
--                      denormalised copy so those reads filter on the table they
--                      already load; set and cleared together with blocked_at by
--                      apps/api/src/routes/admin-accounts.ts.
--
-- Unblocking clears both and restores the account exactly as it was: the
-- verification decision (tutors.status) is never touched by a block.
--
-- The reason is written by an admin about a person; it is shown to admins only.
--
-- IDEMPOTENT. Additive only.

BEGIN;

ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "blocked_at" timestamp with time zone;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "blocked_reason" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "blocked_by" uuid;

DO $$
BEGIN
  ALTER TABLE "profiles"
    ADD CONSTRAINT "profiles_blocked_by_profiles_id_fk"
    FOREIGN KEY ("blocked_by") REFERENCES "profiles"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "tutors" ADD COLUMN IF NOT EXISTS "suspended_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "profiles_blocked_at_idx" ON "profiles" ("blocked_at") WHERE "blocked_at" IS NOT NULL;

COMMIT;
