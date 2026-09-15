-- 0021 — what remains after an identity document is purged (production readiness, Stage 5).
--
-- /privacy §5 has promised since July: "Après suppression, il ne reste qu'une trace
-- minimale sans le document lui-même : le type de document présenté, la date du
-- contrôle et la décision." The purge deleted the verification_docs row outright,
-- so that trace never existed and the sentence was false.
--
-- One row per purged document: its kind, when it was uploaded, the decision and
-- its date, and when the file was deleted. No file, no file name, no path, no
-- person — the tutor_id points at a tutor record, and an erased tutor's record
-- carries no identity either (0022).
--
-- LEGAL-REVIEW: how long the trace itself is kept is not decided. Today it lives
-- as long as the tutor record.
--
-- IDEMPOTENT. Additive only.

BEGIN;

CREATE TABLE IF NOT EXISTS "verification_traces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tutor_id" uuid NOT NULL REFERENCES "tutors"("id") ON DELETE CASCADE,
  "kind" "doc_kind" NOT NULL,
  "uploaded_at" timestamp with time zone NOT NULL,
  "decision" "tutor_status" NOT NULL,
  "decided_at" timestamp with time zone,
  "purged_at" timestamp with time zone NOT NULL DEFAULT now(),
  "reason" text NOT NULL DEFAULT 'retention'
);

CREATE INDEX IF NOT EXISTS "verification_traces_tutor_id_idx" ON "verification_traces" ("tutor_id");

COMMIT;
