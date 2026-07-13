"use client";
import { useState, type FormEvent } from "react";
import { Link } from "@/components/Link";
import { Button, Field } from "@/components/ui";
import { useLocale } from "@/components/LocaleProvider";
import { Back, Video, Board, Quiz } from "@/components/icons";
import { createClass } from "@/app/actions";
import { useToast } from "@/components/useToast";
import { SiteShell } from "@/components/SiteShell";
import { DashboardSidebar } from "@/components/DashboardSidebar";

/* A tutor must be verified before publishing (enforced server-side in createClass).
   Without a specific message this failure is opaque and unfixable-looking. */
const NOT_VERIFIED_MSG = {
  fr: "Ton profil doit d'abord être vérifié. Va dans « Vérification » pour envoyer tes documents.",
  ar: "لازم بروفايلك يتثبّت الأول. أمشي لـ « التثبّت » وابعث وثائقك.",
} as const;

export default function NewClassPage() {
  const { t, locale } = useLocale();

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [datetime, setDatetime] = useState("");
  const [duration, setDuration] = useState("90");
  const [price, setPrice] = useState("");
  const [seats, setSeats] = useState("20");
  const [videoUrl, setVideoUrl] = useState("");
  const [whiteboardUrl, setWhiteboardUrl] = useState("");
  const [quizUrl, setQuizUrl] = useState("");
  const [freeFirst, setFreeFirst] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // Only ever true when the server action itself reports demo mode (no DB).
  const [demo, setDemo] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    const res = await createClass({
      title, description: desc, scheduledAt: datetime,
      durationMin: Number(duration), priceTnd: Number(price), seats: Number(seats),
      isFreeFirst: freeFirst, meetUrl: videoUrl, whiteboardUrl, quizUrl,
    });
    if (res.ok) {
      setDemo(Boolean(res.demo));
      showToast(res.demo ? `${t.extra.classPublished} · ${t.common.demoMode}` : t.extra.classPublished);
    } else {
      // Server-side validation (past date, negative price, bad URL…) — let them fix it.
      setSubmitted(false);
      showToast(res.error === "not-verified" ? NOT_VERIFIED_MSG[locale] : t.extra.error);
    }
  }
  const { toast, showToast } = useToast();

  return (
    <SiteShell>
      <section className="web-section tight">
        <div className="container">
          <div className="app-layout">
            <DashboardSidebar />

            {/* Main content column */}
            <div style={{ minWidth: 0 }}>
              {/* Page header */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: "clamp(18px,3vw,28px)",
              }}>
                <Link href="/dashboard">
                  <button className="iconbtn" aria-label={t.common.back}>
                    <Back />
                  </button>
                </Link>
                <h1 style={{
                  fontFamily: "var(--fd)",
                  fontSize: "clamp(20px,2.6vw,28px)",
                  letterSpacing: "-0.6px",
                  color: "var(--ink)",
                }}>
                  {t.createClass.title}
                </h1>
              </div>

              {/* Form card — max-width centers comfortably at 1280px */}
              <div className="panel panel-pad" style={{ maxWidth: 620, width: "100%" }}>
                <form onSubmit={handleSubmit}>

                  {/* Title */}
                  <Field label={t.createClass.name}>
                    <div className="inp">
                      <input
                        type="text"
                        placeholder={t.createClass.namePh}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        maxLength={80}
                      />
                    </div>
                  </Field>

                  {/* Description */}
                  <Field label={t.createClass.desc}>
                    <div className="inp" style={{ alignItems: "flex-start" }}>
                      <textarea
                        rows={3}
                        placeholder="ex. Méthodes + annales. On fait 3 exercices types ensemble."
                        value={desc}
                        onChange={(e) => setDesc(e.target.value)}
                        style={{ resize: "vertical", minHeight: 80 }}
                      />
                    </div>
                  </Field>

                  {/* Date & time */}
                  <Field label={t.createClass.date}>
                    <div className="inp">
                      <input
                        type="datetime-local"
                        value={datetime}
                        onChange={(e) => setDatetime(e.target.value)}
                        required
                        style={{ colorScheme: "light" }}
                      />
                    </div>
                  </Field>

                  {/* Duration + Price — stack on mobile, side-by-side ≥480px */}
                  <div style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                  }}>
                    <div style={{ flex: "1 1 140px", minWidth: 0 }}>
                      <Field label={t.createClass.duration}>
                        <div className="inp">
                          <input
                            type="number"
                            min={15}
                            max={240}
                            step={15}
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            required
                          />
                          <span className="pre">{t.common.min}</span>
                        </div>
                      </Field>
                    </div>
                    <div style={{ flex: "1 1 140px", minWidth: 0 }}>
                      <Field label={t.createClass.price}>
                        <div className="inp">
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            placeholder="15"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            required
                          />
                          <span className="pre">{t.common.tnd}</span>
                        </div>
                      </Field>
                    </div>
                  </div>

                  {/* Seats */}
                  <Field label={t.createClass.seats}>
                    <div className="inp">
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={seats}
                        onChange={(e) => setSeats(e.target.value)}
                        required
                      />
                    </div>
                  </Field>

                  {/* Teaching tools section */}
                  <div style={{
                    borderTop: "1px solid var(--line)",
                    marginTop: 6,
                    marginBottom: 18,
                    paddingTop: 18,
                  }}>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 14,
                      color: "var(--ink2)",
                      fontWeight: 700,
                      fontSize: 13,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}>
                      <Video style={{ width: 16, height: 16, color: "var(--blue)" }} />
                      {t.tools.setLinks}
                    </div>

                    <Field label={t.tools.videoUrl}>
                      <div className="inp">
                        <Video style={{ width: 16, height: 16, color: "var(--muted)", flexShrink: 0 }} />
                        <input
                          type="url"
                          inputMode="url"
                          placeholder="https://meet.jit.si/…"
                          value={videoUrl}
                          onChange={(e) => setVideoUrl(e.target.value)}
                        />
                      </div>
                    </Field>

                    <Field label={t.tools.whiteboardUrl}>
                      <div className="inp">
                        <Board style={{ width: 16, height: 16, color: "var(--muted)", flexShrink: 0 }} />
                        <input
                          type="url"
                          inputMode="url"
                          placeholder="https://bitpaper.io/…"
                          value={whiteboardUrl}
                          onChange={(e) => setWhiteboardUrl(e.target.value)}
                        />
                      </div>
                    </Field>

                    <Field label={t.tools.quizUrl} help={t.tools.hint}>
                      <div className="inp">
                        <Quiz style={{ width: 16, height: 16, color: "var(--muted)", flexShrink: 0 }} />
                        <input
                          type="url"
                          inputMode="url"
                          placeholder="https://wooclap.com/…"
                          value={quizUrl}
                          onChange={(e) => setQuizUrl(e.target.value)}
                        />
                      </div>
                    </Field>
                  </div>

                  {/* Free-first checkbox */}
                  <div
                    className="card"
                    role="checkbox"
                    aria-checked={freeFirst}
                    aria-label={t.createClass.freeFirst}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        setFreeFirst((v) => !v);
                      }
                    }}
                    onClick={() => setFreeFirst((v) => !v)}
                    style={{
                      padding: "14px 16px",
                      marginBottom: 20,
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      cursor: "pointer",
                      border: freeFirst ? "2px solid var(--green)" : "1px solid var(--line)",
                      background: freeFirst ? "var(--green50)" : "var(--paper)",
                      transition: ".15s",
                    }}
                  >
                    {/* Custom checkbox tick */}
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        minWidth: 22,
                        borderRadius: 7,
                        border: freeFirst ? "none" : "2px solid var(--line)",
                        background: freeFirst ? "var(--green)" : "transparent",
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                        transition: ".15s",
                      }}
                    >
                      {freeFirst && (
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="5 13 10 18 19 7" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{t.createClass.freeFirst}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                        {t.common.free1st}
                      </div>
                    </div>
                  </div>

                  {/* Submit */}
                  <Button type="submit" variant="primary" disabled={submitted}>
                    {t.createClass.create}
                  </Button>

                  {/* Shown ONLY when the server action reports demo mode (no DB connected). */}
                  {demo && (
                    <p style={{
                      textAlign: "center",
                      fontSize: 11.5,
                      color: "var(--muted)",
                      marginTop: 12,
                      lineHeight: 1.5,
                    }}>
                      {t.common.demoMode}
                    </p>
                  )}
                </form>
              </div>
            </div>
            {/* end main column */}
          </div>
        </div>
      </section>
      {toast}
    </SiteShell>
  );
}
