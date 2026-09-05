import type { Metadata } from "next";
import { ExploreClient } from "@/components/explore/ExploreClient";
import { getExploreTutors } from "@/app/actions";
import { isLocale, DEFAULT_LOCALE, type AppLocale } from "@/lib/locale";

/* /explore — the marketplace feed. SERVER component now (was client-rendered, so
   crawlers saw an empty grid — the single biggest SEO defect in the app).

   It fetches the unfiltered verified tutors server-side and hands them to the
   ExploreClient island as `initial`, so the real catalogue ships in the first HTML
   payload — indexable by Google, and painted instantly on a 3G phone with no client
   round-trip. Interactive filtering (subject chips + search) then runs in the island.

   Cacheable: this page reads no cookies and nothing user-specific, so ISR serves the
   same HTML to everyone for up to 60s (a viral /explore hit costs zero DB queries on
   a cache hit — same posture as the storefront). getExploreTutors reads only the DB,
   never cookies/headers, so calling it here keeps the route static+ISR (not dynamic).
   Filtered/searched views are handled client-side and are intentionally not indexed
   (the canonical, indexable page is the full list). */
export const revalidate = 60;

/* REQUEST-TIME, NOT BUILD-TIME.

   The catalogue now comes from apps/api over HTTP, and a container image is built
   with no API running — prerendering this died with ECONNREFUSED on 127.0.0.1:4000.
   The sitemap had the identical problem and the identical fix.

   Making it dynamic also matches what this route ALREADY did. It was labelled
   "(SSG)" in the build output and a comment here claimed calling getExploreTutors
   from the server component "keeps the route static+ISR", but measurement said
   otherwise: a tutor seeded after the build appeared on the very next request, and
   .next/server/app/[locale]/explore contained only page.js with no prerendered
   HTML. So this is not a caching regression — it is the label finally matching the
   behaviour. e2e/isr.spec.ts records the measurement. */
export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tnajem.tn";

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const locale: AppLocale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  const ar = locale === "ar";
  const canonical = `/${locale}/explore`;
  const title = ar ? "استكشف الأساتذة المؤكّدين" : "Explorer les profs vérifiés";
  const description = ar
    ? "تصفّح الأساتذة التوانسة المؤكّدين على Tnajem — رياضيات، فيزياء، فرنسية، إنقليزية وأكثر، من الابتدائي للباك. الحصة الأولى مجانية، الخلاص بالدينار."
    : "Parcours les profs particuliers tunisiens vérifiés sur Tnajem — maths, physique, français, anglais et plus, du primaire au Bac. Première séance offerte, paiement en dinar.";
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: { "fr-TN": "/fr/explore", "ar-TN": "/ar/explore", "x-default": "/fr/explore" },
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

export default async function ExplorePage() {
  // null (dev demo, no DB) → the island shows its clearly-badged preview.
  // [] (real DB, no verified tutor yet) → honest empty state.
  // [..] → the real, verified catalogue, rendered into the SSR HTML.
  const initial = await getExploreTutors({});
  return <ExploreClient initial={initial} />;
}
