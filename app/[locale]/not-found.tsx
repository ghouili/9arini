/* Branded 404 for a URL that matches no route at all.

   SERVER component, with no top-level client component: a "use client"
   not-found.tsx is shipped as a client module reference and mounted by Next's
   own NotFoundBoundary in the browser, so none of its markup reaches the HTML.

   `params` is not passed to a not-found boundary, so the locale arrives via the
   request header middleware.ts sets (LOCALE_HEADER). */
import { headers } from "next/headers";
import { NotFoundScreen } from "@/components/NotFoundScreen";
import { isLocale, DEFAULT_LOCALE, LOCALE_HEADER, type AppLocale } from "@/lib/locale";

export default function NotFound() {
  const raw = headers().get(LOCALE_HEADER);
  const locale: AppLocale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  return <NotFoundScreen locale={locale} />;
}
