import type { Metadata } from "next";
import { bilingual } from "@/lib/i18n";
import { isLocale, DEFAULT_LOCALE } from "@/lib/locale";
import { pageMetadata } from "@/lib/metadata";

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
    description: "دروسك المباشرة الجاية والحجوزات متاعك في Tnajem.",
  },
});

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const params = await props.params;
  const locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  return pageMetadata({ locale, path: "/student", ...copy[locale], noindex: true });
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
