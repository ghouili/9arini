"use client";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Link } from "@/components/Link";
import { useLocale } from "@/components/LocaleProvider";
import { Check, Calendar, Clock, Users, Shield, Back } from "@/components/icons";
import { Spinner } from "@/components/ui";
import { getClass, reserveSeat } from "@/app/actions";
import type { ClassItem } from "@tnajem/shared";
import { bilingual } from "@/lib/i18n";

/** Month label map FR → AR (short) — same table as the storefront. Class rows
    carry FR short labels, so an Arabic checkout used to read "23 JUIN". */
const monthAr: Record<string, string> = {
  JANV: "جانفي", FÉVR: "فيفري", MARS: "مارس", AVR: "أفريل",
  MAI: "ماي", JUIN: "جوان", JUIL: "جويل", AOÛT: "أوت",
  SEPT: "سبتمبر", OCT: "أكتوبر", NOV: "نوفمبر", DÉC: "ديسمبر",
};

/* Payments are OFF for the pilot (lib/payments.ts). This screen is a free
   seat reservation, not a checkout: no rails, no card, no "paiement sécurisé".

   The single most important job of this page is to make that unambiguous at the
   moment of commitment — a visitor who thinks a card is about to be charged
   bounces. So the amount Tnajem takes today (0 TND, always, free class or not) is
   the headline, the "no card" line sits directly under it, and the price of the
   paid sessions is framed as something arranged with the tutor.

   Page-local copy — lib/i18n.ts is shared with other screens. */
