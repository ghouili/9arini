"use client";
import { useState, useEffect, type CSSProperties } from "react";
import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";
import { SiteShell } from "@/components/SiteShell";
import { Avatar, Button, Spinner } from "@/components/ui";
import { Back, Video, Mic, Bulb } from "@/components/icons";
import { Countdown } from "@/components/student/Countdown";
import { ClassTools } from "@/components/teaching/ClassTools";
import { getClass } from "@/app/actions";
import type { ClassItem } from "@/lib/types";

const WAITING_INITIALS = [
  { label: "M", color: "#E0852E" },
  { label: "S", color: "#1B9C6F" },
  { label: "A", color: "#5B3DF5" },
];

type Props = { params: { id: string } };

export default function LiveLobbyPage({ params }: Props) {
  const { t } = useLocale();
  const [cls, setCls] = useState<ClassItem | null | undefined>(undefined);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(false);
  useEffect(() => { getClass(params.id).then(setCls).catch(() => setCls(null)); }, [params.id]);

  if (cls === undefined) {
    return (
      <SiteShell footer={false}>
        <section className="web-section">
          <div className="container" style={{ display: "grid", placeItems: "center", minHeight: 280 }}>
            <Spinner />
          </div>
        </section>
      </SiteShell>
    );
  }
  if (cls === null) {
    return (
      <SiteShell footer={false}>
        <section className="web-section">
          <div className="container" style={{ textAlign: "center", padding: "clamp(28px,6vw,60px)" }}>
            <h1 className="web-h2" style={{ marginBottom: 12 }}>{t.extra.noResults}</h1>
            <Link href="/student" className="btn btn-primary" style={{ maxWidth: 240, marginInline: "auto" }}>{t.nav.classes}</Link>
          </div>
        </section>
      </SiteShell>
    );
  }

  function handleJoin() {
    if (cls?.meet_url) window.open(cls.meet_url, "_blank", "noopener,noreferrer");
  }

  const initials = cls.tutor_name
    ? cls.tutor_name.split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2)
    : "YK";

  return (
    <SiteShell footer={false}>
      <section className="web-section">
        <div className="container" style={{ display: "flex", justifyContent: "center" }}>
          {/* Centered immersive live room — responsive down to 360px */}
          <div
            style={{
              width: "100%",
              maxWidth: 560,
              minWidth: 0,
              borderRadius: "var(--r-xl)",
              background: "radial-gradient(120% 80% at 50% 0%,#16273E,#0a1726)",
              color: "#fff",
              boxShadow: "var(--sh-l)",
              padding: "clamp(18px,4vw,30px)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Top row: back + live tag */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <Link href="/student" className="iconbtn" aria-label={t.common.back} style={{ background: "rgba(255,255,255,.12)", color: "#fff" }}>
                <Back />
              </Link>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(226,72,61,.18)", color: "#FFB9B2", border: "1px solid rgba(226,72,61,.4)", fontWeight: 700, fontSize: 11, padding: "5px 12px", borderRadius: 999 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#FFB9B2", animation: "blink 1.1s infinite" }} />
                {t.live.tag}
              </span>
            </div>

            {/* Stage */}
            <div style={{ textAlign: "center", margin: "clamp(20px,4vw,32px) 0 8px" }}>
              <Avatar initials={initials} size={92} />
              <h1 style={{ fontFamily: "var(--fd)", fontSize: "clamp(18px,4vw,22px)", marginTop: 16 }}>{cls.title}</h1>
              <div style={{ color: "#B9C6D8", fontSize: 13, marginTop: 5 }}>
                {t.live.with} {cls.tutor_name ?? "Yassine Khelifi"}
              </div>

              <Countdown minutes={2} big />

              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, margin: "6px 0 18px", color: "#CDD9E8", fontSize: 12.5, flexWrap: "wrap" }}>
                <div style={{ display: "flex" }}>
                  {WAITING_INITIALS.map((s, i) => (
                    <div key={s.label} style={{ width: 26, height: 26, borderRadius: "50%", border: "2px solid #16273E", marginInlineStart: i === 0 ? 0 : -8, background: s.color, display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700, color: "#fff" }}>{s.label}</div>
                  ))}
                </div>
                <span>{t.live.waiting(3)}</span>
              </div>
            </div>

            {/* Cam / mic toggles */}
            <div style={{ display: "flex", gap: 11, marginBottom: 14, flexWrap: "wrap" }}>
              {([
                { on: camOn, set: setCamOn, Icon: Video, label: t.live.cam },
                { on: micOn, set: setMicOn, Icon: Mic, label: t.live.mic },
              ] as const).map(({ on, set, Icon, label }) => (
                <button key={label} onClick={() => set((v) => !v)} aria-pressed={on} aria-label={label}
                  style={{ flex: "1 1 140px", minWidth: 0, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 14, padding: 13, display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", minHeight: 48 }}>
                  <Icon />
                  <span style={{ color: "#CFE0F3" }}>{label}</span>
                  <span style={{ marginInlineStart: "auto", width: 34, height: 20, borderRadius: 999, background: on ? "var(--green)" : "rgba(255,255,255,.25)", position: "relative", display: "block", flexShrink: 0, transition: ".2s" }}>
                    <span style={{ position: "absolute", top: 2, insetInlineStart: on ? 16 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: ".2s" }} />
                  </span>
                </button>
              ))}
            </div>

            {/* Low-data note */}
            <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "rgba(255,255,255,.07)", borderRadius: 13, padding: "12px 13px", fontSize: 12, color: "#CDD9E8", lineHeight: 1.5, marginBottom: 14 }}>
              <Bulb style={{ color: "var(--amber)", flexShrink: 0, marginTop: 1, width: 17, height: 17 } as CSSProperties} />
              <div>
                <div style={{ fontWeight: 600, marginBottom: 3 }}>{t.live.lowData}</div>
                <div>{t.live.note}</div>
              </div>
            </div>

            {/* Teaching tools — one-tap launchers */}
            <ClassTools cls={cls} dark />

            <div style={{ marginTop: 16 }}>
              <Button variant="primary" onClick={handleJoin}>
                <Video /> {t.live.join}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <style dangerouslySetInnerHTML={{ __html: `@keyframes blink { 50% { opacity: .25; } }` }} />
    </SiteShell>
  );
}
