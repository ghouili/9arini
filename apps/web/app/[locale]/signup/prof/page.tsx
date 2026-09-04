/* /signup/prof — tutor signup. SERVER shell.

   ?next= is read here rather than with the client search-params hook, for the
   reason app/[locale]/auth/page.tsx documents in full: that hook forces the form
   into a <Suspense> boundary, and Next bails such a boundary to client-only
   rendering, so the shipped HTML carries no heading, no phone field and no submit
   button. This is the top of the tutor funnel on Tunisian 3G — it renders in the
   first HTML payload or it does not render at all. tools/ui-audit/nojs.mjs
   asserts exactly that.

   Reading searchParams makes the route dynamic, which is correct: a signup page is
   never cacheable and its content genuinely depends on the query string.
   The OTP CHANNEL is resolved here too. otpChannel() is server-only, and reading
   it on the server keeps OTP_CHANNEL a runtime env var — a NEXT_PUBLIC_ value
   would be baked in at build time, so reverting to SMS would mean a rebuild
   rather than a restart. */
import { SignupInner } from "@/components/auth/SignupInner";
import { safeNext } from "@tnajem/shared";
import { otpChannel } from "@/lib/auth";

export default function SignupTutorPage({
  searchParams,
}: {
  searchParams: { next?: string | string[] };
}) {
  const raw = Array.isArray(searchParams.next) ? searchParams.next[0] : searchParams.next;
  return <SignupInner role="tutor" next={safeNext(raw ?? null)} channel={otpChannel()} />;
}
