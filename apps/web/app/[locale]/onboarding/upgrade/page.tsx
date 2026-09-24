/* /onboarding/upgrade — SERVER shell for the student → tutor conversion.

   The guard here is the point of the whole screen: only a STUDENT can be converted,
   and the conversion must be something they arrived at deliberately. A tutor who
   lands here has nothing to confirm and is sent on to their actual onboarding. */
import { redirect } from "next/navigation";
import { UpgradeInner } from "@/components/onboarding/UpgradeInner";
import { pageGuard, localeOf, localePath } from "@/lib/page-guard";
import { isAdult } from "@tnajem/shared"; // phase-a lane L2 (A14): month-aware, fail-safe

/* REQUEST-TIME ONLY. The guard reads the visitor's session and redirects on it.
   Prerendered, a build would bake one answer — a redirect, or the inert state a
   build box without an API gets — into HTML served to everybody. This used to be
   dynamic only by accident (app/[locale]/not-found.tsx called headers()). */
export const dynamic = "force-dynamic";

export default async function UpgradePage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const locale = localeOf(params.locale);
  const guard = await pageGuard();

  // Demo mode / UI audit harness — no DB to read a role from. Render the screen.
  if (guard.kind === "inert") return <UpgradeInner needsBirthYear={false} needsBirthMonth={false} />;
  if (guard.kind === "guest") {
    redirect(localePath(locale, "/auth", localePath(locale, "/onboarding/upgrade")));
  }
  // Already a tutor: nothing to convert. Straight to step 1 of their funnel.
  if (guard.profile.role === "tutor") redirect(localePath(locale, "/onboarding"));

  /* Ask for a birth year only when we have none. isMinorBirthYear treats null as
     minor (fail safe), so an unknown age would otherwise be refused with nothing
     the user could do about it. A KNOWN age is never re-asked — that is what stops
     a minor restating themselves as an adult to get the role. */
  const needsBirthYear = guard.profile.birthYear == null;
  // phase-a lane L2 (A14): the month too — isAdult() needs both, and a missing one is asked, never assumed.
  const needsBirthMonth = guard.profile.birthMonth == null;
  if (!needsBirthYear && !needsBirthMonth && !isAdult(guard.profile.birthYear, guard.profile.birthMonth)) {
    // A known minor can never be converted; becomeTutor() refuses too. Don't show
    // a confirmation screen whose only possible outcome is a refusal.
    redirect(localePath(locale, "/student"));
  }

  return <UpgradeInner needsBirthYear={needsBirthYear} needsBirthMonth={needsBirthMonth} />;
}
