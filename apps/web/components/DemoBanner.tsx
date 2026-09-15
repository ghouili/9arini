import { demoEnabled } from "@/lib/demo";
import type { AppLocale } from "@/lib/locale";

/* THE ONLY THING THAT MAKES DEMO DATA SAFE TO LOOK AT.

   Demo mode serves tutors who do not exist. It used to switch on silently
   whenever API_URL was missing, and the fixtures look exactly like real pages —
   so a screenshot of dev could end up in a pitch deck with nothing on it saying
   the people were invented. Now it is opt-in (TNAJEM_DEMO=1, development only,
   see scripts/preflight.mjs) and every page says so, in the page's own language.

   Rendered by app/[locale]/layout.tsx, above everything, so no route can forget
   it — not only the ones that happen to use SiteShell. It is plain text, not a
   control: the skip link stays the first tab stop. `demoEnabled` is a build-time
   constant, so in production this renders nothing and ships no copy. */
const copy = {
  fr: { mode: "MODE DÉMO", detail: "données fictives" },
  ar: { mode: "وضع تجريبي", detail: "معطيات وهمية" },
} as const;

export function DemoBanner({ locale }: { locale: AppLocale }) {
  if (!demoEnabled) return null;
  const t = copy[locale];
  return (
    <p
      role="note"
      data-demo-banner=""
      className="m-0 bg-ochre-tint text-ochre-ink border-b border-ochre text-center text-sm font-semibold py-1.5 px-4"
    >
      {`${t.mode} — ${t.detail}`}
    </p>
  );
}
