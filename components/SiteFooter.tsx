"use client";
import Link from "next/link";
import { useLocale } from "./LocaleProvider";

export function SiteFooter() {
  const { t } = useLocale();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="brand-mark" style={{ fontSize: 17 }}>
          <span className="logo" style={{ width: 32, height: 32, fontSize: 17 }}>ق</span>
          <span>9arini <span className="ar">قرّيني</span></span>
        </div>
        <nav className="cluster" style={{ gap: 22, fontWeight: 600, fontSize: 14 }} aria-label="Footer">
          <Link href="/explore">{t.nav.explore}</Link>
          <Link href="/onboarding">{t.home.becomeTutor}</Link>
          <Link href="/auth">{t.auth.title}</Link>
        </nav>
        <span>© 2026 9arini · Tunisie</span>
      </div>
    </footer>
  );
}
