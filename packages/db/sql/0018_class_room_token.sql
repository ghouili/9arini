-- 0018 — an unguessable room for every class (production readiness, Stage 2).
--
-- A class without its own meet_url used to get the Jitsi room
-- https://meet.jit.si/tnajem-<class id> — and the class id is public: it is in
-- every storefront's HTML (/class/<id>, /checkout?class=<id>). Anyone could build
-- the URL of a live class full of minors without ever touching the API, so the
-- entitlement check in GET /classes/:id/join protected nothing for those rooms.
--
-- room_token is a random UUID that is never rendered on a public page and ships
-- only to the owning tutor or a student with a live booking
-- (packages/shared/src/live.ts). Existing rows get a fresh token, so every
-- previously derivable room URL stops being the room.
--
-- Residual risk, stated plainly: meet.jit.si rooms have no authentication. A
-- booked student who forwards the link forwards the room. Real gating needs a
-- JWT-protected Jitsi (8x8 JaaS or self-hosted) — a product/cost decision.
--
-- IDEMPOTENT. Additive only: no column is removed, no value is lost.

BEGIN;

ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "room_token" uuid;
UPDATE "classes" SET "room_token" = gen_random_uuid() WHERE "room_token" IS NULL;
ALTER TABLE "classes" ALTER COLUMN "room_token" SET DEFAULT gen_random_uuid();
ALTER TABLE "classes" ALTER COLUMN "room_token" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "classes_room_token_key" ON "classes" ("room_token");

COMMIT;
