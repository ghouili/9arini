-- 0005 — email becomes the login identity; phone becomes an optional contact.
--
-- WHY: login was a phone OTP over Twilio, and Twilio only delivers reliably to
-- Tunisian numbers once a registered alphanumeric sender ID is in place. Until
-- then smsEnabled() is false and requestOtp() only ever returns the code
-- on-screen in dev — i.e. a real deploy had no working login at all. Email has
-- none of those preconditions and costs nothing per message.
--
-- SCOPE: only the LOGIN IDENTITY moves. profiles.phone stays exactly as it is —
-- nullable, unique, and still the tutor's way to reach a student plus the target
-- of notify()'s optional SMS side-channel. It is now collected during onboarding
-- (/student/welcome, /onboarding) instead of at signup.
--
-- REVERTING: OTP_CHANNEL=sms flips the whole flow back to phone login with no
-- code change (lib/auth.ts::otpChannel). Nothing here is destructive, and both
-- channels read and write the SAME otp_codes.identifier column — which is why it
-- is renamed rather than duplicated.
--
-- Additive + idempotent — safe to run more than once. Apply with `npm run db:sql`.

-- ── 1. The login identity ────────────────────────────────────────────────────
-- Nullable at the column level, unique via the index below. Postgres does not
-- conflict NULLs against each other, which is exactly how profiles.phone already
-- manages to be both unique and optional.
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "email" text;

CREATE UNIQUE INDEX IF NOT EXISTS "profiles_email_key" ON "profiles" ("email");

-- ── 2. otp_codes.phone → otp_codes.identifier ────────────────────────────────
-- The column holds a phone under OTP_CHANNEL=sms and an email address under
-- =email. Leaving it called "phone" while it stores addresses is the kind of
-- quiet lie the comments in this codebase exist to prevent, and both channels
-- want the same column, so a rename beats a second column.
--
-- Safe: otp_codes is transient (5-minute TTL, swept by lib/retention.ts), so no
-- durable data rides on it. Guarded on information_schema so re-running is a
-- no-op, matching the IF NOT EXISTS style of the other files here.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'otp_codes' AND column_name = 'phone'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'otp_codes' AND column_name = 'identifier'
  ) THEN
    ALTER TABLE "otp_codes" RENAME COLUMN "phone" TO "identifier";
  END IF;
END $$;

-- Every step of the login funnel scans this table by identity: otpCooldownRemaining
-- (select), createOtp (delete + insert under an advisory lock), verifyOtpCode
-- (select, then delete). Without the index that is four seq scans per login.
ALTER INDEX IF EXISTS "otp_codes_phone_idx" RENAME TO "otp_codes_identifier_idx";
CREATE INDEX IF NOT EXISTS "otp_codes_identifier_idx" ON "otp_codes" USING btree ("identifier");
