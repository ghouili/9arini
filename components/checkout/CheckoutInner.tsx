"use client";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Link } from "@/components/Link";
import { useLocale } from "@/components/LocaleProvider";
import { Check, Calendar, Clock, Users } from "@/components/icons";
import { Spinner } from "@/components/ui";
import { getClass, reserveSeat } from "@/app/actions";
import type { ClassItem } from "@/lib/types";

/* Payments are OFF for the pilot (lib/payments.ts). This screen is a free
   seat reservation, not a checkout: no rails, no card, no "paiement sécurisé".
   Page-local copy — lib/i18n.ts is shared with other screens. */
const copy = {
  fr: {
    title: "Confirmer ma réservation",
    summary: "Ce que tu réserves",
    when: "Quand",
    who: "Avec",
    seats: "Places restantes",
    priceLine: "1ère séance",
    freeTag: "Gratuite",
    nextLine: (p: number) => `Séances suivantes : ${p} TND`,
    noPayNow: "Aucun paiement en ligne : 9arini ne prend pas encore les paiements. Tu règles les séances suivantes directement avec ton prof, s'il te convient.",
    paidNotice: (p: number) =>
      `Cette séance est à ${p} TND. Le règlement se fait directement avec ton prof — 9arini ne prend aucun paiement en ligne pour l'instant.`,
    cancelRule: "Annulation gratuite jusqu'à 24h avant le cours, depuis « Mes cours ».",
    confirm: "Confirmer ma place",
    confirming: "…",
    okTitle: "C'est réservé !",
    okBody: "Ta place est confirmée. Retrouve le lien de la séance dans « Mes cours ».",
    okAlready: "Tu avais déjà cette place. Le lien de la séance est dans « Mes cours ».",
    okCta: "Voir mes cours",
    errAuth: "Connecte-toi pour réserver ta place.",
    errFull: "Plus de places pour cette séance.",
    errUnavailable: "Cette séance n'est plus disponible.",
    errConsent: "Il manque l'accord de ton parent ou tuteur pour réserver.",
    errConsentCta: "Donner l'accord",
    errGeneric: "La réservation n'a pas marché. Réessaie.",
    signIn: "Se connecter",
    notFound: "Séance introuvable.",
  },
  ar: {
    title: "أكّد حجزي",
    summary: "شنوّة قاعد تحجز",
    when: "الوقت",
    who: "مع",
    seats: "الأماكن الباقية",
    priceLine: "الحصة الأولى",
    freeTag: "مجانية",
    nextLine: (p: number) => `الحصص الموالية : ${p} د.ت`,
    noPayNow: "ما فماش خلاص أونلاين : 9arini ما زالت ما تقبلش الدفع. الحصص الموالية تخلّصهم مباشرة مع أستاذك، كان عجبك.",
    paidNotice: (p: number) =>
      `هذه الحصة بـ ${p} د.ت. الخلاص يتم مباشرة مع أستاذك — 9arini ما تقبلش الدفع أونلاين توّا.`,
    cancelRule: "الإلغاء مجاني حتى 24 ساعة قبل الحصة، من « حصصي ».",
    confirm: "أكّد مكاني",
    confirming: "…",
    okTitle: "تم الحجز !",
    okBody: "مكانك مؤكّد. تلقى رابط الحصة في « حصصي ».",
    okAlready: "مكانك كان محجوز من قبل. رابط الحصة في « حصصي ».",
    okCta: "شوف حصصي",
    errAuth: "تسجّل الدخول باش تحجز مكانك.",
    errFull: "ما عادش فما أماكن في هاذي الحصة.",
    errUnavailable: "هذه الحصة ما عادش متوفّرة.",
    errConsent: "لازم موافقة وليّك باش تنجّم تحجز.",
    errConsentCta: "أعطي الموافقة",
    errGeneric: "الحجز ما مشاش. عاود حاول.",
    signIn: "تسجيل الدخول",
    notFound: "الحصة ما تلقاتش.",
  },
} as const;

/* ---------- confetti ---------- */
const CONFETTI_COLORS = ["#E0852E", "#1B9C6F", "#0E5AA6", "#F3C24B"];

