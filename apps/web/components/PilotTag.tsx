"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { Tag } from "@/components/ui";
import { bilingual } from "@/lib/i18n";

/* Phase A+ · P4 (D12) — "Pilote · réservé aux 18 ans et +".

   Shown ONLY while the pilot is adults-only (ALLOW_MINORS !== "1"), and the flag
   always comes from the server at runtime, never from the build:
     • a server page that renders per request passes `adultsOnly` (Explore);
     • a prerendered page (home) omits it, and the tag asks /api/pilot after
       hydration. Until the answer arrives nothing is shown — no claim from the
       build's environment.
   Neutral tag: it is information, not a warning and not a success. */
const copy = bilingual({
  fr: { label: "Pilote · réservé aux 18 ans et +" },
  // The consent page's own Derija spelling ("للّي عمرهم 18 سنة وفوق").
  ar: { label: "تجربة · للّي عمرهم 18 سنة وفوق" },
});

export function PilotTag({ adultsOnly }: { adultsOnly?: boolean }) {
  const { locale } = useLocale();
  const [fetched, setFetched] = useState<boolean | null>(null);

  useEffect(() => {
    if (adultsOnly !== undefined) return;
    let live = true;
    fetch("/api/pilot", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { adultsOnly?: boolean } | null) => {
        if (live) setFetched(j?.adultsOnly === true);
      })
      .catch(() => {
        if (live) setFetched(false);
      });
    return () => {
      live = false;
    };
  }, [adultsOnly]);

  const show = adultsOnly ?? fetched;
  if (!show) return null;
  return (
    <Tag kind="neutral" className="pilot-tag">
      <span data-e2e="pilot-tag">{copy[locale].label}</span>
    </Tag>
  );
}
