"use client";
import { Link } from "@/components/Link";
import { usePathname } from "next/navigation";
import { useLocale } from "./LocaleProvider";
import { Home, Video, Plus, Wallet, User, Shield } from "./icons";

/* Shared tutor-area nav. Desktop: the sticky column (.app-sidebar). Mobile: the
   same items as a horizontal, self-scrolling strip above the content — before,
   .app-sidebar was display:none under 1024px and a tutor on a phone had no way
   to reach payout / verification / new-pack except the browser back button.

   Page-scoped CSS is prefixed `qs-`, injected with dangerouslySetInnerHTML
   (inline <style>{`…`}</style> in a client component triggers hydration errors)
   and UNLAYERED, so it wins over globals.css's @layer components. */

const NAV = {
  fr: { verify: "Vérification", label: "Espace prof" },
  ar: { verify: "التثبّت", label: "فضاء الأستاذ" },
} as const;

const CSS = `
/* mobile: horizontal strip that scrolls inside itself (never the page body) */
.qs-wrap{display:block;margin-bottom:14px}
.qs-nav{display:flex;gap:8px;overflow-x:auto;padding-block:2px;padding-inline:2px;
  scrollbar-width:none;-webkit-overflow-scrolling:touch}
.qs-nav::-webkit-scrollbar{display:none}
.qs-nav a{flex:none;display:inline-flex;align-items:center;gap:8px;white-space:nowrap;
  padding:10px 14px;border-radius:999px;font-weight:600;font-size:13.5px;min-height:44px;
  color:var(--ink2);background:var(--paper);border:1px solid var(--line)}
.qs-nav a:hover{color:var(--blue);border-color:var(--blue)}
.qs-nav a[aria-current="page"]{background:var(--ink);color:#fff;border-color:var(--ink)}
.qs-nav .ic{width:17px;height:17px;flex:none}
.qs-title{display:none}
@media (min-width:1024px){
  .qs-wrap{position:sticky;top:84px;margin-bottom:0}
  .qs-title{display:block;font-size:13px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;
    color:var(--muted);padding:0 13px 10px}
  .qs-nav{flex-direction:column;gap:4px;overflow:visible}
  .qs-nav a{width:100%;border-radius:12px;border-color:transparent;background:transparent;font-size:14px}
  .qs-nav a:hover{background:var(--blue50);border-color:transparent}
  .qs-nav .ic{width:19px;height:19px}
}
html[dir="rtl"] .qs-title{letter-spacing:normal}
`;

export function DashboardSidebar() {
  const { t, locale } = useLocale();
  const c = NAV[locale];
  // usePathname() returns the locale-prefixed path (/fr/dashboard) while our
  // hrefs are unprefixed — strip it or nothing is ever marked active.
  const path = (usePathname() ?? "/").replace(/^\/(fr|ar)(?=\/|$)/, "") || "/";

  const items = [
    { href: "/dashboard", Icon: Home, label: t.nav.dashboard },
    { href: "/dashboard/new-class", Icon: Video, label: t.dashboard.newClass },
    { href: "/dashboard/new-pack", Icon: Plus, label: t.dashboard.newPack },
    { href: "/onboarding/verify", Icon: Shield, label: c.verify },
    { href: "/dashboard/payout", Icon: Wallet, label: t.payout.title },
    { href: "/account", Icon: User, label: t.account.title },
  ];

  return (
    <aside className="app-sidebar qs-wrap" style={{ display: "block", minWidth: 0 }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="qs-title">{c.label}</div>
      <nav className="qs-nav" aria-label={c.label}>
        {items.map(({ href, Icon, label }) => (
          <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>
            <Icon />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
