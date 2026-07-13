"use client";
import { Link } from "@/components/Link";
import { useLocale } from "./LocaleProvider";

/* Site footer — brand, product links, legal (terms/privacy) and a contact route.
   Bilingual + RTL-safe: logical properties only, no left/right.
   Page-scoped CSS is prefixed `qf-` and injected with dangerouslySetInnerHTML
   (inline <style>{`…`}</style> in a client component triggers hydration errors). */

const CONTACT_EMAIL = "contact@9arini.tn";

const CSS = `
.site-footer .container.qf-grid{
  display:grid;grid-template-columns:1fr;gap:28px;align-items:start;justify-content:initial;
  padding-top:44px;padding-bottom:28px;
}
@media (min-width:760px){
  .site-footer .container.qf-grid{grid-template-columns:1.4fr 1fr 1fr;gap:40px}
}
.qf-brand p{margin-top:12px;max-width:34ch;font-size:13.5px;line-height:1.6;color:var(--muted)}
.qf-col h3{font-family:var(--fd);font-size:13px;letter-spacing:.4px;text-transform:uppercase;
  color:var(--ink);margin-bottom:12px}
.qf-col ul{list-style:none;display:flex;flex-direction:column;gap:9px}
.qf-col a{font-size:13.5px;font-weight:600;color:var(--muted);transition:.15s}
.qf-col a:hover{color:var(--blue)}
.qf-bottom{border-top:1px solid var(--line)}
.site-footer .container.qf-bottom-in{
  display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;
  padding-top:16px;padding-bottom:26px;font-size:12.5px;color:var(--muted);
}
`;

export function SiteFooter() {
  const { t } = useLocale();
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="container qf-grid">
        <div className="qf-brand">
          <div className="brand-mark" style={{ fontSize: 17 }}>
            <span className="logo" style={{ width: 32, height: 32, fontSize: 17 }}>ق</span>
            <span>9arini <span className="ar">قرّيني</span></span>
          </div>
          <p>{t.footer.tagline}</p>
        </div>

        <nav className="qf-col" aria-label={t.footer.product}>
          <h3>{t.footer.product}</h3>
          <ul>
            <li><Link href="/explore">{t.nav.explore}</Link></li>
            <li><Link href="/pour-les-profs">{t.home.becomeTutor}</Link></li>
            <li><Link href="/onboarding">{t.dashboard.createStore}</Link></li>
            <li><Link href="/auth">{t.auth.title}</Link></li>
          </ul>
        </nav>

        <nav className="qf-col" aria-label={t.footer.legal}>
          <h3>{t.footer.legal}</h3>
          <ul>
            <li><Link href="/terms">{t.footer.terms}</Link></li>
            <li><Link href="/privacy">{t.footer.privacy}</Link></li>
            <li><a href={`mailto:${CONTACT_EMAIL}`}>{t.footer.contact}</a></li>
          </ul>
        </nav>
      </div>

      <div className="qf-bottom">
        <div className="container qf-bottom-in">
          <span>{t.footer.rights(year)}</span>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </div>
      </div>
    </footer>
  );
}
