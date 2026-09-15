import type { Metadata } from "next";
import { NotFoundScreen } from "@/components/NotFoundScreen";
import { dict } from "@/lib/i18n";
import { isLocale, DEFAULT_LOCALE, type AppLocale } from "@/lib/locale";

/* The localized 404 for any path under /fr or /ar that is not a page.

   proxy.ts rewrites every unmatched path here (lib/route-table.ts) and sets
   the 404 status on the way; this page only has to say what happened, in the
   visitor's language, with a way onward — server-rendered, so it reads with
   JavaScript off. It replaced Next's built-in English "404: This page could not
   be found", which /fr/a/b used to get with no header, no locale and no link.

   REQUEST-TIME, never cached: an ISR entry per random URL would let anyone fill
   the disk by requesting nonsense paths. Nothing here is expensive to render. */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; rest: string[] }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const locale: AppLocale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  return { title: dict[locale].err.nfTitle, robots: { index: false, follow: false } };
}

export default async function NotFoundPage(props: Props) {
  const params = await props.params;
  const locale: AppLocale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  return <NotFoundScreen locale={locale} />;
}
