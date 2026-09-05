-- 0015 — parent accounts (Step 14).
--
-- WHAT WAS THERE BEFORE: two denormalised strings on a consent row,
-- guardian_name and guardian_phone. That is a legal record under INPDP and it
-- stays one — but it is not a person who can sign in, see what their child
-- booked, or read a conversation between their child and an adult stranger.
--
-- consents.guardian_email IS WHAT TURNS THE RECORD INTO A LINK. Login is e-mail
-- OTP, so an address is the only identifier that can ever resolve to an account.
-- The phone never could, which is why "we already have their number" was not a
-- foundation to build this on.
--
-- NULLABLE, and left null for every consent signed before this migration.
-- Back-filling a guessed address would be worse than an empty column: it would
-- silently grant oversight of a child's messages to whoever happens to own that
-- mailbox. Those parents have no linked account until the consent is re-signed,
-- and that is the correct outcome.
--
-- HOW A LINK IS MADE, and why it is not an invitation: nothing is created on the
-- parent's behalf and no e-mail is sent. When someone signs in with the address
-- on the consent, the link resolves. Controlling the inbox already proves control
-- of the address to exactly the standard the rest of the product uses — and an
-- invitation e-mail we cannot guarantee arrives is not a foundation for a
-- safeguarding feature.
--
-- UNIQUE(guardian, minor) IS LOAD-BEARING: the resolve-on-login path runs on
-- every single login, so without it a parent of two children accumulates a row
-- per sign-in, forever.
--
-- ⚠ A GUARDIAN IS NOT A CONTACT BRIDGE. Step 8 applies to them identically — they
-- see a tutor's first name and nothing else. This table exists for oversight of
-- their own child, never as a second route to an adult's phone number.
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS, guarded FKs.

BEGIN;

ALTER TABLE "consents" ADD COLUMN IF NOT EXISTS "guardian_email" text;

CREATE TABLE IF NOT EXISTS "guardian_links" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "guardian_profile_id" uuid NOT NULL,
  "minor_profile_id"    uuid NOT NULL,
  "consent_id"          uuid,
  "created_at"          timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "guardian_links_guardian_profile_id_minor_profile_id_unique"
    UNIQUE("guardian_profile_id", "minor_profile_id")
);

DO $$
BEGIN
  ALTER TABLE "guardian_links" ADD CONSTRAINT "guardian_links_guardian_profile_id_profiles_id_fk"
    FOREIGN KEY ("guardian_profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "guardian_links" ADD CONSTRAINT "guardian_links_minor_profile_id_profiles_id_fk"
    FOREIGN KEY ("minor_profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- SET NULL, not CASCADE: revoking or re-signing a consent must not silently drop
-- a parent's oversight of their child mid-term.
DO $$
BEGIN
  ALTER TABLE "guardian_links" ADD CONSTRAINT "guardian_links_consent_id_consents_id_fk"
    FOREIGN KEY ("consent_id") REFERENCES "consents"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "guardian_links_guardian_profile_id_idx"
  ON "guardian_links" USING btree ("guardian_profile_id");
CREATE INDEX IF NOT EXISTS "guardian_links_minor_profile_id_idx"
  ON "guardian_links" USING btree ("minor_profile_id");

COMMIT;
