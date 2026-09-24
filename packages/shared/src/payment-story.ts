/* THE PAYMENT STORY — one sentence, one place (Phase A · lane L3 · A22 · decision D4).

   The product used to tell four stories at once: pay the tutor "directement",
   "en main propre", "juste avant chaque séance — ou au mois", and "après". D4
   settled it: the student pays ONLINE, THROUGH TNAJEM, BEFORE THE SESSION. Every
   surface that speaks about paying renders THIS text, through
   apps/web/components/PaymentStory.tsx.

   IT IS NOT TRUE TODAY. Payments are off (PAYMENTS_ENABLED unset — see
   ./payments.ts), so while they are off the sentence may appear only beside the
   visible "Bientôt" / "قريب" label, never on its own. PaymentStory fails closed:
   it shows the label unless it is explicitly told payments are enabled.

   No provider, card or wallet is named here (Phase E decides the rails).

   WHY THIS FILE AND NOT payments.ts ITSELF: payments.ts is server-only by
   contract (its header) — it carries the payment adapters and must never reach a
   client bundle — while almost every surface that says how a student pays is a
   client component. payments.ts re-exports PAYMENT_STORY, so the server-side
   import path and the client-side one resolve to this single definition. */

export type PaymentAudience = "student" | "tutor";

export const PAYMENT_STORY = {
  fr: {
    student: "Tu paies en ligne, via Tnajem, avant la séance.",
    tutor: "Tes élèves paient en ligne, via Tnajem, avant la séance.",
    soon: "Bientôt",
  },
  ar: {
    student: "تخلّص أونلاين، على Tnajem، قبل الحصة.",
    tutor: "تلامذتك يخلّصو أونلاين، على Tnajem، قبل الحصة.",
    soon: "قريب",
  },
  /* Plain-text surfaces written in English (llms.txt). Same story, same gate. */
  en: {
    student: "Students pay online, through Tnajem, before the session.",
    tutor: "Students pay online, through Tnajem, before the session.",
    soon: "Coming soon",
  },
} as const;

/** For surfaces that cannot hold markup (meta text, llms.txt): the label is
    prefixed in the same string, so it can never be dropped by a layout. */
export function paymentStoryText(
  locale: keyof typeof PAYMENT_STORY,
  audience: PaymentAudience,
  paymentsAreEnabled: boolean,
): string {
  const s = PAYMENT_STORY[locale];
  const sep = locale === "en" ? ": " : " : "; // French and Arabic typography put a space before the colon
  return paymentsAreEnabled ? s[audience] : `${s.soon}${sep}${s[audience]}`;
}
