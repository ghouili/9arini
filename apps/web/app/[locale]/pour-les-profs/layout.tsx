import type { Metadata } from "next";
import { bilingual } from "@/lib/i18n";
import { isLocale, DEFAULT_LOCALE } from "@/lib/locale";
import { pageMetadata } from "@/lib/metadata";

/* Metadata for /pour-les-profs. The page is a client component, which cannot
   export metadata, so this pass-through layout carries it.

   TUTOR-FACING, on purpose. Tutors forward this page to recruit other tutors, and
   its WhatsApp card used to show the site-wide student pitch ("apprends avec ton
   prof"). The description mirrors the page's own hero sentence. */
const copy = bilingual({
  fr: {
    title: "Pour les profs : ta page et tes cours en direct",
    description:
      "Profs : crée ta page gratuitement en 2 minutes, fixe ton tarif et donne tes cours en direct. Pendant le pilote, Tnajem ne prend rien.", // phase-a lane L3 (A22)
  },
  ar: {
    title: "للأساتذة : صفحتك ودروسك مباشرة",
    description:
      "أساتذة : اعمل صفحتك فابور في دقيقتين، حدّد تعريفتك، واعطي دروسك مباشرة. في فترة التجربة، Tnajem ما تاخذ والو.", // phase-a lane L3 (A22)
  },
});

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const params = await props.params;
  const locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  return pageMetadata({ locale, path: "/pour-les-profs", ...copy[locale] });
}

export default function PourLesProfsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
