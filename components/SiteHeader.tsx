"use client";
import { Link } from "@/components/Link";
import { useEffect, useState } from "react";
import { useLocale } from "./LocaleProvider";
import { LocaleToggle } from "./LocaleToggle";

/* The coarse role for nav, read from the readable ROLE_HINT_COOKIE (lib/auth.ts).
   This REPLACES a getMe() server-action POST that used to fire on every page load —
   which meant every perfectly-cached page still dragged an uncacheable POST behind
   it for every visitor (SCALABILITY.md / launch brief Phase 2). Reading a cookie is
   zero network. It is a display hint only: a stale/forged value at worst shows a nav
   link that bounces to /auth (middleware) — every action re-checks the real session. */
function readRoleHint(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)9arini_role=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/* Responsive top navigation for the full-width web layout.
   Auth-aware (shows account/dashboard when logged in). On phones the inline
   links collapse into a hamburger menu so every destination stays reachable. */
export function SiteHeader() {
  const { t } = useLocale();
  const [role, setRole] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // Post-hydration read (server render is auth-agnostic so the HTML stays cacheable).
  useEffect(() => { setRole(readRoleHint()); }, []);

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
          {role ? (
            <Link href={role === "tutor" ? "/dashboard" : "/account"} className="btn btn-ink btn-sm hide-mobile">
              {role === "tutor" ? t.nav.dashboard : t.account.title}
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
          {role ? (
            <Link href={role === "tutor" ? "/dashboard" : "/account"}>
              {role === "tutor" ? t.nav.dashboard : t.account.title}
            </Link>
          ) : (
            <Link href="/auth">{t.auth.title}</Link>
          )}
        </div>
      )}
    </header>
  );
}
