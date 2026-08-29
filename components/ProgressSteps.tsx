/* One accessible progress bar, used by every onboarding screen in the product —
   the tutor's (/onboarding, /onboarding/verify, via <OnboardingProgress>) and the
   student's (/student/welcome).

   Presentational and hook-free, so it works in server or client components (same
   contract as components/ui.tsx).

   Two defects it exists to prevent recurring, both previously real here:
   • An unnamed role="progressbar" — UI_UX_AUDIT_REPORT.md flagged it on two routes
     as the only serious axe violation in the app. `label` is required, not optional.
   • An aria-valuenow that could not reach its own aria-valuemax. The old tutor bar
     advertised a maximum of 3 while computing its value as `published ? 2 : 1`.
     Here valuemax is derived from segs.length, so the two cannot drift apart.

   The segment strip is aria-hidden: the progressbar element already announces the
   label and the position, so exposing the segments too would make a screen reader
   read the same state N+1 times. */

export type ProgressSeg = {
  key: string;
  /** Two or three words. Truncated, never wrapped — these sit in equal-width columns. */
  short: string;
  tone: "done" | "active" | "todo";
};

const FILL: Record<ProgressSeg["tone"], string> = {
  done: "bg-green-btn",
  active: "bg-ochre-btn",
  todo: "bg-line",
};

export function ProgressSteps({
  label,
  segs,
  current,
  valueText,
  className = "",
}: {
  /** Accessible name. Required — see above. */
  label: string;
  segs: ProgressSeg[];
  /** 1-based position, must be within [1, segs.length]. */
  current: number;
  /** Human phrasing of the position, e.g. "Étape 2 sur 4 — Vérification". */
  valueText: string;
  className?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={segs.length}
      aria-valuenow={current}
      aria-valuetext={valueText}
      className={`mb-[22px] max-w-[460px] ${className}`}
    >
      {/* "Étape 2 sur 4 — Vérification", rendered.

          It used to exist ONLY as aria-valuetext, so a screen-reader user heard
          the position and a sighted user never saw it: they got four 5px bars and
          four labels truncated to "2. Vérificati…" at 380px, which does not answer
          "how much of this is left?" — the question that decides whether someone
          starts a form at all. aria-hidden here because the progressbar already
          announces the identical string via aria-valuetext; without it, the
          sentence would be read twice. */}
      <div aria-hidden="true" className="text-[13px] font-bold text-ink2 mb-1.5">
        {valueText}
      </div>
      <div className="flex gap-1.5" aria-hidden="true">
        {segs.map((s) => (
          <div
            key={s.key}
            className={`h-[5px] flex-1 rounded-[9px] transition-colors duration-300 ${FILL[s.tone]}`}
          />
        ))}
      </div>
      <div className="flex gap-1.5 mt-[7px]" aria-hidden="true">
        {segs.map((s, i) => (
          <div
            key={s.key}
            className={`flex-1 min-w-0 text-[13px] font-bold truncate ${
              s.tone === "todo" ? "text-muted" : "text-ink2"
            }`}
          >
            {i + 1}. {s.short}
          </div>
        ))}
      </div>
    </div>
  );
}
