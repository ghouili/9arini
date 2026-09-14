import type { Metadata } from "next";
import { bilingual } from "@/lib/i18n";
import { isLocale, DEFAULT_LOCALE } from "@/lib/locale";
import { pageMetadata } from "@/lib/metadata";

/* Metadata for /privacy. The page is a client component, so this pass-through
   layout carries it. The title repeats the page's own heading (privacy/page.tsx
   c.title) — a page file cannot export its copy object, so keep the two equal. */
const copy = bilingual({
  fr: {
    title: "Politique de confidentialité",
    description: "Quelles données Tnajem collecte, pourquoi, combien de temps elles sont gardées, et comment les faire supprimer.",
  },
  ar: {
    title: "سياسة الخصوصية",
    description: "شنوّة المعطيات اللي تجمعها Tnajem، علاش، قدّاش من وقت تتخزّن، وكيفاش تنجّم تفسخها.",
  },
});

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  return pageMetadata({ locale, path: "/privacy", ...copy[locale] });
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
