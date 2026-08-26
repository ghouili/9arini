"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "@/components/Link";
import { Button, Spinner } from "@/components/ui";
import { useLocale } from "@/components/LocaleProvider";
import { Gear, Bell, Wallet, Share, Copy, Video, Plus, Bulb, Users, Eye, Book, Shield, Check, Phone, Clock } from "@/components/icons";
import { SiteShell } from "@/components/SiteShell";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { getDashboard, getNotifications, markNotificationsRead } from "@/app/actions";
import type { DashboardData, DashboardBooking, NotificationItem } from "@/lib/types";

/* Page-local copy (never edit lib/i18n.ts from here). FR + Derija, RTL-safe.
   NOTE: the shared t.dashboard.s1p/s2p/s3p strings still describe online payment
   ("ils paient en TND — Flouci, carte ou D17") and a 12 % / 88 % split. 9arini
   processes NO money during the pilot, so this page uses its own honest steps
   below instead of those keys. */
const copy = {
  fr: {
    signedOutTitle: "Connecte-toi pour voir ton tableau de bord",
    signedOutBody: "Tes cours, tes élèves inscrits et ton lien s'affichent ici une fois connecté.",
    signIn: "Se connecter",
    hello: "Ton tableau de bord",
    bookings: "Tes élèves inscrits",
    bookingsSub: "Qui a réservé, et comment le joindre.",
    bookingsEmpty: "Personne n'a encore réservé.",
    bookingsEmptyBody: "Partage ton lien. Dès qu'un élève réserve, tu vois son nom et son numéro ici — tu peux l'appeler avant le cours.",
    signedUp: (n: number) => (n > 1 ? `${n} inscrits` : `${n} inscrit`),
    call: "Appeler",
    noPhone: "Pas de numéro",
    anon: "Élève",
    free: "Gratuit",
    paid: "Payé",
    reserved: "Réservé",
    attended: "Présent",
    bookedAgo: "Réservé",
    paymentsSoonTitle: "Les paiements arrivent bientôt",
    paymentsSoonBody: "Pour l'instant tes élèves réservent sans payer en ligne : l'élève te paie directement, et tu gardes 100 %. Dès que Flouci et D17 sont branchés, ton solde s'affiche ici.",
    notifTitle: "Notifications",
    notifEmpty: "Rien de neuf pour l'instant.",
    justNow: "à l'instant",
    minsAgo: (n: number) => `il y a ${n} min`,
    hoursAgo: (n: number) => `il y a ${n} h`,
    daysAgo: (n: number) => `il y a ${n} j`,

    // ── next steps ──
    nextTitle: "À faire maintenant",
    nextSub: "Quatre étapes, dans l'ordre. Chacune prend quelques minutes.",
    done: "Fait",
    inProgress: "En cours",
    st1t: "Crée ta page de prof",
    st1b: "Ton nom, ta matière, ton lien. Deux minutes.",
    st1cta: "Créer ma page",
    st2t: "Fais-toi vérifier",
    st2b: "Envoie ta pièce d'identité. On vérifie à la main, puis ta page passe en ligne.",
    st2cta: "Envoyer mes documents",
    st2tPending: "Vérification en cours",
    st2bPending: "On regarde tes documents. Réponse en général sous 24–48 h — rien à faire de ton côté.",
    st2tRejected: "Dossier à compléter",
    st2bRejected: "Il manque quelque chose. Corrige et renvoie tes documents.",
    st2ctaRejected: "Renvoyer mes documents",
    st2tDone: "Compte vérifié",
    st2bDone: "Ta page est publique et listée dans Explorer.",
    st3t: "Publie ta 1ʳᵉ classe",
    st3b: "Un titre, une date, ton prix. Tu fixes le tarif, tu gardes 100 %.",
    st3cta: "Créer ma classe",
    st3tDone: "Ta 1ʳᵉ classe est publiée",
    st3bDone: "Tu peux en ajouter d'autres quand tu veux.",
    st4t: "Partage ton lien",
    st4b: "WhatsApp, Insta, TikTok. C'est comme ça que les élèves arrivent.",
    st4cta: "Voir mon lien",

    // ── how you get paid (replaces the outdated shared strings) ──
    howTitle: "Comment tu es payé, aujourd'hui",
    h1t: "Tu fixes ton prix",
    h1b: "Classe par classe, sans plafond.",
    h2t: "L'élève réserve",
    h2b: "Son nom et son numéro arrivent ici, tout de suite.",
    h3t: "Il te paie directement",
    h3b: "De la main à la main pendant le pilote. 9arini ne prend aucune commission. Le paiement en ligne arrivera plus tard.",
    shareLabel: "Ton lien de prof",
  },
  ar: {
    signedOutTitle: "ادخل لحسابك باش تشوف لوحتك",
    signedOutBody: "حصصك، التلاميذ اللي حجزو، والرابط متاعك يبانو هوني كي تدخل.",
    signIn: "دخول",
    hello: "لوحتك",
    bookings: "التلاميذ اللي حجزو",
    bookingsSub: "شكون حجز، وكيفاش تتصل بيه.",
    bookingsEmpty: "ما زال حتّى حد ما حجز.",
    bookingsEmptyBody: "شارك رابطك. أوّل ما تلميذ يحجز، تشوف اسمو ونمرتو هوني — تنجم تكلّمو قبل الحصة.",
    signedUp: (n: number) => `${n} محجوز`,
    call: "اتصل",
    noPhone: "ما فماش نمرة",
    anon: "تلميذ",
    free: "فابور",
    paid: "خالص",
    reserved: "محجوز",
    attended: "حاضر",
    bookedAgo: "حجز",
    paymentsSoonTitle: "الخلاص أونلاين يوصل قريب",
    paymentsSoonBody: "توّا التلاميذ يحجزو بلا ما يخلّصو على الخط : التلميذ يخلّصك مباشرة، وإنتي تحتفظ بـ 100 %. كي نربطو فلوسي و D17، رصيدك يبان هوني.",
    notifTitle: "الإشعارات",
    notifEmpty: "ما فماش جديد توّا.",
    justNow: "توّا",
    minsAgo: (n: number) => `منذ ${n} د`,
    hoursAgo: (n: number) => `منذ ${n} س`,
    daysAgo: (n: number) => `منذ ${n} يوم`,

    nextTitle: "اللي لازم تعملو توّا",
    nextSub: "أربع مراحل، وحدة وحدة. كل وحدة تاخذ دقايق.",
    done: "تعمل",
    inProgress: "في الطريق",
    st1t: "اعمل صفحتك متاع أستاذ",
    st1b: "إسمك، مادتك، اللينك متاعك. دقيقتين.",
    st1cta: "اعمل صفحتي",
    st2t: "تثبّت من هويتك",
    st2b: "ابعث بطاقة تعريفك. نتثبّتو بيدينا، ومن بعد صفحتك تولّي أونلاين.",
    st2cta: "ابعث وثائقي",
    st2tPending: "التثبّت في الطريق",
    st2bPending: "قاعدين نشوفو في وثائقك. الجواب عادةً في 24–48 ساعة — ما عندك ما تعمل.",
    st2tRejected: "الملف يلزمو تكملة",
    st2bRejected: "فمّا حاجة ناقصة. صلّح وعاود ابعث وثائقك.",
    st2ctaRejected: "عاود ابعث وثائقي",
    st2tDone: "الحساب متثبّت",
    st2bDone: "صفحتك ظاهرة للناس وموجودة في «اكتشف».",
    st3t: "انشر أول حصة متاعك",
    st3b: "عنوان، وقت، وثمنك. إنتي تحدّد التعريفة، وتحتفظ بـ 100 %.",
    st3cta: "اعمل حصتي",
    st3tDone: "أول حصة متاعك تنشرت",
    st3bDone: "تنجم تزيد أخرين وقتلي تحب.",
    st4t: "شارك اللينك متاعك",
    st4b: "واتساب، إنستا، تيكتوك. هكّا التلامذة يجيو.",
    st4cta: "شوف اللينك متاعي",

    howTitle: "كيفاش تتخلّص، اليوم",
    h1t: "إنتي تحدّد ثمنك",
    h1b: "حصة بحصة، بلا سقف.",
    h2t: "التلميذ يحجز",
    h2b: "إسمو ونمرتو يوصلو لهوني في الحين.",
    h3t: "يخلّصك مباشرة",
    h3b: "يد بيد في فترة التجربة. 9arini ما تاخذ حتى عمولة. الخلاص أونلاين يجي من بعد.",
    shareLabel: "اللينك متاعك متاع أستاذ",
  },
} as const;