const copy = bilingual({
  fr: {
    title: "Confirmer ma réservation",
    summary: "Ce que tu réserves",
    who: "Avec",
    loading: "On charge la séance…",
    // t.common.seats(n) renders "1 places" and, at 0, "0 places" — which reads like
    // an invitation to book a class that is already full.
    seats: (n: number) =>
      n <= 0 ? "Complet" : n === 1 ? "1 place restante" : `${n} places restantes`,

    // ── Money (true for the pilot: Tnajem takes nothing, ever, today) ──
    payTitle: "À payer sur Tnajem",
    payAmount: "0 TND",
    noCard: "Aucun paiement en ligne. Tu règles ton prof directement.",
    freeSession: "Cette séance est offerte par ton prof.",
    paidSession: (p: number) =>
      `Cette séance est à ${p} TND — tu la règles directement avec ton prof, après.`,
    nextSessions: (p: number) =>
      `Séances suivantes : ${p} TND, directement avec ton prof, si ça te convient.`,

    // ── What happens next ──
    nextTitle: "Ce qui se passe ensuite",
    next1: "Ta place est bloquée tout de suite.",
    next2: "Le lien de la séance apparaît dans « Mes cours ».",
    next3: "Tu te connectes à l'heure — c'est tout.",
    cancelRule: "Annulation gratuite jusqu'à 24h avant le cours, depuis « Mes cours ».",

    confirm: "Confirmer ma place",
    confirming: "On réserve ta place…",

    okTitle: "C'est réservé !",
    okBody: "Ta place est confirmée. Retrouve le lien de la séance dans « Mes cours ».",
    okAlready: "Tu avais déjà cette place. Le lien de la séance est dans « Mes cours ».",
    okWhen: "Rendez-vous",
    okCta: "Voir mes cours",

    // ── Dead ends, each with a way out ──
    soldOutTitle: "Cette séance est complète",
    soldOutBody: "Toutes les places sont prises. Trouve une autre séance — il y en a d'autres.",
    otherClasses: "Voir d'autres séances",
    errAuth: "Connecte-toi pour réserver ta place.",
    errFull: "Plus de places pour cette séance.",
    errUnavailable: "Cette séance n'est plus disponible.",
    errConsent: "Il manque l'accord de ton parent ou tuteur pour réserver.",
    errConsentCta: "Donner l'accord",
    errGeneric: "La réservation n'a pas marché. Réessaie dans un instant.",
    signIn: "Se connecter",
    notFound: "Séance introuvable",
    notFoundBody: "Le lien a peut-être expiré, ou le prof a annulé cette séance.",
  },
  ar: {
    title: "أكّد حجزي",
    summary: "شنوّة قاعد تحجز",
    who: "مع",
    loading: "قاعدين نحمّلو الحصة…",
    seats: (n: number) =>
      n <= 0 ? "كامل" : n === 1 ? "بلاصة وحدة تبقات" : n === 2 ? "زوز بلايص تبقاو" : `${n} بلايص تبقاو`,

    payTitle: "اللي تخلّصو في Tnajem",
    payAmount: "0 د.ت",
    noCard: "ما فماش خلاص أونلاين. تخلّص أستاذك مباشرة.",
    freeSession: "هذه الحصة مقدّمة مجاناً من أستاذك.",
    paidSession: (p: number) =>
      `هذه الحصة بـ ${p} د.ت — تخلّصها مباشرة مع أستاذك، من بعد.`,
    nextSessions: (p: number) =>
      `الحصص الموالية : ${p} د.ت، مباشرة مع أستاذك، كان عجبك.`,

    nextTitle: "شنوّة يصير من بعد",
    next1: "بلاصتك تتحجز في الحين.",
    next2: "رابط الحصة يبان في « حصصي ».",
    next3: "تدخل في الوقت — وهذا الكل.",
    cancelRule: "الإلغاء مجاني حتى 24 ساعة قبل الحصة، من « حصصي ».",

    confirm: "أكّد مكاني",
    confirming: "قاعدين نحجزو بلاصتك…",

    okTitle: "تم الحجز !",
    okBody: "مكانك مؤكّد. تلقى رابط الحصة في « حصصي ».",
    okAlready: "مكانك كان محجوز من قبل. رابط الحصة في « حصصي ».",
    okWhen: "الموعد",
    okCta: "شوف حصصي",

    soldOutTitle: "هذه الحصة كاملة",
    soldOutBody: "الأماكن الكل تحجزو. لوّج على حصة أخرى — فما غيرها.",
    otherClasses: "شوف حصص أخرى",
    errAuth: "تسجّل الدخول باش تحجز مكانك.",
    errFull: "ما عادش فما أماكن في هاذي الحصة.",
    errUnavailable: "هذه الحصة ما عادش متوفّرة.",
    errConsent: "لازم موافقة وليّك باش تنجّم تحجز.",
    errConsentCta: "أعطي الموافقة",
    errGeneric: "الحجز ما مشاش. عاود حاول بعد شويّة.",
    signIn: "تسجيل الدخول",
    notFound: "الحصة ما تلقاتش",
    notFoundBody: "يمكن الرابط فات وقتو، ولا الأستاذ لغى الحصة.",
  },
});

/* ---------- confetti ---------- */
const CONFETTI_COLORS = ["var(--ochre)", "var(--green)", "var(--blue)", "var(--amber)"];

