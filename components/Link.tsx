"use client";
import NextLink from "next/link";
import { useRouter as useNextRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { useLocale } from "./LocaleProvider";
import { withLocale } from "@/lib/locale";

/* Drop-in replacements for next/link + next/navigation's useRouter that prefix
   same-origin string paths with the ACTIVE locale (/explore → /fr/explore). This is
   an OPTIMIZATION, not a correctness requirement: middleware.ts redirects any
   unprefixed path to the locale-prefixed one anyway, so a missed link costs one
   redirect hop, never a broken route. Swapping the imports app-wide just avoids the
   hop. External URLs, anchors and already-prefixed paths pass through untouched. */

type LinkProps = ComponentProps<typeof NextLink>;

export function Link({ href, ...props }: LinkProps) {
  const { locale } = useLocale();
  const h = typeof href === "string" ? withLocale(href, locale) : href;
  return <NextLink href={h} {...props} />;
}

/** useRouter whose push/replace prefix the active locale. Other methods pass through. */
export function useLocalizedRouter() {
  const router = useNextRouter();
  const { locale } = useLocale();
  return {
    push: (href: string) => router.push(withLocale(href, locale)),
    replace: (href: string) => router.replace(withLocale(href, locale)),
    back: () => router.back(),
    forward: () => router.forward(),
    refresh: () => router.refresh(),
    prefetch: (href: string) => router.prefetch(withLocale(href, locale)),
  };
}