// Union of both locales — copy[locale] is fr-shaped OR ar-shaped (same keys).
// (Named CopyDict, not Copy: `Copy` is already the clipboard icon import.)
type CopyDict = (typeof copy)["fr"] | (typeof copy)["ar"];

/* Page-scoped CSS (`qd-`), injected with dangerouslySetInnerHTML and UNLAYERED so
   it wins over globals.css's @layer components without !important.
   • .balance .amt is 42px / -1.4px tracking in globals: a 5-digit amount blows out
     of the card, and Space Grotesk (--fd) has NO Arabic glyphs while the negative
     tracking severs Arabic cursive joins. Clamped + RTL fallback here.
   • The amount is isolated LTR so "1 280 TND" can't reorder inside an RTL page. */
const CSS = `
.qd-balance .amt{font-size:clamp(26px,6.5vw,40px);letter-spacing:-1px;line-height:1.08;
  overflow-wrap:anywhere;font-variant-numeric:tabular-nums;margin-top:4px}
.qd-balance.is-quiet .amt{font-size:clamp(22px,4.5vw,28px);letter-spacing:-.5px}
html[dir="rtl"] .qd-balance .amt{font-family:var(--fa);letter-spacing:normal}
.qd-num{direction:ltr;unicode-bidi:isolate;display:inline-block}
.qd-step{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap;
  padding:14px 0;border-block-end:1px solid var(--line)}
.qd-step:last-child{border-block-end:0;padding-bottom:2px}
.qd-step-txt{flex:1 1 220px;min-width:0}
.qd-mark{width:28px;height:28px;border-radius:10px;flex:none;display:grid;place-items:center;
  font-family:var(--fd);font-size:13px;font-weight:700;margin-top:1px}
.qd-cta{flex:none;width:auto}
.qd-tel{direction:ltr;unicode-bidi:isolate}
/* a .chip is inline-flex: next to shrinking text in a flex row it deforms */
.qd-step .chip{flex:none}
`;

