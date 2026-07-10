"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";
import { Avatar, Button, Spinner } from "@/components/ui";
import { Play, Gift, Video } from "@/components/icons";
import { Countdown } from "@/components/student/Countdown";
import { demoStudentUpcoming, demoStudentPast } from "@/lib/demo";
import { getStudentDashboard } from "@/app/actions";
import type { StudentDashboard } from "@/lib/types";
import { SiteShell } from "@/components/SiteShell";

export default function StudentPage() {
  const { t } = useLocale();
  // undefined = loading · null = demo/not-signed-in · object = real reservations
  const [data, setData] = useState<StudentDashboard | null | undefined>(undefined);

  useEffect(() => {
    getStudentDashboard().then(setData).catch(() => setData(null));
  }, []);

  const loading = data === undefined;
  const signedIn = !!data;
  const next = data?.upcoming[0] ?? null;

  // Hero (next live class): demo when signed out, real when signed in.
  let heroTitle = "";
  let heroTutor = "";
  let heroHref = "#";
  let heroMinutes: number | null = null;
  let heroDate: string | null = null;
  let showHero = true;
  if (!signedIn) {
    heroTitle = demoStudentUpcoming.title;
    heroTutor = demoStudentUpcoming.tutor_name ?? "Yassine K.";
    heroHref = `/live/${demoStudentUpcoming.id}`;
    heroMinutes = 14;
  } else if (next) {
    const m = Math.round((next.ts - Date.now()) / 60000);
    heroTitle = next.title;
    heroTutor = next.tutorName;
    heroHref = `/live/${next.classId}`;
    if (m > 0 && m <= 240) heroMinutes = m;
    else heroDate = `${next.day} ${next.month} · ${next.time}`;
  } else {
    showHero = false; // signed in, nothing upcoming
  }

  const pastList = signedIn
    ? (data?.past ?? []).map((p) => ({
        id: p.bookingId,
        title: p.title,
        sub: `${p.day} ${p.month} · ${p.time}`,
        replay_url: p.replayUrl,
      }))
    : demoStudentPast;

  return (
    <SiteShell>
      <style dangerouslySetInnerHTML={{ __html: `@keyframes blink { 50% { opacity: .25; } }` }} />

      {/* Page header */}
      <section className="web-section tight" style={{ paddingBottom: 0 }}>
        <div className="container">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: "clamp(18px, 3vw, 32px)" }}>
            <div>
              <p className="web-eyebrow" style={{ marginBottom: 6 }}>{t.student.title}</p>
              <h1 className="web-h2">{t.student.title}</h1>
            </div>
            <Avatar initials="A" size={46} square />
          </div>
        </div>
      </section>

      {loading ? (
        <section className="web-section tight">
          <div className="container" style={{ display: "grid", placeItems: "center", minHeight: 200 }}>
            <Spinner />
          </div>
        </section>
      ) : (
        <>
          {/* Hero: next live class OR empty state */}
          <section className="web-section tight">
            <div className="container">
              {showHero ? (
                <div
                  className="zellige"
                  style={{
                    padding: "clamp(20px, 3vw, 36px)",
                    borderRadius: "var(--r-xl)",
                    background: "linear-gradient(155deg,#16273E,#0a1726)",
                    color: "#fff",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* Top row: live badge + tutor */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "var(--rose)", color: "#fff", fontWeight: 700, fontSize: 11, padding: "5px 11px", borderRadius: 999, flexShrink: 0 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff", animation: "blink 1.1s infinite", flexShrink: 0 }} />
                      {t.student.soon}
                    </span>
                    <span style={{ color: "#B9C6D8", fontSize: 13 }}>{t.student.with} {heroTutor}</span>
                  </div>

                  {/* Title + countdown/date + CTA */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "clamp(16px, 2vw, 24px)", alignItems: "end" }}>
                    <div>
                      <h2 style={{ fontFamily: "var(--fd)", fontSize: "clamp(19px, 2.8vw, 28px)", lineHeight: 1.2, marginBottom: 14 }}>{heroTitle}</h2>
                      {heroMinutes != null ? (
                        <Countdown minutes={heroMinutes} />
                      ) : (
                        <div style={{ color: "#CDD9E8", fontSize: 14, fontWeight: 600 }}>{heroDate}</div>
                      )}
                    </div>
                    <Link href={heroHref} style={{ display: "block", maxWidth: 320 }}>
                      <Button variant="primary">
                        <Video /> {t.student.join}
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="panel panel-pad" style={{ textAlign: "center", padding: "clamp(28px,5vw,52px)" }}>
                  <h2 className="web-h2" style={{ fontSize: "clamp(17px,2.2vw,22px)", marginBottom: 10 }}>{t.student.empty}</h2>
                  <Link href="/explore" className="btn btn-primary" style={{ maxWidth: 260, marginInline: "auto" }}>
                    {t.nav.explore}
                  </Link>
                </div>
              )}
            </div>
          </section>

          {/* Past replays + invite banner */}
          <section className="web-section tight">
            <div className="container">
              <div className="grid-2" style={{ alignItems: "start" }}>

                {/* Past replays */}
                <div>
                  <h2 className="web-h2" style={{ fontSize: "clamp(16px, 2vw, 20px)", marginBottom: "clamp(14px, 2vw, 20px)" }}>
                    {t.student.past}
                  </h2>
                  {pastList.length > 0 ? (
                    <div className="panel">
                      {pastList.map((item, i) => (
                        <div
                          key={item.id}
                          className="listrow"
                          style={{
                            padding: "clamp(12px, 1.6vw, 16px) clamp(14px, 2vw, 20px)",
                            borderBottom: i < pastList.length - 1 ? "1px solid var(--line)" : "none",
                            gap: 12,
                            alignItems: "center",
                          }}
                        >
                          <div style={{ width: 44, height: 44, minWidth: 44, borderRadius: 12, background: "var(--blue)", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>
                            <Play />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{item.sub}</div>
                          </div>
                          <button
                            onClick={() => item.replay_url && window.open(item.replay_url, "_blank", "noopener,noreferrer")}
                            disabled={!item.replay_url}
                            style={{
                              flexShrink: 0, border: 0, background: "var(--blue50)", color: "var(--blue)",
                              fontWeight: 700, fontSize: 11.5, padding: "8px 13px", borderRadius: 999,
                              cursor: item.replay_url ? "pointer" : "default", display: "inline-flex",
                              alignItems: "center", gap: 6, minHeight: 44, opacity: item.replay_url ? 1 : 0.4,
                            }}
                            aria-label={`${t.student.replay} — ${item.title}`}
                          >
                            <Play /> {t.student.replay}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="panel panel-pad muted" style={{ fontSize: 13 }}>{t.student.empty}</div>
                  )}
                </div>

                {/* Invite banner */}
                <div>
                  <h2 className="web-h2" style={{ fontSize: "clamp(16px, 2vw, 20px)", marginBottom: "clamp(14px, 2vw, 20px)", opacity: 0 }} aria-hidden="true">
                    &nbsp;
                  </h2>
                  <div className="panel" style={{ padding: "clamp(18px, 2.4vw, 28px)", background: "linear-gradient(150deg,#FCEFD6,#F6E0B8)", border: "1.5px solid #F0D4A0" }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--ochre)", color: "#fff", display: "grid", placeItems: "center", marginBottom: 14, flexShrink: 0 }}>
                      <Gift />
                    </div>
                    <div style={{ fontSize: "clamp(14px, 1.8vw, 16px)", fontWeight: 700, marginBottom: 6 }}>{t.student.inviteTitle}</div>
                    <div style={{ fontSize: 13, color: "var(--ochre600)", fontWeight: 600, lineHeight: 1.5, marginBottom: 18 }}>{t.student.inviteBody}</div>
                    <button className="btn btn-primary btn-sm" style={{ width: "auto", borderRadius: 11, padding: "11px 18px", fontSize: 13, minHeight: 44 }}>
                      {t.student.inviteBtn}
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </section>
        </>
      )}
    </SiteShell>
  );
}
