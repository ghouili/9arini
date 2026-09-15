-- 0020 — sessions: the token is stored hashed, and an idle session expires
-- (production readiness, Stage 4).
--
-- token -> token_hash. The cookie holds 256 random bits; the table now holds
-- sha256(hex token) and nothing else. Before this, every database backup and
-- every read-only leak of this table was a list of live logins, admins included,
-- valid for up to 30 days (security review, 15 Sept 2026). A hash of a 256-bit
-- random value needs no salt or slow KDF: there is nothing to brute-force.
--
-- The existing rows are hashed IN PLACE, so nobody is logged out by deploying
-- this. The column is renamed as well, so any code still comparing a raw token
-- fails to compile instead of silently matching nothing.
--
-- last_seen_at: the idle clock. getSession() refuses a session unused for
-- SESSION_IDLE_DAYS (packages/shared/src/auth-core.ts) and moves the clock at
-- most every 15 minutes, so it is not a write per request.
--
-- REVERSIBILITY: last_seen_at can be dropped and the column renamed back, but a
-- hash cannot be turned back into a token — rolling back to code from before this
-- file logs everyone out once. No other data is affected.
--
-- IDEMPOTENT: the hash-and-rename runs only while a column named "token" exists.

BEGIN;

ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamp with time zone NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'token'
  ) THEN
    UPDATE "sessions" SET "token" = encode(sha256(convert_to("token", 'UTF8')), 'hex');
    ALTER TABLE "sessions" RENAME COLUMN "token" TO "token_hash";
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "sessions_last_seen_at_idx" ON "sessions" ("last_seen_at");

COMMIT;