// Relative time. Rendered client-side only (data arrives in an effect) → no hydration risk.
function timeAgo(iso: string, c: CopyDict): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return c.justNow;
  if (mins < 60) return c.minsAgo(mins);
  const hours = Math.floor(mins / 60);
  if (hours < 24) return c.hoursAgo(hours);
  return c.daysAgo(Math.floor(hours / 24));
}

// ── Notifications bell (real: getNotifications / markNotificationsRead) ──────
function NotifBell() {
  const { t, locale } = useLocale();
  const c = copy[locale];
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [unread, setUnread] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    getNotifications()
      .then((n) => {
        if (!alive) return;
        setItems(n);
        setUnread(n.filter((x) => !x.read).length);
      })
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;
    // Refresh, then mark read server-side. We keep the per-item dots visible for
    // this open panel so the tutor can still see what was new.
    const fresh = await getNotifications().catch(() => [] as NotificationItem[]);
    setItems(fresh);
    if (fresh.some((n) => !n.read)) {
      await markNotificationsRead().catch(() => {});
      setUnread(0);
    }
  }

  const list = items ?? [];

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        className="iconbtn"
        type="button"
        aria-label={t.extra.notifications}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={toggle}
        style={{ position: "relative" }}
      >
        <Bell />
        {unread > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 6,
              insetInlineEnd: 6,
              minWidth: 8,
              height: 8,
              borderRadius: 999,
              background: "var(--green)",
              boxShadow: "0 0 0 2px var(--sand)",
            }}
          />
        )}
      </button>

      {/* Plain <div>, not role="menu". A menu promises menuitem children and
          arrow-key roving focus; this is a scrollable list of notification
          links, so the ARIA role was describing a widget that does not exist
          and broke navigation for anyone relying on it. */}
      {open && (
        <div
          aria-label={c.notifTitle}
          className="panel"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            insetInlineEnd: 0,
            width: "min(330px, calc(100vw - 32px))",
            maxHeight: 420,
            overflowY: "auto",
            zIndex: 60,
            padding: 6,
            textAlign: "start",
          }}
        >
          <div
            style={{
              fontFamily: "var(--fd)",
              fontSize: 13,
              fontWeight: 700,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: ".5px",
              padding: "10px 12px 8px",
            }}
          >
            {c.notifTitle}
          </div>

          {items === null ? (
            <div style={{ display: "grid", placeItems: "center", padding: 24 }}>
              <Spinner />
            </div>
          ) : list.length === 0 ? (
            <div style={{ padding: "14px 12px 18px", fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
              {c.notifEmpty}
            </div>
          ) : (
            list.map((n) => {
              const inner = (
                <>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 999,
                      background: n.read ? "transparent" : "var(--blue)",
                      flexShrink: 0,
                      marginTop: 7,
                    }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>
                      {n.title}
                    </span>
                    <span style={{ display: "block", fontSize: 13, color: "var(--ink2)", lineHeight: 1.5, marginTop: 2 }}>
                      {n.body}
                    </span>
                    <span style={{ display: "block", fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                      {timeAgo(n.createdAt, c)}
                    </span>
                  </span>
                </>
              );
              const rowStyle: React.CSSProperties = {
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                padding: "11px 12px",
                borderRadius: 12,
                color: "inherit",
                background: n.read ? "transparent" : "var(--blue50)",
                marginBottom: 3,
              };
              return n.href ? (
                <Link key={n.id} href={n.href} role="menuitem" style={rowStyle} onClick={() => setOpen(false)}>
                  {inner}
                </Link>
              ) : (
                <div key={n.id} role="menuitem" style={rowStyle}>
                  {inner}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── "What to do next" — the tutor's whole job, in order ─────────────────────
type StepState = "done" | "current" | "todo" | "waiting";
type Step = {
  key: string;
  title: string;
  body: string;
  state: StepState;
  cta?: { label: string; href: string };
};

function StepMark({ state, n }: { state: StepState; n: number }) {
  const style: React.CSSProperties =
    state === "done"
      ? { background: "var(--green-btn)", color: "#fff" }
      : state === "waiting"
      ? { background: "var(--blue50)", color: "var(--blue)" }
      : state === "current"
      ? { background: "var(--ochre-btn)", color: "#fff" }
      : { background: "var(--sand)", color: "var(--muted)" };
  return (
    <span className="qd-mark" style={style} aria-hidden="true">
      {state === "done" ? <Check style={{ width: 15, height: 15 }} /> : state === "waiting" ? <Clock style={{ width: 15, height: 15 }} /> : n}
    </span>
  );
}

function NextSteps({ steps, c }: { steps: Step[]; c: CopyDict }) {
  return (
    <div className="panel panel-pad" style={{ marginBottom: "clamp(14px,2vw,22px)" }}>
      <div style={{ marginBottom: 6 }}>
        <h2 style={{ fontFamily: "var(--fd)", fontSize: 16, fontWeight: 700 }}>{c.nextTitle}</h2>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3 }}>{c.nextSub}</div>
      </div>

      {steps.map((s, i) => (
        <div key={s.key} className="qd-step">
          <StepMark state={s.state} n={i + 1} />
          <div className="qd-step-txt">
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: s.state === "todo" ? "var(--ink2)" : "var(--ink)" }}>
                {s.title}
              </span>
              {s.state === "done" && <span className="chip chip-soft" style={{ background: "var(--green50)", color: "var(--green-ink)" }}>{c.done}</span>}
              {s.state === "waiting" && <span className="chip chip-soft">{c.inProgress}</span>}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, marginTop: 3 }}>{s.body}</div>
          </div>
          {s.cta && (
            <Link href={s.cta.href} className="btn btn-primary btn-sm qd-cta">
              {s.cta.label}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

// ── How you actually get paid during the pilot (honest, page-local copy) ────
function HowItWorks({ c }: { c: CopyDict }) {
  const steps = [
    { n: 1, title: c.h1t, body: c.h1b },
    { n: 2, title: c.h2t, body: c.h2b },
    { n: 3, title: c.h3t, body: c.h3b },
  ];
  return (
    <div className="panel panel-pad">
      <div style={{ fontFamily: "var(--fd)", fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{c.howTitle}</div>
      {steps.map((s) => (
        <div
          key={s.n}
          style={{
            display: "flex",
            gap: 13,
            alignItems: "flex-start",
            padding: "13px 0",
            borderBottom: s.n < 3 ? "1px solid var(--line)" : "none",
          }}
        >
          <div
            style={{
              width: 27, height: 27, borderRadius: 9, background: "var(--ink)", color: "#fff",
              display: "grid", placeItems: "center", fontFamily: "var(--fd)", fontSize: 13, flexShrink: 0,
            }}
          >
            {s.n}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{s.title}</div>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.55 }}>{s.body}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Shared: copyable storefront link box (real slug) ────────────────────────
function StoreLinkBox({ slug }: { slug: string }) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  const url = `9arini.tn/${slug}`;
  function handleCopy() {
    navigator.clipboard.writeText(`https://${url}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "var(--sand)",
        border: "1.4px dashed var(--blue)", borderRadius: 13, padding: "11px 13px",
      }}
    >
      <span style={{ color: "var(--blue)", flexShrink: 0, display: "flex" }} aria-hidden="true">
        <Share />
      </span>
      <span
        dir="ltr"
        style={{
          fontFamily: "var(--fd)", fontSize: 13, color: "var(--blue)", textAlign: "start",
          overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", flex: "1 1 140px", minWidth: 0,
        }}
      >
        {url}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        style={{
          marginInlineStart: "auto", background: copied ? "var(--green)" : "var(--blue)", color: "#fff",
          border: 0, padding: "10px 13px", borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: "pointer",
          flexShrink: 0, minHeight: 44, fontFamily: "var(--fb)", transition: "background .2s",
          display: "inline-flex", alignItems: "center", gap: 5,
        }}
      >
        {copied ? t.common.copied : (<><Copy />{t.common.copy}</>)}
      </button>
    </div>
  );
}

// ── Share panel — the growth loop, always visible once the page exists ───────
function SharePanel({ slug, c }: { slug: string; c: CopyDict }) {
  const { t } = useLocale();
  return (
    <div id="share" className="panel panel-pad" style={{ marginBottom: "clamp(14px,2vw,22px)", scrollMarginTop: 84 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
        <h2 style={{ fontFamily: "var(--fd)", fontSize: 16, fontWeight: 700 }}>{t.dashboard.shareTitle}</h2>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px" }}>
          {c.shareLabel}
        </span>
      </div>
      <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, marginBottom: 12 }}>{t.dashboard.shareBody}</p>
      <StoreLinkBox slug={slug} />
      <div style={{ marginTop: 12 }}>
        <Link href={`/${slug}`} className="btn btn-ink btn-sm">
          <Eye />
          {t.dashboard.viewStore}
        </Link>
      </div>
    </div>
  );
}

// ── Balance card — always the REAL balance (0 while payments are off) ────────
function BalanceCard({ d }: { d: DashboardData }) {
  const { t, locale } = useLocale();
  const c = copy[locale];
  return (
    <div
      className={`balance qd-balance zellige hero-blue panel${d.paymentsEnabled ? "" : " is-quiet"}`}
      style={{ borderRadius: "var(--r-l)", padding: "clamp(18px,2.4vw,26px)", border: "none", minWidth: 0 }}
    >
      <div className="lbl">
        <Wallet />
        {t.dashboard.balance}
      </div>
      <div className="amt">
        <span className="qd-num">
          {d.balance_tnd.toLocaleString("fr-FR")}
          <small> TND</small>
        </span>
      </div>
      <div
        style={{
          display: "flex", alignItems: "flex-start", gap: 8, marginTop: 15, background: "rgba(255,255,255,.13)",
          padding: "10px 12px", borderRadius: 12, fontSize: 13, color: "#EAF2FC", position: "relative", zIndex: 2,
          lineHeight: 1.55,
        }}
      >
        <span style={{ display: "inline-flex", color: "#F3C24B", flexShrink: 0, marginTop: 1 }} aria-hidden="true">
          <Bulb style={{ width: 16, height: 16 }} />
        </span>
        <span style={{ minWidth: 0 }}>{d.paymentsEnabled ? t.dashboard.emptyNote : c.paymentsSoonBody}</span>
      </div>
    </div>
  );
}

// ── Bookings: who actually booked (name + phone + when) ──────────────────────
type BookingGroup = { classId: string; classTitle: string; classTs: number; items: DashboardBooking[] };

function statusLabel(s: DashboardBooking["status"], c: CopyDict): string {
  if (s === "paid") return c.paid;
  if (s === "attended") return c.attended;
  return c.reserved;
}

function BookingsPanel({ d }: { d: DashboardData }) {
  const { locale } = useLocale();
  const c = copy[locale];

  const groups: BookingGroup[] = useMemo(() => {
    const map = new Map<string, BookingGroup>();
    for (const b of d.bookings) {
      if (b.status === "cancelled") continue; // a freed seat isn't a student
      const g = map.get(b.classId);
      if (g) g.items.push(b);
      else map.set(b.classId, { classId: b.classId, classTitle: b.classTitle, classTs: b.classTs, items: [b] });
    }
    return [...map.values()].sort((a, b) => a.classTs - b.classTs);
  }, [d.bookings]);

  return (
    <div className="panel panel-pad" style={{ marginBottom: "clamp(14px,2vw,22px)" }}>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontFamily: "var(--fd)", fontSize: 16, fontWeight: 700 }}>{c.bookings}</h2>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{c.bookingsSub}</div>
      </div>

      {groups.length === 0 ? (
        <div
          style={{
            display: "flex", gap: 13, alignItems: "flex-start", padding: "16px 16px",
            background: "var(--cream)", border: "1px dashed var(--line)", borderRadius: 14,
          }}
        >
          <span style={{ color: "var(--blue)", display: "inline-flex", flexShrink: 0, marginTop: 2 }} aria-hidden="true">
            <Users />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{c.bookingsEmpty}</div>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>{c.bookingsEmptyBody}</div>
          </div>
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.classId} style={{ marginBottom: 16 }}>
            <div
              style={{
                display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                paddingBottom: 8, borderBottom: "1px solid var(--line)", marginBottom: 6,
              }}
            >
              <span style={{ color: "var(--blue)", display: "inline-flex", flexShrink: 0 }} aria-hidden="true">
                <Video style={{ width: 16, height: 16 }} />
              </span>
              <Link
                href={`/class/${g.classId}`}
                style={{
                  fontSize: 13.5, fontWeight: 700, color: "var(--ink)", flex: "1 1 140px", minWidth: 0,
                  overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                }}
              >
                {g.classTitle}
              </Link>
              <span
                style={{
                  marginInlineStart: "auto", fontSize: 13, fontWeight: 700, color: "var(--blue)",
                  background: "var(--blue50)", padding: "3px 9px", borderRadius: 999, flexShrink: 0,
                }}
              >
                {c.signedUp(g.items.length)}
              </span>
            </div>

            {g.items.map((b) => (
              <div
                key={b.bookingId}
                style={{
                  display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
                  padding: "11px 0", borderBottom: "1px solid var(--line)",
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    width: 38, height: 38, borderRadius: 12, flex: "none", display: "grid", placeItems: "center",
                    background: "var(--sand)", color: "var(--ink2)", fontFamily: "var(--fd)", fontSize: 14, fontWeight: 700,
                  }}
                >
                  {(b.studentName ?? "?").trim().charAt(0).toUpperCase() || "?"}
                </div>

                <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13.5, fontWeight: 600, overflow: "hidden",
                      whiteSpace: "nowrap", textOverflow: "ellipsis",
                    }}
                  >
                    {b.studentName?.trim() || c.anon}
                  </div>
                  <div
                    style={{
                      fontSize: 13, color: "var(--muted)", marginTop: 2,
                      display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap",
                    }}
                  >
                    <Clock style={{ width: 12, height: 12 }} />
                    {c.bookedAgo} {timeAgo(b.bookedAt, c)}
                    <span aria-hidden="true">·</span>
                    <span style={{ color: b.isFree ? "var(--green)" : "var(--ink2)", fontWeight: 700 }}>
                      {b.isFree ? c.free : statusLabel(b.status, c)}
                    </span>
                  </div>
                </div>

                {b.studentPhone ? (
                  <a
                    href={`tel:${b.studentPhone}`}
                    className="btn btn-ghost btn-sm qd-tel"
                    aria-label={`${c.call} ${b.studentName?.trim() || c.anon}`}
                    style={{ flex: "none", marginInlineStart: "auto", width: "auto", maxWidth: "100%" }}
                  >
                    <Phone style={{ width: 15, height: 15 }} />
                    {b.studentPhone}
                  </a>
                ) : (
                  <span
                    style={{
                      flex: "none", marginInlineStart: "auto", fontSize: 13,
                      color: "var(--muted)", fontStyle: "italic",
                    }}
                  >
                    {c.noPhone}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

// ── Real: tutor with a live storefront ──────────────────────────────────────
function RealDashboard({ d, steps }: { d: DashboardData; steps: Step[] }) {
  const { t, locale } = useLocale();
  const c = copy[locale];
  const stats = [
    { value: d.students, label: t.dashboard.stStudents, color: "var(--blue)" },
    { value: d.sessions, label: t.dashboard.stSessions, color: "var(--ink)" },
    {
      value: d.reviewCount > 0 ? d.rating : "—",
      label: t.dashboard.stRating,
      color: "var(--amber)",
    },
  ];

  return (
    <>
      <NextSteps steps={steps} c={c} />

      {/* Who booked — the tutor's core job-to-be-done */}
      <BookingsPanel d={d} />

      {/* Share link — the only way students find them */}
      {d.slug && <SharePanel slug={d.slug} c={c} />}

      {/* My classes */}
      {d.classes.length > 0 && (
        <div className="panel panel-pad" style={{ marginBottom: "clamp(14px,2vw,22px)" }}>
          <h2 style={{ fontFamily: "var(--fd)", fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{t.dashboard.myClasses}</h2>
          {d.classes.map((cl) => (
            <Link
              key={cl.id}
              href={`/class/${cl.id}`}
              style={{ display: "flex", gap: 12, alignItems: "center", padding: "13px 0", borderBottom: "1px solid var(--line)", color: "inherit" }}
            >
              <div aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", flex: "none", background: "var(--blue50)", color: "var(--blue)" }}>
                <Video />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cl.title}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{cl.day} {cl.month} · {cl.time}</div>
              </div>
              <div style={{ textAlign: "end", flex: "none", marginInlineStart: "auto" }}>
                <div className="qd-num" style={{ fontFamily: "var(--fd)", fontWeight: 700, color: "var(--ink)" }}>{cl.price_tnd} TND</div>
                <div className="qd-num" style={{ fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", marginTop: 2 }}>
                  <Users style={{ width: 12, height: 12 }} />{cl.seats_left}/{cl.seats}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* My packs */}
      {d.packs.length > 0 && (
        <div className="panel panel-pad" style={{ marginBottom: "clamp(14px,2vw,22px)" }}>
          <h2 style={{ fontFamily: "var(--fd)", fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{t.dashboard.myPacks}</h2>
          {d.packs.map((p) => (
            <div
              key={p.id}
              style={{ display: "flex", gap: 12, alignItems: "center", padding: "13px 0", borderBottom: "1px solid var(--line)" }}
            >
              <div aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", flex: "none", background: "var(--green50)", color: "var(--green)" }}>
                <Book />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</div>
                {p.meta && <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{p.meta}</div>}
              </div>
              <div className="qd-num" style={{ fontFamily: "var(--fd)", fontWeight: 700, color: "var(--ink)", flex: "none", marginInlineStart: "auto" }}>{p.price_tnd} TND</div>
            </div>
          ))}
        </div>
      )}

      {/* Money + numbers, below the work. Balance is the REAL 0 while payments are off. */}
      <div className="grid-2" style={{ marginBottom: "clamp(14px,2vw,22px)" }}>
        <BalanceCard d={d} />

        <div className="panel panel-pad" style={{ display: "flex", flexDirection: "column", gap: "clamp(10px,1.5vw,18px)", minWidth: 0 }}>
          <div style={{ fontFamily: "var(--fd)", fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px" }}>
            {t.dashboard.recent}
          </div>
          {stats.map((s) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", background: "var(--cream)", borderRadius: 13, border: "1px solid var(--line)" }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink2)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
              <b className="qd-num" style={{ fontFamily: "var(--fd)", fontSize: 22, color: s.color, flex: "none" }}>{s.value}</b>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: "clamp(14px,2vw,22px)" }}>
        <HowItWorks c={c} />
      </div>

      {/* Cash-out CTA — only when payouts can actually happen. No promise otherwise. */}
      {d.paymentsEnabled && (
        <div style={{ marginBottom: "clamp(14px,2vw,22px)" }}>
          <Link href="/dashboard/payout">
            <Button variant="green">
              <Wallet />
              {t.dashboard.cashout}
            </Button>
          </Link>
        </div>
      )}

      {/* Create CTAs — wrap instead of squashing on a 320px screen */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/dashboard/new-class" style={{ flex: "1 1 180px", minWidth: 0 }}>
          <Button variant={d.classes.length === 0 ? "primary" : "ghost"}>
            <Plus />
            {t.dashboard.newClass}
          </Button>
        </Link>
        <Link href="/dashboard/new-pack" style={{ flex: "1 1 180px", minWidth: 0 }}>
          <Button variant="ghost">
            <Plus />
            {t.dashboard.newPack}
          </Button>
        </Link>
      </div>
    </>
  );
}

// ── Real: signed in but no storefront yet ───────────────────────────────────
function RealNoStore({ steps }: { steps: Step[] }) {
  const { t, locale } = useLocale();
  const c = copy[locale];
  return (
    <>
      <div className="panel panel-pad" style={{ textAlign: "center", marginBottom: "clamp(14px,2vw,22px)" }}>
        <div aria-hidden="true" style={{ width: 60, height: 60, borderRadius: 18, background: "var(--blue50)", color: "var(--blue)", display: "grid", placeItems: "center", margin: "0 auto 13px" }}>
          <Share />
        </div>
        <h2 style={{ fontFamily: "var(--fd)", fontSize: 18, marginBottom: 7 }}>{t.dashboard.createStore}</h2>
        <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, marginBottom: 18, maxWidth: 440, marginInline: "auto" }}>
          {t.dashboard.createStoreBody}
        </p>
        <Link href="/onboarding" className="btn btn-primary" style={{ maxWidth: 300, marginInline: "auto" }}>
          <Plus />
          {c.st1cta}
        </Link>
      </div>
      <NextSteps steps={steps} c={c} />
      <HowItWorks c={c} />
    </>
  );
}

// ── Signed out / no session — never fabricate an earning view ───────────────
function SignedOut() {
  const { locale } = useLocale();
  const c = copy[locale];
  return (
    <div className="panel panel-pad" style={{ textAlign: "center", maxWidth: 560, marginInline: "auto" }}>
      <div aria-hidden="true" style={{ width: 60, height: 60, borderRadius: 18, background: "var(--blue50)", color: "var(--blue)", display: "grid", placeItems: "center", margin: "0 auto 13px" }}>
        <Shield />
      </div>
      <h2 style={{ fontFamily: "var(--fd)", fontSize: 18, marginBottom: 7 }}>{c.signedOutTitle}</h2>
      <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, marginBottom: 18 }}>{c.signedOutBody}</p>
      <Link href="/auth" className="btn btn-primary" style={{ maxWidth: 260, marginInline: "auto" }}>
        {c.signIn}
      </Link>
    </div>
  );
}

// ── Page header (greeting + actions + settings/notifications) ───────────────
function DashHeader({
  title,
  subtitle,
  actions,
  showTools,
}: {
  title: string;
  /* Optional: the signed-out state's whole message lives in the <SignedOut>
     panel, so repeating it here rendered the same sentence twice on the page. */
  subtitle?: string;
  actions?: React.ReactNode;
  showTools?: boolean;
}) {
  const { t } = useLocale();
  return (
    <div
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 14, marginBottom: "clamp(18px,2.5vw,28px)", flexWrap: "wrap",
      }}
    >
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <h1 style={{ fontFamily: "var(--fd)", fontSize: "clamp(20px,2.4vw,28px)", letterSpacing: "-.5px", lineHeight: 1.15 }}>
          {title}
        </h1>
        {subtitle ? <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3 }}>{subtitle}</div> : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", flex: "none" }}>
        {actions}
        {showTools && (
          <>
            <Link href="/account" className="iconbtn" aria-label={t.extra.settings}>
              <Gear />
            </Link>
            <NotifBell />
          </>
        )}
      </div>
    </div>
  );
}

/* The 4-step ladder, derived from real data only. */
function buildSteps(d: DashboardData | null, c: CopyDict): Step[] {
  const hasStore = !!d?.has_storefront;
  const status = d?.status ?? "draft";
  const hasClass = (d?.classes.length ?? 0) > 0;

  const verifDone = status === "verified";
  const verifWaiting = status === "pending";

  /* Publishing a class and being findable both require a VERIFIED profile
     (createClass enforces it server-side, and the storefront is unlisted until
     approval) — so steps 3 and 4 stay locked, without a button that would fail. */
  const steps: Step[] = [
    {
      key: "store",
      title: c.st1t,
      body: c.st1b,
      state: hasStore ? "done" : "current",
      cta: hasStore ? undefined : { label: c.st1cta, href: "/onboarding" },
    },
    {
      key: "verify",
      title: verifDone ? c.st2tDone : verifWaiting ? c.st2tPending : status === "rejected" ? c.st2tRejected : c.st2t,
      body: verifDone ? c.st2bDone : verifWaiting ? c.st2bPending : status === "rejected" ? c.st2bRejected : c.st2b,
      state: verifDone ? "done" : verifWaiting ? "waiting" : hasStore ? "current" : "todo",
      cta:
        verifDone || verifWaiting || !hasStore
          ? undefined
          : { label: status === "rejected" ? c.st2ctaRejected : c.st2cta, href: "/onboarding/verify" },
    },
    {
      key: "class",
      title: hasClass ? c.st3tDone : c.st3t,
      body: hasClass ? c.st3bDone : c.st3b,
      state: hasClass ? "done" : verifDone ? "current" : "todo",
      cta: hasClass || !verifDone ? undefined : { label: c.st3cta, href: "/dashboard/new-class" },
    },
    {
      key: "share",
      title: c.st4t,
      body: c.st4b,
      state: verifDone && d?.slug ? "current" : "todo",
      cta: verifDone && d?.slug ? { label: c.st4cta, href: "#share" } : undefined,
    },
  ];

  // Only the FIRST actionable step keeps its button: one dominant next action.
  let ctaGiven = false;
  for (const s of steps) {
    if (s.state !== "current") continue;
    if (ctaGiven) s.cta = undefined;
    else if (s.cta) ctaGiven = true;
  }
  return steps;
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { t, locale } = useLocale();
  const c = copy[locale];
  // undefined = loading · null = signed out / no session · object = real tutor data
  const [data, setData] = useState<DashboardData | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    getDashboard()
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, []);

  const firstName = (data?.name ?? "").trim().split(/\s+/)[0];
  const hasPublished = !!data && (data.classes.length > 0 || data.packs.length > 0);

  let header: React.ReactNode = null;
  let body: React.ReactNode;

  if (data === undefined) {
    body = (
      <div className="panel panel-pad" style={{ display: "grid", placeItems: "center", minHeight: 200 }}>
        <Spinner />
      </div>
    );
  } else if (data === null) {
    // No session (or no DB). Never render fabricated earnings — prompt sign-in.
    /* Title is the page name, not the panel's message: passing signedOutTitle +
       signedOutBody here printed the identical heading and paragraph twice, once
       as the page header and again inside <SignedOut>. */
    header = <DashHeader title={t.nav.dashboard} />;
    body = <SignedOut />;
  } else if (!data.has_storefront) {
    header = <DashHeader title={t.dashboard.createStore} subtitle={t.dashboard.createStoreBody} showTools />;
    body = <RealNoStore steps={buildSteps(data, c)} />;
  } else {
    header = (
      <DashHeader
        title={firstName ? t.dashboard.hi(firstName) : c.hello}
        subtitle={hasPublished ? t.dashboard.online : t.dashboard.createStoreBody}
        showTools
        actions={
          data.slug ? (
            <Link href={`/${data.slug}`} className="btn btn-ink btn-sm">
              <Eye />
              {t.dashboard.viewStore}
            </Link>
          ) : null
        }
      />
    );
    body = <RealDashboard d={data} steps={buildSteps(data, c)} />;
  }

  return (
    <SiteShell>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section className="web-section tight">
        <div className="container">
          <div className="app-layout">
            <DashboardSidebar />
            <div style={{ minWidth: 0 }}>
              {header}
              {body}
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
