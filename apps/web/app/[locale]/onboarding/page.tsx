/* /onboarding — SERVER shell for step 1 of the tutor funnel.

   Two things move to the server here, and both were defects before:

   1. THE ROLE GUARD. This page was reachable by ANY signed-in profile, and
      createTutor() — which it submits to — used to write `role = 'tutor'` as a side
      effect of saving a name. The header offered signed-in students the link to it
      ("Créer ma page"), so a student became a tutor in two taps, silently, with no
      screen ever telling them their account had changed and no check that they were
      old enough to teach children. The action refuses a non-tutor now; this
      redirect is what turns that refusal into a coherent journey rather than an
      error message, by sending them to the screen that asks the question properly.

   2. THE FORM IS IN THE FIRST HTML PAYLOAD. The whole page used to be a client
      component. app/[locale]/auth/page.tsx documents what that costs on Tunisian
      3G: nothing renders until the bundle lands, and nothing renders at ALL if it
      never does. Shell on the server, interactivity in the child.

   The shell also reads the tutor's current storefront so the form opens pre-filled
   — createTutor has always updated in place, but the page opened blank, so a tutor
   fixing a typo was retyping their page from memory. */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingInner } from "@/components/onboarding/OnboardingInner";
import { getOnboardingState } from "@/app/actions";
import { pageGuard, localeOf, localePath } from "@/lib/page-guard";
import { bilingual } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";

/* REQUEST-TIME ONLY. The guard reads the visitor's session and redirects on it.
   Prerendered, a build would bake one answer — a redirect, or the inert state a
   build box without an API gets — into HTML served to everybody. This used to be
   dynamic only by accident (app/[locale]/not-found.tsx called headers()). */
export const dynamic = "force-dynamic";

/* NOINDEX: a signed-in form, reachable only with a session. */
const meta = bilingual({
  fr: {
    title: "Ma page de prof",
    description: "Remplis ta page de prof sur Tnajem : ton nom, ta matière, ta présentation.",
  },
  ar: {
    title: "صفحتي كأستاذ",
    description: "عمّر صفحتك كأستاذ في Tnajem : إسمك، المادة، والتقديم متاعك.",
  },
});

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const params = await props.params;
  const locale = localeOf(params.locale);
  return pageMetadata({ locale, path: "/onboarding", ...meta[locale], noindex: true });
}

export default async function OnboardingPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const locale = localeOf(params.locale);
  const guard = await pageGuard();

  // Demo mode / UI audit harness: no DB, so no role to check. Render the form.
  if (guard.kind === "inert") return <OnboardingInner state={null} />;
  if (guard.kind === "guest") {
    redirect(localePath(locale, "/auth", localePath(locale, "/onboarding")));
  }
  if (guard.profile.role !== "tutor") redirect(localePath(locale, "/onboarding/upgrade"));

  return <OnboardingInner state={await getOnboardingState()} />;
}
