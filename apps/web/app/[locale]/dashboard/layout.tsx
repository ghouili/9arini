import type { Metadata } from "next";
import { bilingual } from "@/lib/i18n";
import { isLocale, DEFAULT_LOCALE } from "@/lib/locale";
import { pageMetadata } from "@/lib/metadata";

/* Metadata for the tutor dashboard and everything under it (materials, new class,
   new pack, payout). The pages are client components, so this pass-through layout
   carries it. NOINDEX: a signed-in workspace has nothing a search engine should
   list. */
const copy = bilingual({
  fr: {
    title: "Mon tableau de bord",
    description: "Tes cours, tes réservations et ta page de prof sur Tnajem.",
  },
  ar: {
    title: "لوحة التحكم متاعي",
    description: "دروسك، الحجوزات وصفحتك كأستاذ في Tnajem.",
  },
});

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  return pageMetadata({ locale, path: "/dashboard", ...copy[locale], noindex: true });
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
