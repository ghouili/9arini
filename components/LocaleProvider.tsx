"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { dict, type Dict } from "@/lib/i18n";
import { swapLocale, type AppLocale } from "@/lib/locale";

/* Locale now comes from the URL (/fr, /ar), passed down from the server layout as
   `initialLocale` — NOT from localStorage. That is what makes the locale visible to
   crawlers and knowable server-side. Switching locale navigates to the same page
   under the other prefix; a cookie remembers the choice for unprefixed entry points
   (middleware reads it). */
type Ctx = { locale: AppLocale; t: Dict; setLocale: (l: AppLocale) => void };
const LocaleContext = createContext<Ctx | null>(null);

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: AppLocale;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const value = useMemo<Ctx>(
    () => ({
      locale: initialLocale,
      t: dict[initialLocale],
      setLocale: (l: AppLocale) => {
        if (l === initialLocale) return;
        // Remember the choice so a later visit to an unprefixed URL lands in this locale.
        try {
          document.cookie = `NEXT_LOCALE=${l}; path=/; max-age=31536000; samesite=lax`;
        } catch {
          /* cookies disabled — the URL prefix is still the source of truth */
        }
        router.push(swapLocale(pathname, l));
      },
    }),
    [initialLocale, pathname, router],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const c = useContext(LocaleContext);
  if (!c) throw new Error("useLocale must be used inside LocaleProvider");
  return c;
}