function Confetti() {
  const pieces = Array.from({ length: 12 }, (_, i) => ({
    key: i,
    color: CONFETTI_COLORS[i % 4],
    // named `start` to match the insetInlineStart it feeds — as `left` it read
    // like a physical CSS property in an inline style object, which it is not.
    start: 20 + Math.random() * 60,
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
          aria-hidden="true"
          style={{
            position: "absolute",
            width: p.size,
            height: p.size,
            borderRadius: 2,
            background: p.color,
            insetInlineStart: `${p.start}%`,
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
function SuccessOverlay({
  show, okTitle, okBody, whenLabel, when, okCta,
}: {
  show: boolean; okTitle: string; okBody: string; whenLabel: string; when: string; okCta: string;
}) {
  if (!show) return null;
  return (
    <div className="ck-success" role="status" aria-live="polite">
      <Confetti />

      <div className="ck-success-badge">
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
          aria-hidden="true"
          style={{ width: 50, height: 50, stroke: "#fff", fill: "none", strokeWidth: 3.4, strokeLinecap: "round", strokeLinejoin: "round" }}
        >
          <polyline points="5 13 10 18 19 7" className="succ-check" />
        </svg>
      </div>

      <h2 className="ck-success-title">{okTitle}</h2>
      <p className="ck-success-body">{okBody}</p>

      {/* The one thing they need to remember when they close this screen. */}
      <div className="ck-success-when">
        <Calendar />
        <span>
          <b>{whenLabel}</b> {when}
        </span>
      </div>

      <Link href="/student" className="btn btn-ink ck-success-cta">
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

  /* Page-scoped styles. --fd (Space Grotesk) has no Arabic glyphs and its negative
     tracking severs Arabic joins, so every display-font surface here has an RTL
     fallback — which inline styles could not express. */
  const styles = (
    <style dangerouslySetInnerHTML={{ __html: `
      /* Display font. No RTL override here: globals.css redefines --fd → --fa and
         zeroes letter-spacing under html[dir="rtl"], which covers all of these. */
      .ck-h1,.ck-pay-amount,.ck-success-title{font-family:var(--fd)}

      .ck-wrap{position:relative;width:100%;max-width:560px;margin-inline:auto}
      .ck-head{display:flex;align-items:center;gap:12px;margin-bottom:22px}
      .ck-head .iconbtn{flex:none}
      .ck-h1{font-size:clamp(18px,3vw,22px);font-weight:700;letter-spacing:-.4px;line-height:1.25;min-width:0}

      /* ── what you're booking ── */
      .ck-class{flex-direction:row;gap:13px;align-items:flex-start;margin-bottom:16px}
      .ck-class-main{flex:1 1 0;min-width:0}
      .ck-class-title{
        font-weight:700;font-size:15px;line-height:1.35;margin-bottom:5px;overflow-wrap:anywhere;
        /* Two lines, then ellipsis — never a single truncated line: at the moment of
           commitment the student has to be able to read what they are booking. */
        display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
      }
      .ck-class-who{color:var(--muted);font-size:13px;margin-top:5px;overflow-wrap:anywhere}
      .ck-soldout{color:var(--rose);font-weight:700}

      /* ── money ── */
      .ck-pay{margin-bottom:16px}
      .ck-pay-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .ck-pay-label{font-size:13.5px;color:var(--ink2);font-weight:600;min-width:0}
      .ck-pay-amount{font-size:30px;font-weight:700;letter-spacing:-1px;color:var(--green-ink);white-space:nowrap;line-height:1.1}
      .ck-pay-note{display:flex;gap:8px;align-items:center;margin-top:8px;font-size:13px;font-weight:700;color:var(--green-ink)}
      .ck-pay-note .ic{width:16px;height:16px;color:var(--green);flex:none}
      .ck-pay-detail{margin-top:12px;padding-top:12px;border-top:1px solid var(--line);
        font-size:13px;color:var(--muted);line-height:1.6}
      .ck-pay-detail b{color:var(--ink2);display:block;margin-bottom:2px}

      /* ── what happens next ── */
      .ck-next{background:var(--blue50);border:1px solid var(--lineCool);border-radius:var(--r);
        padding:15px 16px;margin-bottom:14px}
      .ck-next-title{font-size:13px;font-weight:700;color:var(--ink);margin-bottom:10px}
      .ck-steps{list-style:none;display:grid;gap:9px;margin:0;padding:0}
      .ck-steps li{display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.5;color:var(--ink2)}
      .ck-steps .ic{width:15px;height:15px;color:var(--blue);flex:none;margin-top:2px}

      .ck-cancel{display:flex;gap:9px;align-items:flex-start;background:var(--green50);border-radius:13px;
        padding:12px 13px;font-size:13px;color:var(--green-ink);line-height:1.55;margin-bottom:20px}
      .ck-cancel .ic{color:var(--green);flex:none;margin-top:1px;width:17px;height:17px}

      /* ── errors / dead ends ── */
      .ck-alert{background:var(--rose50);border:1px solid var(--rose300);color:var(--rose700);border-radius:12px;
        padding:12px 14px;font-size:13px;line-height:1.55;margin-bottom:12px;text-align:center}
      .ck-alert a{color:var(--blue);font-weight:700;text-decoration:underline}
      .ck-cta{min-height:52px}
      .ck-foot{margin-bottom:32px}
      .ck-state{text-align:center;max-width:460px;margin-inline:auto}
      .ck-state p{font-size:13.5px;color:var(--muted);line-height:1.6;margin:8px 0 18px}
      .ck-state .btn{max-width:240px;margin-inline:auto}

      /* ── success ── */
      .ck-success{
        position:absolute;inset:0;background:var(--cream);display:flex;flex-direction:column;
        align-items:center;justify-content:center;text-align:center;
        padding:40px clamp(20px,5vw,48px);z-index:40;border-radius:inherit;
        animation:rise .45s cubic-bezier(.2,.7,.2,1);
      }
      /* Each content child sits above the confetti. NOT a universal child rule:
         that would also hit the absolutely-positioned confetti pieces and
         un-position them. */
      .ck-success-badge,.ck-success-title,.ck-success-body,.ck-success-when,.ck-success-cta{
        position:relative;z-index:2;
      }
      .ck-success-badge{width:92px;height:92px;border-radius:50%;background:var(--green);
        display:grid;place-items:center;margin-bottom:20px;box-shadow:0 16px 32px -10px rgba(27,156,111,.75)}
      .ck-success-title{font-size:24px;letter-spacing:-.5px;margin-bottom:10px}
      .ck-success-body{color:var(--muted);font-size:14px;line-height:1.65;max-width:300px;margin-bottom:16px}
      .ck-success-when{display:flex;gap:8px;align-items:center;justify-content:center;
        background:var(--blue50);color:var(--ink2);border-radius:999px;padding:8px 14px;
        font-size:13px;margin-bottom:24px;max-width:100%;flex-wrap:wrap}
      .ck-success-when .ic{width:15px;height:15px;color:var(--blue);flex:none}
      .ck-success-cta{width:100%;max-width:220px}
    `}} />
  );

  if (cls === undefined) {
    return (
      <>
        {styles}
        <div
          role="status"
          aria-live="polite"
          className="ck-state"
          style={{ minHeight: 240, display: "grid", placeItems: "center" }}
        >
          <div>
            <Spinner />
            <p style={{ margin: 0 }}>{c.loading}</p>
          </div>
        </div>
      </>
    );
  }
  if (cls === null) {
    return (
      <>
        {styles}
        <div className="u-card u-card-pad ck-state">
          <h1 className="ck-h1">{c.notFound}</h1>
          <p>{c.notFoundBody}</p>
          <Link href="/explore" className="btn btn-primary">
            {t.nav.explore}
          </Link>
        </div>
      </>
    );
  }

  const month = locale === "ar" ? monthAr[cls.month] ?? cls.month : cls.month;
  const whenLine = `${cls.day} ${month} · ${cls.time}`;
  const soldOut = cls.seats_left <= 0;

  return (
    <div className="ck-wrap">
      {styles}

      {/* Title + back */}
      <div className="ck-head">
        <Link href={`/class/${cls.id}`} className="iconbtn" aria-label={t.common.back}>
          <Back />
        </Link>
        <h1 className="ck-h1">{c.title}</h1>
      </div>

      {/* What you're booking */}
      <div className="sec" style={{ marginBottom: 10 }}>
        <span>{c.summary}</span>
      </div>

      <div className="u-card u-card-pad ck-class">
        <div className="thumb" style={{ background: "var(--blue)", color: "#fff" }}>
          <b>{cls.day}</b>
          <span>{month}</span>
        </div>
        <div className="ck-class-main">
          <div className="ck-class-title">{cls.title}</div>
          <div className="metaline">
            <span>
              <Clock />
              {cls.time} · {cls.duration_min} {t.common.min}
            </span>
            <span className={soldOut ? "ck-soldout" : undefined}>
              <Users />
              {c.seats(cls.seats_left)}
            </span>
          </div>
          {cls.tutor_name && (
            <div className="ck-class-who">
              {c.who} {cls.tutor_name}
            </div>
          )}
        </div>
      </div>

      {/* Money. Tnajem charges nothing today — free class or paid — because there is
          no payment rail in the pilot. Saying that plainly, as the headline number,
          is the whole reassurance story of this screen. */}
      <div className="panel panel-pad ck-pay">
        <div className="ck-pay-row">
          <span className="ck-pay-label">{c.payTitle}</span>
          <span className="ck-pay-amount">{c.payAmount}</span>
        </div>
        <div className="ck-pay-note">
          <Shield />
          <span>{c.noCard}</span>
        </div>
        <div className="ck-pay-detail">
          {cls.is_free_first ? (
            <>
              <b>{c.freeSession}</b>
              {cls.price_tnd > 0 && c.nextSessions(cls.price_tnd)}
            </>
          ) : (
            c.paidSession(cls.price_tnd)
          )}
        </div>
      </div>

      {/* What happens after the tap — removes the "and then what?" hesitation. */}
      <div className="ck-next">
        <div className="ck-next-title">{c.nextTitle}</div>
        <ol className="ck-steps">
          <li><Check /><span>{c.next1}</span></li>
          <li><Check /><span>{c.next2}</span></li>
          <li><Check /><span>{c.next3}</span></li>
        </ol>
      </div>

      {/* The one rule that actually binds: 24h cancellation */}
      <div className="ck-cancel">
        <Calendar />
        <span>{c.cancelRule}</span>
      </div>

      {/* Errors — every one of them offers the next move. */}
      {err && (
        <div role="alert" className="ck-alert">
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
              <Link href={`/auth?next=${encodeURIComponent(`/checkout?class=${cls.id}`)}`}>
                {c.signIn}
              </Link>
            </>
          )}
          {err === "consent" && (
            <>
              {" "}
              <Link href={`/auth/consent?next=${encodeURIComponent(`/checkout?class=${cls.id}`)}`}>
                {c.errConsentCta}
              </Link>
            </>
          )}
          {(err === "full" || err === "unavailable") && (
            <>
              {" "}
              <Link href="/explore">{c.otherClasses}</Link>
            </>
          )}
        </div>
      )}

      {/* Confirm — or an honest way out when the seats are already gone. Letting a
          student tap into a guaranteed "full" error is a dead end we can see coming. */}
      <div className="ck-foot">
        {soldOut ? (
          <div className="u-card u-card-pad ck-state" style={{ marginBottom: 0 }}>
            <h2 className="ck-h1" style={{ fontSize: 16 }}>{c.soldOutTitle}</h2>
            <p>{c.soldOutBody}</p>
            <Link href="/explore" className="btn btn-primary">{c.otherClasses}</Link>
          </div>
        ) : (
          <button
            className="btn btn-primary ck-cta"
            onClick={handleConfirm}
            disabled={busy || done !== null}
            aria-busy={busy}
          >
            <Check />
            <span>{busy ? c.confirming : c.confirm}</span>
          </button>
        )}
      </div>

      <SuccessOverlay
        show={done !== null}
        okTitle={c.okTitle}
        okBody={done === "already" ? c.okAlready : c.okBody}
        whenLabel={c.okWhen}
        when={whenLine}
        okCta={c.okCta}
      />
    </div>
  );
}
