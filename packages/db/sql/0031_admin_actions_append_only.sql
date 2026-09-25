-- 0031 — the admin audit log is APPEND-ONLY (Phase A+ · P3, D13).
--
-- admin_actions records who approved, rejected, blocked, unblocked, hid content,
-- granted a plan or read an identity document. It was append-only "by convention":
-- the app role could UPDATE or DELETE any row, so the record of an action could be
-- rewritten by the same credentials that took it. This trigger refuses both, and
-- TRUNCATE, at the database — whatever the code does.
--
-- ONE CARVE-OUT, and it is the foreign key's own action: admin_profile_id is
-- ON DELETE SET NULL, so deleting an admin's profile nulls the actor on their rows
-- (the record stays; "who" becomes unknown only because the account itself is
-- gone). That UPDATE is allowed only when it changes NOTHING but admin_profile_id
-- to NULL, and only when that profile no longer exists — which is true inside the
-- cascade, and never true for a hand-written UPDATE against a live admin.
--
-- The app writes audit rows in the SAME transaction as the action (apps/api/src/
-- lib/audit.ts), and a failed audit write fails the action.
--
-- Nothing in the ID purge or account erasure updates or deletes admin_actions:
-- erasure only INSERTS its own audit row (packages/db/src/erasure.ts).
--
-- IDEMPOTENT: CREATE OR REPLACE the function, DROP IF EXISTS + CREATE the triggers.
-- Additive: no column, no row, no constraint changes.
--
-- MANUAL ROLLBACK:
--   DROP TRIGGER IF EXISTS "admin_actions_append_only" ON "admin_actions";
--   DROP TRIGGER IF EXISTS "admin_actions_no_truncate" ON "admin_actions";
--   DROP FUNCTION IF EXISTS admin_actions_append_only();

BEGIN;

CREATE OR REPLACE FUNCTION admin_actions_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.admin_profile_id IS NOT NULL
     AND NEW.admin_profile_id IS NULL
     AND NEW.id = OLD.id
     AND NEW.action = OLD.action
     AND NEW.subject_kind IS NOT DISTINCT FROM OLD.subject_kind
     AND NEW.subject_id IS NOT DISTINCT FROM OLD.subject_id
     AND NEW.note IS NOT DISTINCT FROM OLD.note
     AND NEW.created_at = OLD.created_at
     AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = OLD.admin_profile_id)
  THEN
    RETURN NEW; -- the FK's ON DELETE SET NULL: the actor's profile is gone, the record stays
  END IF;
  RAISE EXCEPTION 'admin_actions is append-only: % refused', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END
$$;

DROP TRIGGER IF EXISTS "admin_actions_append_only" ON "admin_actions";
CREATE TRIGGER "admin_actions_append_only"
  BEFORE UPDATE OR DELETE ON "admin_actions"
  FOR EACH ROW EXECUTE FUNCTION admin_actions_append_only();

DROP TRIGGER IF EXISTS "admin_actions_no_truncate" ON "admin_actions";
CREATE TRIGGER "admin_actions_no_truncate"
  BEFORE TRUNCATE ON "admin_actions"
  FOR EACH STATEMENT EXECUTE FUNCTION admin_actions_append_only();

COMMIT;
