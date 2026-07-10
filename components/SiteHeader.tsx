"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "./LocaleProvider";
import { LocaleToggle } from "./LocaleToggle";
import { getMe } from "@/app/actions";

/* Responsive top navigation for the full-width web layout.
   Auth-aware (shows account/dashboard when logged in). On phones the inline
   links collapse into a hamburger menu so every destination stays reachable. */
export function SiteHeader() {
  const { t } = useLocale();
  const [me, setMe] = useState<{ name: string | null; role: string } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => { getMe().then(setMe).catch(() => setMe(null)); }, []);

  const close = () => setOpen(false);

  return (
    <header className="site-header">
      <div className="container">
        <Link href="/" className="brand-mark" aria-label="9arini" onClick={close}>
          <span className="logo">ق</span>
          <span>9arini <span className="ar">قرّيني</span></span>
        </Link>

        <nav className="nav-links" aria-label="Navigation">
          <Link href="/explore">{t.nav.explore}</Link>
          <Link href="/onboarding">{t.home.becomeTutor}</Link>
        </nav>

        <div className="nav-spacer" />

        <div className="nav-right">
          <LocaleToggle />
          {me ? (
            <Link href={me.role === "tutor" ? "/dashboard" : "/account"} className="btn btn-ink btn-sm hide-mobile">
              {me.role === "tutor" ? t.nav.dashboard : t.account.title}
            </Link>
          ) : (
            <Link href="/onboarding" className="btn btn-primary btn-sm hide-mobile">{t.home.becomeTutor}</Link>
          )}

          {/* Mobile hamburger */}
          <button className="nav-menu-btn" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <svg viewBox="0 0 24 24" className="ic" aria-hidden="true">
              {open
                ? <><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>
                : <><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></>}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {open && (
        <div className="nav-menu" onClick={close}>
          <Link href="/explore">{t.nav.explore}</Link>
          <Link href="/onboarding">{t.home.becomeTutor}</Link>
          <Link href="/student">{t.home.forStudents}</Link>
          {me ? (
            <Link href={me.role === "tutor" ? "/dashboard" : "/account"}>
              {me.role === "tutor" ? t.nav.dashboard : t.account.title}
            </Link>
          ) : (
            <Link href="/auth">{t.auth.title}</Link>
          )}
        </div>
      )}
    </header>
  );
}
