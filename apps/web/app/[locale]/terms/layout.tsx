import type { Metadata } from "next";
import { bilingual } from "@/lib/i18n";
import { isLocale, DEFAULT_LOCALE } from "@/lib/locale";
import { pageMetadata } from "@/lib/metadata";

/* Metadata for /terms. The page is a client component, so this pass-through layout
   carries it. The title repeats the page's own heading (terms/page.tsx c.title) —
   a page file cannot export its copy object, so keep the two equal by hand. */
const copy = bilingual({
  fr: {
    title: "Conditions d'utilisation",
    description: "Les conditions d'utilisation de Tnajem : les règles entre les profs, les élèves, leurs parents et la plateforme.",
  },
  ar: {
    title: "شروط الاستعمال",
    description: "شروط استعمال Tnajem : القواعد بين الأساتذة، التلامذة، الأولياء والمنصّة.",
  },
});

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const params = await props.params;
  const locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  return pageMetadata({ locale, path: "/terms", ...copy[locale] });
}

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
