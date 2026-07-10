"use client";
import { SiteShell } from "@/components/SiteShell";
import { useLocale } from "@/components/LocaleProvider";
import { Chat } from "@/components/icons";

export default function MessagesPage() {
  const { t } = useLocale();
  return (
    <SiteShell>
      <section className="web-section">
        <div
          className="container"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 16,
            padding: "clamp(40px,8vw,90px) clamp(16px,4vw,40px)",
          }}
        >
          <div style={{ width: 80, height: 80, borderRadius: 24, background: "var(--blue50)", display: "grid", placeItems: "center" }}>
            <Chat style={{ width: 36, height: 36, stroke: "var(--blue)" }} />
          </div>
          <h1 className="web-h2">{t.nav.messages}</h1>
          <p className="web-lead" style={{ maxWidth: 360 }}>{t.extra.comingSoon}</p>
        </div>
      </section>
    </SiteShell>
  );
}
