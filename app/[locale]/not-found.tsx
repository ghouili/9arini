"use client";
/* Branded 404 — replaces Next's default white English page.
   Rendered inside the root layout, so LocaleProvider (and useLocale) is available.
   Bilingual FR + Derija, RTL-safe (logical properties only). */
import { Link } from "@/components/Link";
import { SiteShell } from "@/components/SiteShell";
import { useLocale } from "@/components/LocaleProvider";
import { Search, Home } from "@/components/icons";

export default function NotFound() {
  const { t } = useLocale();

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
              <Link href="/explore" className="btn btn-primary btn-sm">
                <Search className="ic" />
                {t.err.nfExplore}
              </Link>
              <Link href="/" className="btn btn-ghost btn-sm">
                <Home className="ic" />
                {t.err.nfHome}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
