"use client";
import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";
import { openThread } from "@/app/actions";
import { bilingual } from "@/lib/i18n";

/* THE ONLY WAY A CONVERSATION STARTS.

   There is no compose screen and no user picker anywhere in the product, by
   design: a thread is opened FROM a booking, by one of the two people it is
   between. That is what makes an inbox safe to point minors at, and it is why
   this button lives on a booking row rather than in the nav.

   It renders where the `tel:` link used to be on the tutor dashboard. Step 8 took
   the phone number away; this is what replaces it, and putting it in the same
   place is the point — otherwise the tutor just experiences a removal.

   Idempotent: apps/api opens-or-returns against a UNIQUE booking_id, so a
   double-tap on a slow connection navigates to the same thread rather than
   forking the conversation. */

const copy = bilingual({
  fr: {
    label: "Message",
    opening: "…",
    /* A cancelled seat opens no NEW thread. Said plainly rather than shown as a
       generic failure, so the tutor understands it is a rule, not a bug. */
    errCancelled: "Cette réservation est annulée : on ne peut plus ouvrir de conversation.",
    errGeneric: "Impossible d'ouvrir la conversation. Réessaie.",
  },
  ar: {
    label: "راسل",
    opening: "…",
    errCancelled: "الحجز هذا تلغى: ما عادش تنجّم تحلّ محادثة.",
    errGeneric: "ما نجّمناش نحلّو المحادثة. عاود حاول.",
  },
});

export function MessageBookingButton({
  bookingId,
  className,
  style,
  ariaLabel,
}: {
  bookingId: string;
  className?: string;
  /* The student card sits on a dark panel where btn-ghost is invisible, so the
     caller supplies the same inline treatment its sibling Cancel button uses.
     Passed in rather than branched on here: this component should not have to
     know which surfaces are dark. */
  style?: CSSProperties;
  ariaLabel?: string;
}) {
  const router = useRouter();
  const { locale } = useLocale();
  const c = copy[locale];
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    const res = await openThread({ bookingId }).catch(() => null);
    if (res?.ok && res.threadId) {
      router.push(`/messages/${res.threadId}`);
      return; // leave `busy` set: the page is navigating away
    }
    setBusy(false);
    setErr(res?.error === "booking-cancelled" ? c.errCancelled : c.errGeneric);
  }

  return (
    <>
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className={style ? className : (className ?? "btn btn-ghost btn-sm")}
        style={style}
        aria-label={ariaLabel ?? c.label}
      >
        {busy ? c.opening : c.label}
      </button>
      {err && (
        <span role="alert" className="text-[12px]" style={{ color: "var(--rose)" }}>
          {err}
        </span>
      )}
    </>
  );
}
