/* /signup/eleve — student signup. SERVER shell.

   ?next= is read here rather than with the client search-params hook, for the
   reason app/[locale]/auth/page.tsx documents in full: that hook forces the form
   into a <Suspense> boundary, and Next bails such a boundary to client-only
   rendering, so the shipped HTML carries no heading, no phone field and no submit
   button. This is the top of the student funnel on Tunisian 3G — it renders in the
   first HTML payload or it does not render at all. tools/ui-audit/nojs.mjs
   asserts exactly that.

   Reading searchParams makes the route dynamic, which is correct: a signup page is
   never cacheable and its content genuinely depends on the query string.
   The OTP CHANNEL is resolved here too. otpChannel() is server-only, and reading
   it on the server keeps OTP_CHANNEL a runtime env var — a NEXT_PUBLIC_ value
   would be baked in at build time, so reverting to SMS would mean a rebuild
   rather than a restart. */
import type { Metadata } from "next";
import { SignupInner } from "@/components/auth/SignupInner";
import { safeNext } from "@tnajem/shared";
import { otpChannel } from "@/lib/auth";
import { bilingual } from "@/lib/i18n";
import { isLocale, DEFAULT_LOCALE } from "@/lib/locale";
import { pageMetadata } from "@/lib/metadata";

/* REQUEST-TIME ONLY. The OTP channel is a runtime environment switch and ?next=
   differs per visitor; prerendered, both would be frozen at build. It used to be
   dynamic only by accident (app/[locale]/not-found.tsx called headers()). */
export const dynamic = "force-dynamic";

const meta = bilingual({
  fr: {
    title: "Créer mon compte élève",
    description: "Crée ton compte élève sur Tnajem pour réserver ta place dans les cours en direct de profs vérifiés.",
  },
  ar: {
    title: "اعمل حسابك كتلميذ",
    description: "اعمل حسابك كتلميذ في Tnajem باش تحجز بلاصتك في الدروس المباشرة متاع أساتذة مؤكّدين.",
  },
});

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const params = await props.params;
  const locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  return pageMetadata({ locale, path: "/signup/eleve", ...meta[locale] });
}

export default async function SignupStudentPage(props: { searchParams: Promise<{ next?: string | string[] }> }) {
  const searchParams = await props.searchParams;
  const raw = Array.isArray(searchParams.next) ? searchParams.next[0] : searchParams.next;
  return <SignupInner role="student" next={safeNext(raw ?? null)} channel={otpChannel()} />;
}
