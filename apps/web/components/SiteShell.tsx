import type { ReactNode } from "react";
import { SkipLink } from "./SkipLink";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

/* Full-width responsive web shell (replaces the mobile <Frame> on web-redesigned
   screens). Header + footer are responsive; the page composes its own
   <section className="web-section"><div className="container">…</div></section>. */
export function SiteShell({ children, footer = true }: { children: ReactNode; footer?: boolean }) {
  return (
    <div className="site-shell">
      {/* First focusable element on the page — see SkipLink (WCAG 2.4.1). */}
      <SkipLink />
      <SiteHeader />
      {/* id + tabIndex: the skip link's target must be focusable for the jump to
          actually move focus (not just scroll) in Safari and older Chromium. */}
      <main id="main" tabIndex={-1} className="web-main">{children}</main>
      {footer && <SiteFooter />}
    </div>
  );
}