function Confetti() {
  const pieces = Array.from({ length: 12 }, (_, i) => ({
    key: i,
    color: CONFETTI_COLORS[i % 4],
    left: 20 + Math.random() * 60,
    delay: Math.random() * 0.35,
    size: 7 + Math.random() * 5,
  }));
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes confetti-pop {
          0%   { opacity: 0; transform: translateY(0)    scale(.4) rotate(0deg);   }
          25%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(-70px) scale(1.1) rotate(200deg); }
        }
      `}} />
      {pieces.map((p) => (
        <span
          key={p.key}
          style={{
            position: "absolute",
            width: p.size,
            height: p.size,
            borderRadius: 2,
            background: p.color,
            left: `${p.left}%`,
            top: "35%",
            animationName: "confetti-pop",
            animationDuration: "0.95s",
            animationTimingFunction: "ease-out",
            animationFillMode: "forwards",
            animationDelay: `${p.delay}s`,
            pointerEvents: "none",
          }}
        />
      ))}
    </>
  );
}

/* ---------- success overlay ---------- */
function SuccessOverlay({ show, okTitle, okBody, okCta }: { show: boolean; okTitle: string; okBody: string; okCta: string }) {
  if (!show) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--cream)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "40px clamp(20px, 5vw, 48px)",
        zIndex: 40,
        animation: "rise .45s cubic-bezier(.2,.7,.2,1)",
        borderRadius: "inherit",
      }}
    >
      <Confetti />

      <div
        style={{
          width: 98,
          height: 98,
          borderRadius: "50%",
          background: "var(--green)",
          display: "grid",
          placeItems: "center",
          marginBottom: 22,
          boxShadow: "0 16px 32px -10px rgba(27,156,111,.75)",
          position: "relative",
          zIndex: 2,
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes draw-check { to { stroke-dashoffset: 0; } }
          .succ-check {
            stroke-dasharray: 40;
            stroke-dashoffset: 40;
            animation: draw-check .55s .15s forwards;
          }
        `}} />
        <svg
          viewBox="0 0 24 24"
          style={{ width: 50, height: 50, stroke: "#fff", fill: "none", strokeWidth: 3.4, strokeLinecap: "round", strokeLinejoin: "round" }}
        >
          <polyline points="5 13 10 18 19 7" className="succ-check" />
        </svg>
      </div>

      <h2 style={{ fontFamily: "var(--fd)", fontSize: 24, letterSpacing: -0.5, marginBottom: 10, position: "relative", zIndex: 2 }}>
        {okTitle}
      </h2>
      <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.65, maxWidth: 280, marginBottom: 28, position: "relative", zIndex: 2 }}>
        {okBody}
      </p>

      <Link href="/student" className="btn btn-ink" style={{ width: "100%", maxWidth: 220, position: "relative", zIndex: 2 }}>
        {okCta}
      </Link>
    </div>
  );
}

