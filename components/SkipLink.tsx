"use client";
import { useLocale } from "./LocaleProvider";

/* WCAG 2.4.1 Bypass Blocks.

   Every screen in the product sits under a sticky header that carries the site
   nav, the locale toggle and a CTA. Without a bypass, a keyboard or screen-reader
   user tabs through all of it on EVERY route before reaching the page content.

   Visually hidden until focused, then it becomes a normal button pinned to the
   top of the viewport. `clip-path` + 1px box rather than `display:none` or
   `visibility:hidden`, because those two remove the element from the tab order
   entirely — which is the classic way this control gets shipped broken.

   Positioned with `inset-inline-start`, so it lands top-right in Arabic. */
export function SkipLink() {
  const { t } = useLocale();
  return (
    <a href="#main" className="skip-link">
      {t.skipToContent}
    </a>
  );
}
