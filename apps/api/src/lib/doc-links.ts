import { createHmac, timingSafeEqual } from "node:crypto";
import { authSecret } from "@tnajem/shared/auth-core";

/* SHORT-LIVED, ADMIN-BOUND LINKS to identity documents (production readiness Stage 4).

   A document is never addressable by its id alone. The review queue hands each
   admin, for each document, a link carrying an expiry and an HMAC over
   (document, admin, expiry). The read route needs BOTH that link and the admin's
   own session:
     - a link copied into a chat, a ticket or browser history is dead after
       DOC_LINK_TTL_SEC, and useless before that without the session it was issued to;
     - a second admin cannot reuse a colleague's link, so the audit row names the
       person the link was issued to — who is also the only one who could use it.

   The signing key is derived from AUTH_SECRET (domain-separated, resolved lazily).
   Rotating AUTH_SECRET kills outstanding links, which is harmless: they last minutes. */

export const DOC_LINK_TTL_SEC = 10 * 60;

const linkKey = () => createHmac("sha256", authSecret()).update("tnajem:doc-link:v1").digest();

function mac(docId: string, adminProfileId: string, exp: number): string {
  return createHmac("sha256", linkKey()).update(`${docId}\n${adminProfileId}\n${exp}`).digest("hex");
}

/** The web-relative URL an admin uses to open one document. */
export function docLink(docId: string, adminProfileId: string, nowMs = Date.now()): string {
  const exp = Math.floor(nowMs / 1000) + DOC_LINK_TTL_SEC;
  return `/api/admin/doc/${docId}?exp=${exp}&sig=${mac(docId, adminProfileId, exp)}`;
}

export type DocLinkCheck = "ok" | "missing" | "invalid" | "expired";

/** Checked AFTER the admin session: the signature binds the link to that admin. */
export function checkDocLink(
  docId: string,
  adminProfileId: string,
  query: { exp?: unknown; sig?: unknown },
  nowMs = Date.now(),
): DocLinkCheck {
  const expRaw = typeof query.exp === "string" ? query.exp : "";
  const sig = typeof query.sig === "string" ? query.sig : "";
  if (!expRaw || !sig) return "missing";
  if (!/^\d{1,12}$/.test(expRaw) || !/^[0-9a-f]{64}$/.test(sig)) return "invalid";
  const exp = Number(expRaw);
  const expected = Buffer.from(mac(docId, adminProfileId, exp), "hex");
  const given = Buffer.from(sig, "hex");
  // Signature first, expiry second: an expired link with a forged signature is "invalid".
  if (!timingSafeEqual(expected, given)) return "invalid";
  if (Math.floor(nowMs / 1000) > exp) return "expired";
  /* A link cannot be minted further out than the TTL, so an exp beyond it means the
     key leaked or the clock jumped: refuse rather than honour a long-lived link. */
  if (exp - Math.floor(nowMs / 1000) > DOC_LINK_TTL_SEC + 60) return "invalid";
  return "ok";
}
