"use client";
import { Link } from "@/components/Link";
import { usePathname } from "next/navigation";
import { useLocale } from "./LocaleProvider";
import { Home, Video, Plus, Wallet, User } from "./icons";

/* Shared tutor-area sidebar (desktop only via .app-sidebar CSS). Used by the
   dashboard and its sub-pages so the tutor admin feels consistent. */
export function DashboardSidebar() {
  const { t } = useLocale();
  const path = usePathname();
  const items = [
    { href: "/dashboard", Icon: Home, label: t.nav.dashboard },
    { href: "/dashboard/new-class", Icon: Video, label: t.dashboard.newClass },
    { href: "/dashboard/new-pack", Icon: Plus, label: t.dashboard.newPack },
    { href: "/dashboard/payout", Icon: Wallet, label: t.payout.title },
    { href: "/account", Icon: User, label: t.account.title },
  ];
  return (
    <aside className="app-sidebar">
      <nav className="side-nav" aria-label="Dashboard">
        {items.map(({ href, Icon, label }) => (
          <Link key={href} href={href} className={path === href ? "active" : ""}>
            <Icon /> {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
