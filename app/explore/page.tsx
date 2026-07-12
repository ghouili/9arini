import type { Metadata } from "next";
import { ExploreClient } from "@/components/explore/ExploreClient";
import { getExploreTutors } from "@/app/actions";

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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://9arini.tn";

export const metadata: Metadata = {
  title: "Explorer les profs vérifiés",
  description:
    "Parcours les profs particuliers tunisiens vérifiés sur 9arini — maths, physique, français, anglais et plus, du primaire au Bac. Première séance offerte, paiement en dinar.",
  alternates: { canonical: "/explore" },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/explore`,
    title: "Explorer les profs vérifiés · 9arini",
    description:
      "Des profs tunisiens vérifiés un par un. Toutes les matières, du primaire au Bac. Première séance offerte.",
  },
};

export default async function ExplorePage() {
  // null (dev demo, no DB) → the island shows its clearly-badged preview.
  // [] (real DB, no verified tutor yet) → honest empty state.
  // [..] → the real, verified catalogue, rendered into the SSR HTML.
  const initial = await getExploreTutors({});
  return <ExploreClient initial={initial} />;
}
