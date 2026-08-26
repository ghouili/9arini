"use client";
import { Share } from "@/components/icons";

/* The ONLY interactive thing on the tutor storefront.

   It is a separate island so StorefrontView itself can be a SERVER component.
   That page is the single most-loaded URL in the product — a tutor pastes their
   link into a WhatsApp group and hundreds of mid-range Androids open it at once
   — and it was 750 lines of "use client": every string of both locale
   dictionaries, every branch of the price/seats logic and the whole review list
   were serialised into the client bundle to render markup that never changes
   after paint. Now only this button ships.

   navigator.share is not universal (no Firefox on Android, no desktop Safari
   before 16.4). The button hides itself rather than no-op'ing on a tap, because
   a control that does nothing is worse than one that is not there. That check
   has to run in the browser, which is the other reason this is a client
   component: rendering it server-side and hoping is how you ship a dead button. */
import { useEffect, useState } from "react";

export function ShareButton({ title, label }: { title: string; label: string }) {
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  if (!canShare) return null;

  return (
    <button
      type="button"
      className="iconbtn on-blue sf-share"
      aria-label={label}
      onClick={() => {
        navigator.share({ title, url: window.location.href }).catch(() => {
          /* the user dismissed the sheet — not an error worth surfacing */
        });
      }}
    >
      <Share />
    </button>
  );
}
