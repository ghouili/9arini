"use client";
/* Branded error boundary — replaces Next's default white English error screen.
   Must be a client component and must expose a reset() button (Next contract).
   Rendered inside the root layout, so LocaleProvider (useLocale) is available.
   Bilingual FR + Derija, RTL-safe (logical properties only). */
import { useEffect } from "react";
import { Link } from "@/components/Link";
import { SiteShell } from "@/components/SiteShell";
import { useLocale } from "@/components/LocaleProvider";
import { Home } from "@/components/icons";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLocale();

  useEffect(() => {
    // Surfaces the stack in dev; hook a real reporter (Sentry…) here later.
    console.error("[Tnajem] unhandled error", error);
  }, [error]);

  return (
    <SiteShell>
      <section className="web-section">
        <div className="container container-narrow">
          <div className="panel panel-pad rise" style={{ textAlign: "center" }}>
            <div
              style={{
                width: 84,
                height: 84,
                borderRadius: 24,
                margin: "0 auto 22px",
                display: "grid",
                placeItems: "center",
                background: "var(--rose50)",
                color: "var(--rose)",
              }}
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" className="ic" style={{ width: 38, height: 38 }} aria-hidden="true">
                <path d="M12 3.6 21 19.5H3L12 3.6z" />
                <line x1="12" y1="10" x2="12" y2="14" />
                <circle cx="12" cy="16.8" r="0.9" className="fill" />
              </svg>
            </div>

            <h1 className="web-h2" style={{ marginBottom: 12 }}>{t.err.crashTitle}</h1>
            <p className="web-lead" style={{ marginBottom: 26 }}>{t.err.crashBody}</p>

            <div className="cluster" style={{ justifyContent: "center" }}>
              <button type="button" onClick={reset} className="btn btn-primary btn-sm">
                {t.err.retry}
              </button>
              <Link href="/" className="btn btn-ghost btn-sm">
                <Home className="ic" />
                {t.err.home}
              </Link>
            </div>

            {error.digest && (
              <p className="help" style={{ marginTop: 18 }}>
                {t.err.ref}: <code>{error.digest}</code>
              </p>
            )}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
