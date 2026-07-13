"use client";
import { useEffect, useState } from "react";
import { logout, getMe } from "@/app/actions";
import { Button } from "@/components/ui";
import { LocaleToggle } from "@/components/LocaleToggle";
import { useLocale } from "@/components/LocaleProvider";
import { Phone, User, Forward } from "@/components/icons";
import { SiteShell } from "@/components/SiteShell";

const WA_LINK = "https://wa.me/216XXXXXXXX";

export default function AccountPage() {
  const { t } = useLocale();
  const [me, setMe] = useState<{ name: string | null; role: string; phone: string | null } | null>(null);

  useEffect(() => { getMe().then(setMe).catch(() => setMe(null)); }, []);

  async function handleLogout() {
    await logout();
    window.location.href = "/";
  }

  const initials = me?.name
    ? me.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <SiteShell>
      <section className="web-section">
        <div className="container container-narrow" style={{ maxWidth: 760 }}>

          {/* Page heading */}
          <div style={{ marginBottom: "clamp(20px, 3vw, 36px)" }}>
            <p className="web-eyebrow" style={{ marginBottom: 6 }}>{t.account.title}</p>
            <h1 className="web-h2">{t.account.title}</h1>
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
                  background: "linear-gradient(150deg, var(--blue), #082F54)",
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
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "var(--fd)", fontSize: "clamp(16px, 2vw, 20px)", fontWeight: 700, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {me?.name || "—"}
                </div>
                {me?.phone && (
                  <div style={{ fontSize: 14, color: "var(--muted)" }}>{me.phone}</div>
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
                  fontSize: 12.5,
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
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    minWidth: 40,
                    borderRadius: 11,
                    background: "#E7F9F0",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                >
                  <Phone style={{ width: 18, height: 18, stroke: "#1B9C6F" }} />
                </div>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{t.account.help}</span>
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
