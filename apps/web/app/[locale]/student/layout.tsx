import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { bilingual } from "@/lib/i18n";
import { isLocale, DEFAULT_LOCALE } from "@/lib/locale";
import { pageMetadata } from "@/lib/metadata";
import { pageGuard, localeOf, localePath } from "@/lib/page-guard";

/* Metadata for the student's space (and /student/welcome under it). The pages are
   client components, so this pass-through layout carries it. The title is the
   page's own heading, « Mes cours » (lib/i18n.ts student.title). NOINDEX: private. */
const copy = bilingual({
  fr: {
    title: "Mes cours",
    description: "Tes prochains cours en direct et tes réservations sur Tnajem.",
  },
  ar: {
    title: "حصصي",
    description: "حصصك الدايركت الجاية والحجوزات متاعك في Tnajem.", // phase-a lane L6 (A18.derija-2)
  },
});

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const params = await props.params;
  const locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  return pageMetadata({ locale, path: "/student", ...copy[locale], noindex: true });
}

/* phase-a lane L2 (A17) — REQUEST-TIME ONLY: the guard reads the session. */
export const dynamic = "force-dynamic";

/* phase-a lane L2 (A17) — the reverse of app/[locale]/dashboard/layout.tsx: a
   TUTOR who opens /student (or /student/welcome) is sent to their dashboard,
   server-side, before anything renders. Guests and the build-time "inert" state
   fall through to the pages' own handling. */
export default async function StudentLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const guard = await pageGuard();
  if (guard.kind === "user" && guard.profile.role === "tutor") {
    redirect(localePath(localeOf((await props.params).locale), "/dashboard"));
  }
  return <>{props.children}</>;
}
