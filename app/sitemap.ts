import type { MetadataRoute } from "next";
import { getCachedPublicTutorRefs } from "@/lib/cache";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://9arini.tn";

/* Regenerate at most once an hour. Without this, /sitemap.xml is a dynamic route
   (it reads the DB) and EVERY crawler hit — Googlebot, Bingbot, plus every SEO
   scraper on the internet, all of which poll it far more eagerly than they should
   — runs an unbounded `select ... from tutors where status = 'verified'` with no
   LIMIT. That is the one full-table scan in the codebase, and it is exposed at a
   public URL that anyone can hammer: `curl https://9arini.tn/sitemap.xml` in a
   loop is a free denial-of-service on the same connection pool that serves logins.

   Cached, the scan runs once an hour no matter who asks. The data cache
   (getCachedPublicTutorRefs) additionally shares that one result across pm2
   workers' renders and survives this route being re-rendered.

   Literal on purpose: Next only accepts a statically analyzable value here, so it
   cannot be imported from lib/cache.ts. Keep it equal to SITEMAP_TTL (3600). */
export const revalidate = 3600;

/* Static public routes. */
const ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/pour-les-profs", priority: 0.9, changeFrequency: "weekly" },
  { path: "/explore", priority: 0.9, changeFrequency: "daily" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
];

/* Tutor storefronts (/[slug]) are the most-shared pages in the product — tutors
   paste their link on WhatsApp, TikTok and Insta — so they belong in the sitemap.

   Only VERIFIED tutors are listed: that is exactly the set getStorefront() serves
   (pending/rejected slugs 404), so we never hand a crawler a dead URL.

   Failure mode: getPublicTutorRefs() swallows DB errors and returns []. This runs
   at build time, and a build box without DATABASE_URL (or a DB that is briefly
   unreachable) must still produce a valid sitemap of the static routes rather than
   throw and take the whole build down with it. Worst case we ship a sitemap that
   is missing the storefronts until the next deploy — an omission, never a 404. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));

  const tutors = await getCachedPublicTutorRefs();

  const tutorRoutes: MetadataRoute.Sitemap = tutors.map(({ slug, lastModified }) => ({
    url: `${SITE_URL}/${slug}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticRoutes, ...tutorRoutes];
}
