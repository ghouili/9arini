/* The branded "not found" screen, shared by the two ways a visitor reaches one:

     • app/[locale]/not-found.tsx      — a URL that matches no route at all
     • app/[locale]/[slug]/page.tsx    — a tutor slug that does not exist

   SERVER component, and deliberately free of any top-level client component or
   client hook, because this markup MUST be in the first HTML payload.

   Why it is not just `notFound()`: measured on Next 14.2, a runtime notFound()
   renders its boundary on the CLIENT only — the production <body> for a bad
   slug came back literally empty (6 bytes). A visitor whose bundle had not
   arrived yet (a mid-range Android on 3G, which is the common case here) got a
   white screen instead of "this tutor doesn't exist, here's how to find one".
   So the storefront renders this screen inline instead of throwing, and relies
   on `robots: noindex, nofollow` (set in that route's generateMetadata) to keep
   dead slugs out of the index. Trade-off recorded in the audit report.

   Plain <a> rather than the locale-aware <Link>: <Link> is a client component,
   and a full document load is the right behaviour for a URL that does not exist.
   RTL-safe (logical properties only). Verified by scripts/ui-audit/nojs.mjs. */
import { dict } from "@/lib/i18n";
import type { AppLocale } from "@/lib/locale";
import { SiteShell } from "@/components/SiteShell";
import { Search, Home } from "@/components/icons";

export function NotFoundScreen({ locale }: { locale: AppLocale }) {
  const t = dict[locale];

  return (
    <SiteShell>
      <section className="web-section">
        <div className="container container-narrow">
          <div className="panel panel-pad rise" style={{ textAlign: "center" }}>
            <div
              className="zellige hero-blue"
              style={{
                width: 96,
                height: 96,
                borderRadius: 26,
                margin: "0 auto 22px",
                display: "grid",
                placeItems: "center",
                fontFamily: "var(--fd)",
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: "-1px",
              }}
              aria-hidden="true"
            >
              {t.err.nfCode}
            </div>

            <h1 className="web-h2" style={{ marginBottom: 12 }}>{t.err.nfTitle}</h1>
            <p className="web-lead" style={{ marginBottom: 26 }}>{t.err.nfBody}</p>

            <div className="cluster" style={{ justifyContent: "center" }}>
              <a href={`/${locale}/explore`} className="btn btn-primary btn-sm">
                <Search className="ic" />
                {t.err.nfExplore}
              </a>
              <a href={`/${locale}`} className="btn btn-ghost btn-sm">
                <Home className="ic" />
                {t.err.nfHome}
              </a>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
