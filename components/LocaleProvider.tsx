"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { dict, type Dict } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

type Ctx = { locale: Locale; t: Dict; setLocale: (l: Locale) => void };
const LocaleContext = createContext<Ctx | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("fr");
  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("9arini.locale")) as Locale | null;
    if (saved === "ar" || saved === "fr") setLocale(saved);
  }, []);
  useEffect(() => {
    const el = document.documentElement;
    el.lang = locale; el.dir = locale === "ar" ? "rtl" : "ltr";
    try { localStorage.setItem("9arini.locale", locale); } catch {}
  }, [locale]);
  return <LocaleContext.Provider value={{ locale, t: dict[locale], setLocale }}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const c = useContext(LocaleContext);
  if (!c) throw new Error("useLocale must be used inside LocaleProvider");
  return c;
}
