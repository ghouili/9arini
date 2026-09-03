/* /student/welcome — SERVER shell for the student's first-run screen.

   Three jobs, all of which have to happen on the server:

   1. READ ?next= HERE, not with the client search-params hook. That hook forces the
      subtree into a <Suspense> boundary which Next bails to client-only rendering,
      so the form would be missing from the shipped HTML — the failure mode
      app/[locale]/auth/page.tsx documents at length and scripts/ui-audit/nojs.mjs
      exists to catch.

   2. PRE-FILL from the profile row. A student who skipped this screen and came back
      should see whatever they already gave us, not an empty form. Reading it here
      costs nothing (the session lookup already fetched the row) and avoids a
      client round-trip on a screen that is one tap from the product.

   3. ROLE GUARD. A tutor has no student profile to fill in; send them to their own
      onboarding rather than showing them a form that saveStudentProfile() would
      refuse anyway. */
import { redirect } from "next/navigation";
import { StudentWelcomeInner } from "@/components/student/StudentWelcomeInner";
import { safeNext } from "@/lib/validation";
import { pageGuard, localeOf, localePath } from "@/lib/page-guard";
import { STUDENT_LEVELS } from "@/lib/types";
import type { StudentLevel, StudentProfile } from "@/lib/types";

const EMPTY: StudentProfile = { fullName: null, level: null, subjects: [], phone: null };

export default async function StudentWelcomePage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { next?: string | string[] };
}) {
  const locale = localeOf(params.locale);
  const raw = Array.isArray(searchParams.next) ? searchParams.next[0] : searchParams.next;
  const next = safeNext(raw ?? null);

  const guard = await pageGuard();

  // Demo mode / UI audit harness: render the screen with an empty form.
  if (guard.kind === "inert") return <StudentWelcomeInner next={next} initial={EMPTY} />;

  // middleware.ts already bounces guests off /student/*; this is the belt to its
  // braces, and it preserves the destination they were heading for.
  if (guard.kind === "guest") {
    redirect(localePath(locale, "/auth", localePath(locale, "/student/welcome", next)));
  }

  const p = guard.profile;
  if (p.role !== "student") redirect(localePath(locale, "/onboarding"));

  const level = STUDENT_LEVELS.includes(p.level as StudentLevel) ? (p.level as StudentLevel) : null;
  const initial: StudentProfile = {
    fullName: p.fullName,
    level,
    // Stored comma-joined (the tutors.languages convention) — see schema.ts.
    subjects: (p.subjects ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    phone: p.phone,
  };

  return <StudentWelcomeInner next={next} initial={initial} />;
}