/* ---------- main ---------- */
export default function CheckoutInner() {
  const { t, locale } = useLocale();
  const c = copy[locale];
  const searchParams = useSearchParams();
  const classId = searchParams.get("class") ?? "";

  const [cls, setCls] = useState<ClassItem | null | undefined>(undefined);
  useEffect(() => {
    if (!classId) { setCls(null); return; }
    getClass(classId).then(setCls).catch(() => setCls(null));
  }, [classId]);

  const [done, setDone] = useState<null | "new" | "already">(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<"auth" | "full" | "unavailable" | "consent" | "generic" | null>(null);

  const handleConfirm = useCallback(async () => {
    setErr(null);
    setBusy(true);
    const res = await reserveSeat({ classId });
    setBusy(false);
    if (res.ok) { setDone(res.already ? "already" : "new"); return; }
    if (res.error === "not-authenticated") setErr("auth");
    else if (res.error === "full") setErr("full");
    else if (res.error === "unavailable") setErr("unavailable");
    // Guardian consent (INPDP) is enforced server-side in reserveSeat. Retrying
    // can never fix it — send them to the consent form and back to this class.
    else if (res.error === "needs-consent") setErr("consent");
    else setErr("generic");
  }, [classId]);

  if (cls === undefined) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 240 }}>
        <Spinner />
      </div>
    );
  }
  if (cls === null) {
    return (
      <div className="card card-pad" style={{ textAlign: "center", maxWidth: 460, marginInline: "auto" }}>
        <h1 style={{ fontFamily: "var(--fd)", fontSize: 18, marginBottom: 12 }}>{c.notFound}</h1>
        <Link href="/explore" className="btn btn-primary" style={{ maxWidth: 220, marginInline: "auto" }}>
          {t.nav.explore}
        </Link>
      </div>
    );
  }

  const isFree = cls.is_free_first;

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 560, marginInline: "auto" }}>

      {/* Title + back */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Link href={`/class/${cls.id}`} className="iconbtn" aria-label={t.common.back} style={{ flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" className="ic flip" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <h1 style={{ fontFamily: "var(--fd)", fontSize: "clamp(18px,3vw,22px)", fontWeight: 700, letterSpacing: -0.4 }}>
          {c.title}
        </h1>
      </div>

      {/* What you're booking */}
      <div className="sec" style={{ marginBottom: 10 }}>
        <span>{c.summary}</span>
      </div>

      <div className="card card-pad" style={{ display: "flex", gap: 13, alignItems: "center", marginBottom: 16 }}>
        <div className="thumb" style={{ background: "var(--blue)", color: "#fff", flexShrink: 0 }}>
          <b>{cls.day}</b>
          <span>{cls.month}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {cls.title}
          </div>
          <div className="metaline">
            <span>
              <Clock />
              {cls.time} · {cls.duration_min} {t.common.min}
            </span>
            <span>
              <Users />
              {t.common.seats(cls.seats_left)}
            </span>
          </div>
          {cls.tutor_name && (
            <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
              {c.who} {cls.tutor_name}
            </div>
          )}
        </div>
      </div>

      {/* Price — free first session; nothing is charged here */}
      <div className="panel panel-pad" style={{ marginBottom: 16 }}>
        {isFree ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", fontSize: 14 }}>
              <span style={{ color: "var(--muted)" }}>{c.priceLine}</span>
              <span className="price" style={{ color: "var(--green)" }}>0 {t.common.tnd}</span>
            </div>
            {cls.price_tnd > 0 && (
              <div style={{ paddingTop: 10, borderTop: "1px solid var(--line)", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>
                <div style={{ fontWeight: 700, color: "var(--ink2)", marginBottom: 3 }}>{c.nextLine(cls.price_tnd)}</div>
                {c.noPayNow}
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 13, color: "var(--ink2)", lineHeight: 1.6 }}>{c.paidNotice(cls.price_tnd)}</div>
        )}
      </div>

      {/* The one rule that actually binds: 24h cancellation */}
      <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "var(--green50)", borderRadius: 13, padding: "12px 13px", fontSize: 12.5, color: "#13724f", lineHeight: 1.55, marginBottom: 20 }}>
        <Calendar style={{ color: "var(--green)", flexShrink: 0, marginTop: 1, width: 17, height: 17 }} />
        <span>{c.cancelRule}</span>
      </div>

      {/* Errors */}
      {err && (
        <div
          role="alert"
          style={{
            background: "#FDECEA", border: "1px solid #F5C2BC", color: "#A3261B",
            borderRadius: 12, padding: "11px 13px", fontSize: 13, marginBottom: 12, textAlign: "center",
          }}
        >
          {err === "auth"
            ? c.errAuth
            : err === "full"
              ? c.errFull
              : err === "unavailable"
                ? c.errUnavailable
                : err === "consent"
                  ? c.errConsent
                  : c.errGeneric}
          {err === "auth" && (
            <>
              {" "}
              <Link href={`/auth?next=${encodeURIComponent(`/checkout?class=${cls.id}`)}`} style={{ color: "var(--blue)", fontWeight: 700, textDecoration: "underline" }}>
                {c.signIn}
              </Link>
            </>
          )}
          {err === "consent" && (
            <>
              {" "}
              <Link href={`/auth/consent?next=${encodeURIComponent(`/checkout?class=${cls.id}`)}`} style={{ color: "var(--blue)", fontWeight: 700, textDecoration: "underline" }}>
                {c.errConsentCta}
              </Link>
            </>
          )}
        </div>
      )}

      {/* Confirm */}
      <button className="btn btn-primary" onClick={handleConfirm} disabled={busy || done !== null} style={{ minHeight: 52, marginBottom: 32 }}>
        <Check />
        <span>{busy ? c.confirming : c.confirm}</span>
      </button>

      <SuccessOverlay
        show={done !== null}
        okTitle={c.okTitle}
        okBody={done === "already" ? c.okAlready : c.okBody}
        okCta={c.okCta}
      />
    </div>
  );
}
