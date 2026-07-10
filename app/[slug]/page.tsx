import { notFound } from "next/navigation";
import { StorefrontView } from "@/components/storefront/StorefrontView";
import { getStorefront } from "@/lib/data";

// Public tutor storefront (9arini.tn/<slug>). Server component: fetches from Postgres
// via the data layer (falls back to demo data when no DATABASE_URL is set).
export default async function StorefrontPage({ params }: { params: { slug: string } }) {
  const data = await getStorefront(params.slug);
  if (!data) notFound();
  return <StorefrontView data={data} />;
}
