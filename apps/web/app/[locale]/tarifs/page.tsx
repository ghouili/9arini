import type { Metadata } from "next";
import { TarifsInner } from "@/components/tarifs/TarifsInner";
import { paymentsEnabled } from "@tnajem/shared/payments";
import { COMMISSION_PCT, requirePlan, tnd } from "@tnajem/shared";
import { isLocale, DEFAULT_LOCALE, type AppLocale } from "@/lib/locale";

/* /tarifs — the public pricing page.

   SERVER shell + client island, like /explore. Two reasons it is not a plain
   "use client" page like /pour-les-profs:

   1. Pricing is the page people search for and link to, so it needs a real
      <title>, canonical and hreflang. A client component cannot export metadata.
   2. It lets the banner be driven by the ACTUAL payment switch instead of a
      hardcoded assumption. paymentsEnabled() is server-only, so the shell reads
      it here and hands the island a boolean. The day PAYMENTS_ENABLED flips, the
      page stops saying "nothing is billed yet" on its own — nobody has to
      remember to come back and edit this copy.

   The prices below are the FINAL model but are NOT being charged. Every surface
   that names them must label them as future; see TarifsInner. */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tnajem.tn";

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const locale: AppLocale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  const ar = locale === "ar";
  const canonical = `/${locale}/tarifs`;
  const title = ar ? "الأسعار" : "Tarifs";
  /* DERIVED, not typed out. This is the sentence Google shows, and it said the
     subscription starts at 29 TND while the page below it renders a 0 TND tier as
     its first card — the search result contradicted the page it linked to. */
  const from = tnd(requirePlan("essentiel").monthlyMillimes);
  const description = ar
    ? `أسعار Tnajem للأساتذة : فابور في فترة التجربة. من بعد، اشتراك فابور بدرس واحد ومن ${from} دينار في الشهر لفوق، و ${COMMISSION_PCT} % كان على الخلاص اللي يعدّي من Tnajem. التلميذ ما يخلّص حتى حاجة لـ Tnajem.`
    : `Les tarifs Tnajem pour les profs : gratuit pendant le pilote. Plus tard, un abonnement gratuit pour un cours à la fois puis à partir de ${from} TND/mois, et ${COMMISSION_PCT} % uniquement sur les paiements traités par Tnajem. L'élève ne paie jamais Tnajem.`;
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: { "fr-TN": "/fr/tarifs", "ar-TN": "/ar/tarifs", "x-default": "/fr/tarifs" },
    },
    openGraph: {
      type: "website",
      url: `${SITE_URL}${canonical}`,
      locale: ar ? "ar_TN" : "fr_TN",
      title: `${title} · Tnajem`,
      description,
    },
  };
}

export default function TarifsPage() {
  return <TarifsInner paymentsEnabled={paymentsEnabled()} />;
}
