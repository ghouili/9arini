/* The branded "not found" screen, shared by the two ways a visitor reaches one:

     • app/[locale]/[...rest]/page.tsx — middleware rewrites every 404 here: a URL
                                          that is no page, or a slug no tutor has
     • app/[locale]/[slug]/page.tsx    — the fallback when the middleware lookup
                                          could not answer (fail-open)

   SERVER component, and deliberately free of any top-level client component or
   client hook, because this markup MUST be in the first HTML payload.

   Why it is not just `notFound()`: measured on Next 14.2, a runtime notFound()
   renders its boundary on the CLIENT only — the production <body> for a bad
   slug came back literally empty (6 bytes). A visitor whose bundle had not
   arrived yet (a mid-range Android on 3G, which is the common case here) got a
   white screen instead of "this tutor doesn't exist, here's how to find one".
   So the storefront renders this screen inline instead of throwing; proxy.ts
   sets the 404 status, and generateMetadata adds `robots: noindex, nofollow`.

   Plain <a> rather than the locale-aware <Link>: <Link> is a client component,
   and a full document load is the right behaviour for a URL that does not exist.
   RTL-safe (logical properties only). Verified by tools/ui-audit/nojs.mjs. */
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
