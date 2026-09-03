/* /onboarding/upgrade — SERVER shell for the student → tutor conversion.

   The guard here is the point of the whole screen: only a STUDENT can be converted,
   and the conversion must be something they arrived at deliberately. A tutor who
   lands here has nothing to confirm and is sent on to their actual onboarding. */
import { redirect } from "next/navigation";
import { UpgradeInner } from "@/components/onboarding/UpgradeInner";
import { pageGuard, localeOf, localePath } from "@/lib/page-guard";
import { isMinorBirthYear } from "@/lib/validation";

export default async function UpgradePage({ params }: { params: { locale: string } }) {
  const locale = localeOf(params.locale);
  const guard = await pageGuard();

  // Demo mode / UI audit harness — no DB to read a role from. Render the screen.
  if (guard.kind === "inert") return <UpgradeInner needsBirthYear={false} />;
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
  if (!needsBirthYear && isMinorBirthYear(guard.profile.birthYear)) {
    // A known minor can never be converted; becomeTutor() refuses too. Don't show
    // a confirmation screen whose only possible outcome is a refusal.
    redirect(localePath(locale, "/student"));
  }

  return <UpgradeInner needsBirthYear={needsBirthYear} />;
}
