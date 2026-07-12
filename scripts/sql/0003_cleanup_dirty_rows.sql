-- 0003 — one-off cleanup of rows written BEFORE the security audit (launch brief,
-- Phase 1: "Existing DB rows are dirty … Write a one-off cleanup").
--
-- Two classes of pre-hardening dirty data can exist:
--
--   1. verification_docs.mime holding the CLIENT-CLAIMED Content-Type. submitVerification
--      now stores the magic-byte-SNIFFED type, and the admin doc route (app/api/admin/doc)
--      re-validates against the same allow-list on read — so this is defence in depth.
--      Null any value outside the allow-list: the doc route then serves it as an
--      attachment (download), never renders it inline. The allow-list mirrors SAFE_MIME
--      in the doc route.
--
--   2. tutors.*_url written WITHOUT url validation. submitVerification now runs
--      vOptionalUrl (http/https scheme allow-list — kills javascript:/data:/file:), but
--      older rows may carry a hostile value that is rendered as <a href> on the admin
--      review page and the tutor's own page. Null anything that isn't a plain http(s) URL.
--
-- Idempotent + additive: once clean, every UPDATE matches zero rows. Safe on empty tables.

UPDATE verification_docs
SET mime = NULL
WHERE mime IS NOT NULL
  AND mime NOT IN (
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'
  );

UPDATE tutors SET linkedin_url    = NULL WHERE linkedin_url    IS NOT NULL AND linkedin_url    !~* '^https?://';
UPDATE tutors SET instagram_url   = NULL WHERE instagram_url   IS NOT NULL AND instagram_url   !~* '^https?://';
UPDATE tutors SET tiktok_url      = NULL WHERE tiktok_url      IS NOT NULL AND tiktok_url      !~* '^https?://';
UPDATE tutors SET youtube_url     = NULL WHERE youtube_url     IS NOT NULL AND youtube_url     !~* '^https?://';
UPDATE tutors SET facebook_url    = NULL WHERE facebook_url    IS NOT NULL AND facebook_url    !~* '^https?://';
UPDATE tutors SET website_url     = NULL WHERE website_url     IS NOT NULL AND website_url     !~* '^https?://';
UPDATE tutors SET intro_video_url = NULL WHERE intro_video_url IS NOT NULL AND intro_video_url !~* '^https?://';
