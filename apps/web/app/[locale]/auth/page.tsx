/* /auth - SERVER shell.

   ?next= is read here rather than with the client search-params hook. That hook
   forced the entire login form into a <Suspense> boundary, and Next bails such a
   boundary to client-only rendering on a statically-rendered route: the shipped
   HTML for /fr/auth had no <h1>, no phone field and no submit button at all - a
   blank login page for the whole JS window on 3G, and permanently blank if the
   bundle failed. Verified by scripts/ui-audit/nojs.mjs.

   Reading searchParams makes this route dynamic, which is correct: its content
   genuinely depends on the query string, and a login page is never cacheable.
   The OTP CHANNEL is resolved here too. otpChannel() is server-only, and reading
   it on the server keeps OTP_CHANNEL a runtime env var — a NEXT_PUBLIC_ value
   would be baked in at build time, so reverting to SMS would mean a rebuild
   rather than a restart. */
import { AuthInner } from "@/components/auth/AuthInner";
import { safeNext } from "@tnajem/shared";
import { otpChannel } from "@/lib/auth";

export default function AuthPage({
  searchParams,
}: {
  searchParams: { next?: string | string[] };
}) {
  const raw = Array.isArray(searchParams.next) ? searchParams.next[0] : searchParams.next;
  return <AuthInner next={safeNext(raw ?? null)} channel={otpChannel()} />;
}
