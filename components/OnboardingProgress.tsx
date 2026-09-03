"use client";
import { useLocale } from "@/components/LocaleProvider";
import { ProgressSteps } from "@/components/ProgressSteps";
import type { ProgressSeg } from "@/components/ProgressSteps";
import { buildTutorSteps, currentStepNumber, STEP_COPY } from "@/lib/onboarding-steps";
import type { TutorProgress } from "@/lib/onboarding-steps";

/* The tutor funnel's progress bar, shown at the top of /onboarding and
   /onboarding/verify.

   It renders the SAME ladder the dashboard checklist renders
   (lib/onboarding-steps.ts), which is the entire point: those three screens used to
   disagree about how many steps the funnel has and which one you were on — a local
   3-step bar, a hardcoded "Étape 2 sur 3", and a real 4-step ladder. */
export function OnboardingProgress({ progress }: { progress: TutorProgress }) {
  const { locale } = useLocale();
  const c = STEP_COPY[locale];
  const steps = buildTutorSteps(progress, locale);
  const now = currentStepNumber(steps);

  const segs: ProgressSeg[] = steps.map((s, i) => ({
    key: s.key,
    short: s.short,
    /* `waiting` (documents under review) fills as done: the tutor HAS finished
       their part of that step and there is nothing left for them to do on it. */
    tone: s.state === "done" || s.state === "waiting" ? "done" : i + 1 <= now ? "active" : "todo",
  }));

  return (
    <ProgressSteps
      label={c.progressLabel}
      segs={segs}
      current={now}
      valueText={`${c.stepOf(now, steps.length)} — ${steps[now - 1].short}`}
    />
  );
}
