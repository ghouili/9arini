/* /onboarding/verify — SERVER shell for step 2 of the tutor funnel.

   Same two reasons as /onboarding (see the note there): the role guard belongs on
   the server, and a 700-line client component shipped a page whose heading and
   upload form only existed once the bundle landed.

   The guard matters more here than almost anywhere: this screen collects national
   ID scans. A profile that is not a tutor has no business on it, and
   submitVerification would refuse the upload anyway — better to never present the
   form than to take someone's ID and then reject it. */
import { redirect } from "next/navigation";
import { VerifyInner } from "@/components/onboarding/VerifyInner";
import { getOnboardingState } from "@/app/actions";
import { pageGuard, localeOf, localePath } from "@/lib/page-guard";

export default async function VerifyPage({ params }: { params: { locale: string } }) {
  const locale = localeOf(params.locale);
  const guard = await pageGuard();

  if (guard.kind === "inert") return <VerifyInner state={null} />;
  if (guard.kind === "guest") {
    redirect(localePath(locale, "/auth", localePath(locale, "/onboarding/verify")));
  }
  if (guard.profile.role !== "tutor") redirect(localePath(locale, "/onboarding/upgrade"));

  return <VerifyInner state={await getOnboardingState()} />;
}
