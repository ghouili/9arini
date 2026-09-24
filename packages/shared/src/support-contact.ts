/* THE SUPPORT WHATSAPP LINK (phase-a lane L1, A12 — decision D5).

   The "Aide & support" row on /account shipped as a placeholder wa.me link to a
   number nobody owns (CEO report, finding 16). Support is InnoviaBurst's business
   number, and it is NEVER hard-coded: it comes from NEXT_PUBLIC_SUPPORT_WHATSAPP,
   written the way wa.me wants it — country code and number, DIGITS ONLY, no "+",
   no spaces. Anything else (unset, empty, a placeholder with letters, a stray
   "+") returns null and the row is not rendered at all: a support link that opens
   a chat with nobody is worse than no link. */

const WA_DIGITS = /^\d{8,15}$/; // E.164 allows at most 15 digits

/** `https://wa.me/<digits>` when the configured number is valid, otherwise null. */
export function supportWhatsAppHref(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").trim();
  return WA_DIGITS.test(digits) ? `https://wa.me/${digits}` : null;
}
