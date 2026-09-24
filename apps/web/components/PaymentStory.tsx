import type { CSSProperties } from "react";
import { PAYMENT_STORY, type PaymentAudience } from "@tnajem/shared";
import { Chip } from "@/components/ui";

/* phase-a lane L3 (A22) — THE ONE PAYMENT SENTENCE (decision D4), wherever the
   product says how a student pays: "Tu paies en ligne, via Tnajem, avant la
   séance." The text lives in packages/shared/src/payment-story.ts.

   FAILS CLOSED. Payments are off, so unless a caller that KNOWS the server switch
   passes `enabled`, the sentence is shown beside the visible "Bientôt" / "قريب"
   label and can never read as true today. Most surfaces are client components
   with no access to PAYMENTS_ENABLED (it is server-only by design); they rely on
   the default. Surfaces that do know it (the /tarifs shell, the tutor dashboard's
   API payload) pass it through.

   Hook-free, so it renders in server and client components alike.
   data-payment-story is what e2e/payment-story.spec.ts crawls for. */
export function PaymentStory({
  locale,
  audience = "student",
  enabled = false,
  className,
  style,
}: {
  locale: "fr" | "ar";
  audience?: PaymentAudience;
  enabled?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const s = PAYMENT_STORY[locale];
  return (
    <span className={className} style={style} data-payment-story={enabled ? "live" : "soon"}>
      {!enabled && (
        <>
          <Chip kind="sand">{s.soon}</Chip>{" "}
        </>
      )}
      {s[audience]}
    </span>
  );
}
