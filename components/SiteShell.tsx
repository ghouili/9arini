import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

/* Full-width responsive web shell (replaces the mobile <Frame> on web-redesigned
   screens). Header + footer are responsive; the page composes its own
   <section className="web-section"><div className="container">…</div></section>. */
export function SiteShell({ children, footer = true }: { children: ReactNode; footer?: boolean }) {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="web-main">{children}</main>
      {footer && <SiteFooter />}
    </div>
  );
}
