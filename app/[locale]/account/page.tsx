"use client";
import { useEffect, useState } from "react";
import { logout, getMe } from "@/app/actions";
import { Button } from "@/components/ui";
import { LocaleToggle } from "@/components/LocaleToggle";
import { useLocale } from "@/components/LocaleProvider";
import { Phone, User, Forward } from "@/components/icons";
import { SiteShell } from "@/components/SiteShell";

const WA_LINK = "https://wa.me/216XXXXXXXX";

/* Page-local copy (lib/i18n.ts is shared/read-only). */
const copy = {
  fr: { sub: "Ta langue, ton rôle, et comment nous joindre." },
  ar: { sub: "لغتك، دورك، وكيفاش تتصل بينا." },
} as const;

export default function AccountPage() {
  const { t, locale } = useLocale();
  const c = copy[locale];
  const [me, setMe] = useState<{ name: string | null; role: string; phone: string | null } | null>(null);

  useEffect(() => { getMe().then(setMe).catch(() => setMe(null)); }, []);

  async function handleLogout() {
    await logout();
    window.location.href = "/";
  }

  return (
    <SiteShell>
      <section className="web-section">
        <div className="container container-narrow" style={{ maxWidth: 760 }}>

          {/* Page heading — the eyebrow used to repeat the h1 verbatim */}
          <div style={{ marginBottom: "clamp(20px, 3vw, 36px)" }}>
            <h1 className="web-h2">{t.account.title}</h1>
            <p className="muted" style={{ fontSize: 13.5, marginTop: 6 }}>{c.sub}</p>
          </div>

          {/* Settings panel */}
          <div className="panel panel-pad">

            {/* Avatar + identity block */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "clamp(14px, 2vw, 22px)",
                paddingBottom: "clamp(16px, 2vw, 22px)",
                borderBottom: "1px solid var(--line)",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  minWidth: 72,
                  borderRadius: 22,
                  background: "linear-gradient(150deg, var(--blue), var(--blue900))",
                  display: "grid",
                  placeItems: "center",
                  color: "#fff",
                  fontFamily: "var(--fd)",
                  fontSize: 28,
                  boxShadow: "var(--sh)",
                  flexShrink: 0,
                }}
                aria-hidden="true"
              >
                <User style={{ width: 32, height: 32, stroke: "#fff" }} />
              </div>
              <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                <div style={{ fontFamily: "var(--fd)", fontSize: "clamp(16px, 2vw, 20px)", fontWeight: 700, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {me?.name || "—"}
                </div>
                {me?.phone && (
                  <div dir="ltr" style={{ fontSize: 14, color: "var(--muted)", textAlign: "start" }}>{me.phone}</div>
                )}
              </div>
            </div>

            {/* Language row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "clamp(14px, 2vw, 18px) 0",
                borderBottom: "1px solid var(--line)",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 600 }}>{t.account.language}</span>
              <LocaleToggle />
            </div>

            {/* Role row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "clamp(14px, 2vw, 18px) 0",
                borderBottom: "1px solid var(--line)",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 600 }}>{t.account.role}</span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  padding: "6px 14px",
                  borderRadius: 999,
                  background: "var(--blue50)",
                  color: "var(--blue)",
                  flexShrink: 0,
                  minHeight: 32,
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                {me?.role === "tutor" ? t.auth.asTutor : t.auth.asStudent}
              </span>
            </div>

            {/* Help / WhatsApp row */}
            <a
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "clamp(14px, 2vw, 18px) 0",
                gap: 12,
                textDecoration: "none",
                color: "var(--ink)",
                minHeight: 44,
              }}
              aria-label={t.account.help}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    minWidth: 40,
                    borderRadius: 11,
                    background: "var(--green50)",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                >
                  <Phone style={{ width: 18, height: 18, stroke: "var(--green)" }} />
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, minWidth: 0 }}>{t.account.help}</span>
              </div>
              <Forward style={{ color: "var(--muted)", width: 18, height: 18, flexShrink: 0 }} aria-hidden="true" />
            </a>

          </div>

          {/* Logout button */}
          <div style={{ marginTop: "clamp(14px, 2vw, 22px)", maxWidth: 320 }}>
            <Button variant="ghost" onClick={handleLogout}>
              {t.account.logout}
            </Button>
          </div>

        </div>
      </section>
    </SiteShell>
  );
}
