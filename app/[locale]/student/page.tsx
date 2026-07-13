"use client";
import { useCallback, useEffect, useState } from "react";
import { Link } from "@/components/Link";
import { useLocale } from "@/components/LocaleProvider";
import { Avatar, Button, Chip, Spinner } from "@/components/ui";
import { Play, Video, Star, Clock } from "@/components/icons";
import { getStudentDashboard, getMe, cancelBooking, createReview } from "@/app/actions";
import type { StudentClass, StudentDashboard } from "@/lib/types";
import { SiteShell } from "@/components/SiteShell";

/* Page-local copy (never lib/i18n.ts — that file is shared).
   Everything on this page comes from getStudentDashboard(): no demo class,
   no fake countdown. Signed out → we say so; no bookings → we say so. */
const copy = {
  fr: {
    upcoming: "Prochains cours",
    startsIn: "Commence dans",
    liveNow: "C'est en direct maintenant",
    at: "à",
    cancel: "Annuler ma place",
    cancelSure: "Annuler cette réservation ?",
    cancelYes: "Oui, annuler",
    cancelNo: "Garder ma place",
    cancelRule: "Annulation gratuite jusqu'à 24h avant le cours.",
    cancelLocked: "Moins de 24h avant le cours : l'annulation en ligne est fermée. Préviens ton prof, il s'arrangera avec toi.",
    tooLate: "Le cours est dans moins de 24h — on ne peut plus annuler en ligne. Écris à ton prof, il gardera ta place pour une autre séance.",
    cancelErr: "L'annulation n'a pas marché. Réessaie.",
    cancelled: "Réservation annulée. La place est de nouveau libre.",
    free: "Gratuit",
    rate: "Noter mon prof",
    rateWith: (n: string) => `Comment était le cours avec ${n} ?`,
    ratePh: "Un mot pour les autres élèves (optionnel)",
    send: "Envoyer mon avis",
    sending: "Envoi…",
    thanks: "Merci ! Ton avis aide les autres élèves à choisir.",
    already: "Tu as déjà noté ce cours.",
    notBooked: "Tu n'étais pas inscrit à ce cours.",
    notStarted: "Ce cours n'a pas encore eu lieu.",
    pickStars: "Choisis une note de 1 à 5 étoiles.",
    reviewErr: "L'avis n'est pas parti. Réessaie.",
    stars: (n: number) => `${n} étoile${n > 1 ? "s" : ""}`,
    emptyTitle: "Tu n'as pas encore de cours",
    emptyBody: "Trouve un prof et réserve ta 1ère séance — elle est gratuite.",
    emptyCta: "Explorer les profs",
    outTitle: "Connecte-toi pour voir tes cours",
    outBody: "Tes réservations et tes replays apparaissent ici une fois connecté.",
    signIn: "Se connecter",
    noReplay: "Enregistrement pas encore disponible",
  },
  ar: {
    upcoming: "الحصص الجاية",
    startsIn: "تبدا في",
    liveNow: "المباشر بدا توّا",
    at: "على",
    cancel: "ألغي مكاني",
    cancelSure: "تحب تلغي هذا الحجز ؟",
    cancelYes: "إيه، ألغي",
    cancelNo: "نحافظ على مكاني",
    cancelRule: "الإلغاء مجاني حتى 24 ساعة قبل الحصة.",
    cancelLocked: "أقل من 24 ساعة قبل الحصة: الإلغاء أونلاين مسكّر. اعلم أستاذك وهو يتفاهم معاك.",
    tooLate: "الحصة أقل من 24 ساعة — ما عادش تنجم تلغي أونلاين. اكتب لأستاذك، يحافظلك على مكانك في حصة أخرى.",
    cancelErr: "الإلغاء ما مشاش. عاود حاول.",
    cancelled: "الحجز تلغى. المكان ولّى متوفّر.",
    free: "مجاني",
    rate: "نقّم أستاذي",
    rateWith: (n: string) => `كيفاش كانت الحصة مع ${n} ؟`,
    ratePh: "كلمة للتلاميذ الآخرين (اختياري)",
    send: "ابعث تقييمي",
    sending: "قاعد يتبعث…",
    thanks: "يعيشك ! تقييمك يعاون التلاميذ الآخرين.",
    already: "لقد نقّمت هذه الحصة من قبل.",
    notBooked: "ما كنتش محجوز في هذه الحصة.",
    notStarted: "هذه الحصة ما زالت ما صارتش.",
    pickStars: "اختار تقييم من 1 إلى 5 نجوم.",
    reviewErr: "التقييم ما مشاش. عاود حاول.",
    stars: (n: number) => `${n} نجوم`,
    emptyTitle: "ما زال ما عندكش حصص",
    emptyBody: "لقّي أستاذ واحجز حصتك الأولى — هي مجانية.",
    emptyCta: "اكتشف الأساتذة",
    outTitle: "تسجّل الدخول باش تشوف حصصك",
    outBody: "حجوزاتك والتسجيلات يظهرو هوني كي تسجّل الدخول.",
    signIn: "تسجيل الدخول",
    noReplay: "التسجيل ما زال ما هوش متوفّر",
  },
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const initialsOf = (name: string) => {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "";
  return ((p[0][0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
};

/* Real countdown: ticks against the class's actual start timestamp. */
function StartsIn({ ts }: { ts: number }) {
  const { t } = useLocale();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, ts - now);
  const h = Math.floor(left / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const s = Math.floor((left % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div style={{ display: "flex", gap: 9, margin: "14px 0" }}>
      {[
        { val: pad(h), label: t.student.hours },
        { val: pad(m), label: t.student.mins },
        { val: pad(s), label: t.student.secs },
      ].map(({ val, label }) => (
        <div key={label} style={{ background: "rgba(255,255,255,.12)", borderRadius: 12, padding: "9px 0", textAlign: "center", flex: 1, maxWidth: 90 }}>
          <b style={{ fontFamily: "var(--fd)", fontSize: 21, display: "block" }}>{val}</b>
          <span style={{ fontSize: 9.5, color: "#B9C6D8", letterSpacing: ".3px" }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- rate-your-tutor (writes a real review) ---------- */
function RateBox({ item, onDone }: { item: StudentClass; onDone: () => void }) {
  const { locale } = useLocale();
  const c = copy[locale];
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function submit() {
    if (rating < 1) { setMsg({ kind: "err", text: c.pickStars }); return; }
    setBusy(true);
    const res = await createReview({ classId: item.classId, rating, text: text.trim() || undefined });
    setBusy(false);
    if (res.ok) {
      setMsg({ kind: "ok", text: c.thanks });
      setOpen(false);
      onDone();
      return;
    }
    const e = res.error;
    setMsg({
      kind: "err",
      text: e === "already-reviewed" ? c.already
        : e === "not-booked" ? c.notBooked
        : e === "class-not-started" ? c.notStarted
        : e === "invalid-rating" ? c.pickStars
        : c.reviewErr,
    });
  }

  if (msg?.kind === "ok") {
    return <div style={{ fontSize: 12.5, color: "var(--green)", fontWeight: 700, marginTop: 8 }}>{msg.text}</div>;
  }

  if (!open) {
    return (
      <div style={{ marginTop: 8 }}>
        <button
          onClick={() => { setOpen(true); setMsg(null); }}
          style={{
            border: 0, background: "var(--sand, var(--blue50))", color: "var(--ochre600)", fontWeight: 700,
            fontSize: 11.5, padding: "8px 13px", borderRadius: 999, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44,
          }}
        >
          <Star /> {c.rate}
        </button>
        {msg && <div style={{ fontSize: 12, color: "var(--rose)", marginTop: 6 }}>{msg.text}</div>}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10, padding: 12, borderRadius: 14, background: "var(--paper)", border: "1px solid var(--line)" }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>{c.rateWith(item.tutorName)}</div>
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => { setRating(n); setMsg(null); }}
            aria-label={c.stars(n)}
            aria-pressed={rating === n}
            style={{
              border: 0, background: "transparent", cursor: "pointer", padding: 4, minWidth: 44, minHeight: 44,
              display: "grid", placeItems: "center",
              color: n <= rating ? "var(--amber)" : "var(--lineCool, #D8DEE7)",
            }}
          >
            <Star className={n <= rating ? "fill" : ""} />
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={c.ratePh}
        maxLength={1000}
        rows={3}
        style={{
          width: "100%", borderRadius: 12, border: "1px solid var(--line)", padding: "10px 12px",
          fontSize: 13, fontFamily: "inherit", resize: "vertical", background: "var(--cream, #fff)", color: "var(--ink)",
        }}
      />
      {msg?.kind === "err" && <div style={{ fontSize: 12, color: "var(--rose)", marginTop: 6 }}>{msg.text}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <Button variant="primary" sm onClick={submit} disabled={busy} style={{ width: "auto", padding: "10px 16px", minHeight: 44 }}>
          {busy ? c.sending : c.send}
        </Button>
        <Button variant="ghost" sm onClick={() => setOpen(false)} style={{ width: "auto", padding: "10px 16px", minHeight: 44 }}>
          {c.cancelNo}
        </Button>
      </div>
    </div>
  );
}

/* ---------- one upcoming booking ---------- */
function UpcomingCard({ item, hero, onChanged }: { item: StudentClass; hero: boolean; onChanged: () => void }) {
  const { t, locale } = useLocale();
  const c = copy[locale];
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const startsIn = item.ts - now;
  const live = startsIn <= 0;
  const withinDay = startsIn < DAY_MS;
  const cancellable = startsIn >= DAY_MS;

  async function doCancel() {
    setBusy(true);
    setErr(null);
    const res = await cancelBooking({ bookingId: item.bookingId });
    setBusy(false);
    setConfirming(false);
    if (res.ok) { onChanged(); return; }
    setErr(res.error === "too-late" ? c.tooLate : c.cancelErr);
  }

  return (
    <div
      className="zellige"
      style={{
        padding: hero ? "clamp(20px, 3vw, 36px)" : "clamp(16px, 2.2vw, 22px)",
        borderRadius: "var(--r-xl)",
        background: "linear-gradient(155deg,#16273E,#0a1726)",
        color: "#fff",
        position: "relative",
        overflow: "hidden",
        marginBottom: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: live ? "var(--rose)" : "rgba(255,255,255,.14)", color: "#fff", fontWeight: 700, fontSize: 11, padding: "5px 11px", borderRadius: 999, flexShrink: 0 }}>
          {live && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff", animation: "blink 1.1s infinite", flexShrink: 0 }} />}
          {live ? c.liveNow : t.student.soon}
        </span>
        <span style={{ color: "#B9C6D8", fontSize: 13 }}>{t.student.with} {item.tutorName}</span>
      </div>

      <h2 style={{ fontFamily: "var(--fd)", fontSize: hero ? "clamp(19px, 2.8vw, 28px)" : "clamp(16px, 2vw, 19px)", lineHeight: 1.25, marginBottom: 8 }}>
        {item.title}
      </h2>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", color: "#CDD9E8", fontSize: 13, fontWeight: 600 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Clock /> {item.day} {item.month} · {item.time}
        </span>
        {item.isFree && <Chip kind="free">{c.free}</Chip>}
      </div>

      {!live && withinDay && <StartsIn ts={item.ts} />}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14, alignItems: "center" }}>
        <Link href={`/live/${item.classId}`} style={{ display: "block", flex: "1 1 200px", maxWidth: 320 }}>
          <Button variant="primary">
            <Video /> {t.student.join}
          </Button>
        </Link>

        {cancellable && !confirming && (
          <button
            onClick={() => setConfirming(true)}
            style={{
              border: "1px solid rgba(255,255,255,.28)", background: "transparent", color: "#CDD9E8",
              fontWeight: 700, fontSize: 12.5, padding: "12px 16px", borderRadius: 999, cursor: "pointer", minHeight: 44,
            }}
          >
            {c.cancel}
          </button>
        )}
      </div>

      {confirming && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 14, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{c.cancelSure}</div>
          <div style={{ fontSize: 12, color: "#CDD9E8", marginBottom: 10, lineHeight: 1.5 }}>{c.cancelRule}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={doCancel}
              disabled={busy}
              style={{ border: 0, background: "var(--rose)", color: "#fff", fontWeight: 700, fontSize: 12.5, padding: "12px 16px", borderRadius: 999, cursor: "pointer", minHeight: 44 }}
            >
              {busy ? "…" : c.cancelYes}
            </button>
            <button
              onClick={() => setConfirming(false)}
              style={{ border: "1px solid rgba(255,255,255,.28)", background: "transparent", color: "#fff", fontWeight: 700, fontSize: 12.5, padding: "12px 16px", borderRadius: 999, cursor: "pointer", minHeight: 44 }}
            >
              {c.cancelNo}
            </button>
          </div>
        </div>
      )}

      {!cancellable && !live && (
        <div style={{ marginTop: 12, fontSize: 12, color: "#B9C6D8", lineHeight: 1.5 }}>{c.cancelLocked}</div>
      )}

      {err && (
        <div role="alert" style={{ marginTop: 12, background: "rgba(226,72,61,.16)", border: "1px solid rgba(226,72,61,.4)", color: "#FFD3CE", borderRadius: 12, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.5 }}>
          {err}
        </div>
      )}
    </div>
  );
}

export default function StudentPage() {
  const { t, locale } = useLocale();
  const c = copy[locale];

  // undefined = loading · null = no session / no data
  const [data, setData] = useState<StudentDashboard | null | undefined>(undefined);
  const [me, setMe] = useState<{ name: string | null } | null | undefined>(undefined);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(() => {
    getStudentDashboard().then(setData).catch(() => setData(null));
  }, []);

  useEffect(() => {
    getMe().then(setMe).catch(() => setMe(null));
    load();
  }, [load]);

  const loading = data === undefined || me === undefined;
  const upcoming = data?.upcoming ?? [];
  const past = data?.past ?? [];
  const nothing = upcoming.length === 0 && past.length === 0;
  const initials = me?.name ? initialsOf(me.name) : "";

  return (
    <SiteShell>
      <style dangerouslySetInnerHTML={{ __html: `@keyframes blink { 50% { opacity: .25; } }` }} />

      {/* Page header */}
      <section className="web-section tight" style={{ paddingBottom: 0 }}>
        <div className="container">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: "clamp(18px, 3vw, 32px)" }}>
            <div>
              <p className="web-eyebrow" style={{ marginBottom: 6 }}>{t.nav.classes}</p>
              <h1 className="web-h2">{t.student.title}</h1>
            </div>
            {initials && <Avatar initials={initials} size={46} square />}
          </div>
        </div>
      </section>

      {loading ? (
        <section className="web-section tight">
          <div className="container" style={{ display: "grid", placeItems: "center", minHeight: 200 }}>
            <Spinner />
          </div>
        </section>
      ) : !me ? (
        /* Signed out (middleware normally catches this first) */
        <section className="web-section tight">
          <div className="container">
            <div className="panel panel-pad" style={{ textAlign: "center", padding: "clamp(28px,5vw,52px)" }}>
              <h2 className="web-h2" style={{ fontSize: "clamp(17px,2.2vw,22px)", marginBottom: 8 }}>{c.outTitle}</h2>
              <p className="muted" style={{ fontSize: 13.5, marginBottom: 18 }}>{c.outBody}</p>
              <Link href="/auth?next=/student" className="btn btn-primary" style={{ maxWidth: 260, marginInline: "auto" }}>
                {c.signIn}
              </Link>
            </div>
          </div>
        </section>
      ) : nothing ? (
        /* Signed in, no bookings at all */
        <section className="web-section tight">
          <div className="container">
            <div className="panel panel-pad" style={{ textAlign: "center", padding: "clamp(28px,5vw,52px)" }}>
              <h2 className="web-h2" style={{ fontSize: "clamp(17px,2.2vw,22px)", marginBottom: 8 }}>{c.emptyTitle}</h2>
              <p className="muted" style={{ fontSize: 13.5, marginBottom: 18 }}>{c.emptyBody}</p>
              <Link href="/explore" className="btn btn-primary" style={{ maxWidth: 260, marginInline: "auto" }}>
                {c.emptyCta}
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <>
          {flash && (
            <section className="web-section tight" style={{ paddingBlock: 0 }}>
              <div className="container">
                <div role="status" style={{ background: "var(--green50)", border: "1px solid rgba(27,156,111,.3)", color: "#13724f", borderRadius: 12, padding: "11px 13px", fontSize: 13, marginBottom: 14 }}>
                  {flash}
                </div>
              </div>
            </section>
          )}

          {/* Upcoming — every card is a real booking */}
          {upcoming.length > 0 && (
            <section className="web-section tight">
              <div className="container">
                <h2 className="web-h2" style={{ fontSize: "clamp(16px, 2vw, 20px)", marginBottom: "clamp(14px, 2vw, 20px)" }}>
                  {c.upcoming}
                </h2>
                {upcoming.map((item, i) => (
                  <UpcomingCard
                    key={item.bookingId}
                    item={item}
                    hero={i === 0}
                    onChanged={() => { setFlash(c.cancelled); load(); }}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Past sessions: replay + rate your tutor */}
          {past.length > 0 && (
            <section className="web-section tight">
              <div className="container">
                <h2 className="web-h2" style={{ fontSize: "clamp(16px, 2vw, 20px)", marginBottom: "clamp(14px, 2vw, 20px)" }}>
                  {t.student.past}
                </h2>
                <div className="panel">
                  {past.map((item, i) => (
                    <div
                      key={item.bookingId}
                      style={{
                        padding: "clamp(12px, 1.6vw, 16px) clamp(14px, 2vw, 20px)",
                        borderBottom: i < past.length - 1 ? "1px solid var(--line)" : "none",
                      }}
                    >
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div style={{ width: 44, height: 44, minWidth: 44, borderRadius: 12, background: "var(--blue)", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>
                          <Play />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                            {item.day} {item.month} · {item.time} · {t.student.with} {item.tutorName}
                          </div>
                        </div>
                        {item.replayUrl ? (
                          <button
                            onClick={() => window.open(item.replayUrl, "_blank", "noopener,noreferrer")}
                            style={{
                              flexShrink: 0, border: 0, background: "var(--blue50)", color: "var(--blue)",
                              fontWeight: 700, fontSize: 11.5, padding: "8px 13px", borderRadius: 999,
                              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44,
                            }}
                            aria-label={`${t.student.replay} — ${item.title}`}
                          >
                            <Play /> {t.student.replay}
                          </button>
                        ) : (
                          <span className="muted" style={{ fontSize: 11, flexShrink: 0, maxWidth: 120, textAlign: "end", lineHeight: 1.35 }}>
                            {c.noReplay}
                          </span>
                        )}
                      </div>

                      {/* Real reviews come from here */}
                      <RateBox item={item} onDone={() => undefined} />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </SiteShell>
  );
}
