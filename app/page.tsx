"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SiteShell } from "@/components/SiteShell";
import { useLocale } from "@/components/LocaleProvider";
import { Verified } from "@/components/ui";
import {
  Star,
  Shield,
  Users,
  Clock,
  Gift,
  Bolt,
  Forward,
  Search,
  Video,
  Wallet,
  Lock,
  Bank,
} from "@/components/icons";

/* =====================================================================
   STUDENT / PARENT LANDING — 9arini (قرّيني)
   Public home page at "/". Wrapped in <SiteShell> (header + footer come
   from there). All copy is self-contained below in `copy` (fr/ar) — we do
   NOT touch lib/i18n.ts. RTL is global (LocaleProvider sets dir), so the
   layout uses logical CSS props throughout and flips automatically.
   ===================================================================== */

const copy = {
  fr: {
    profBar: "Tu es prof ?",
    profBarCta: "Donne des cours sur 9arini →",

    heroBadge: "1ère séance offerte",
    h1a: "Trouve ton prof, du primaire au ",
    h1aHi: "Bac",
    h1aEnd: ".",
    h1b: "Des profs vérifiés.",
    h1c: "Payé en dinar.",
    heroSub:
      "Des avis d'élèves, un tarif clair. Teste sans engagement.",
    ctaPrimary: "Trouve ton prof",
    ctaGhost: "Voir tous les profs",
    heroMicro: "0 TND pour commencer · sans carte · annulation libre.",

    // hero animated cards
    heroSearch: "Prof de Maths · Bac",
    heroResults: "3 profs trouvés",
    cardFree: "1ère séance offerte",
    booked: "Réservé ✓ — séance gratuite",
    reviewsLabel: "avis",
    nextLabel: "Demain · 18:00",

    subjEyebrow: "Matières",
    subjSub: "Du primaire au Bac. À Tunis, Sfax, Sousse — ou en ligne, partout.",
    seeAll: "Voir tout",
    levelsLabel: "Niveaux",
    levels: ["Primaire", "Collège", "Lycée", "Bac"],

    howEyebrow: "Comment ça marche",
    howTitle: "Du premier clic au cours en direct.",
    steps: [
      { t: "Cherche ton prof", p: "Filtre par matière, niveau, ville ou en ligne." },
      { t: "Réserve ta 1ère séance gratuite", p: "0 TND, sans carte, sans engagement." },
      { t: "Assiste au cours en direct", p: "Depuis ton téléphone, où que tu sois." },
      { t: "Continue si tu aimes", p: "Tarif fixé par le prof, affiché avant de réserver." },
    ],

    trustEyebrow: "Pourquoi tu peux faire confiance",
    trustTitle: "Sérieux, sécurisé, 1ère séance offerte.",
    trust1Title: "Profs vérifiés",
    trust1Body:
      "Identité vérifiée, diplômes affichés. Lis les avis d'autres élèves avant de réserver.",
    reviewsHeading: "Ce que disent les élèves",
    reviews: [
      { who: "Yasmine, Bac Maths", text: "Explique calmement jusqu'à ce que tu comprennes. Top." },
      { who: "Le père de Malek", text: "Mon fils attend chaque séance. Sérieux et à l'heure." },
      { who: "Aziz, Bac Physique", text: "Mieux que les cours de groupe. Direct au but." },
    ],
    trust2Title: "Paie en sécurité",
    trust2Body:
      "Flouci, D17, Konnect. Ton paiement est retenu jusqu'à la fin du cours — si le prof ne vient pas, tu es remboursé.",
    trust3Title: "1ère séance offerte",
    trust3Sub: "pour la 1ère séance · sans carte · sans abonnement.",

    resultsEyebrow: "Résultats",
    resultsTitle: "Ils ont eu leur Bac avec un prof 9arini.",
    results: [
      {
        initials: "YA",
        name: "Yasmine",
        meta: "Bac Maths · Tunis",
        before: "14/20 en novembre",
        after: "17 au Bac",
      },
      {
        initials: "PM",
        name: "Le père de Malek",
        meta: "Bac Physique · Sfax",
        before: "trop juste à mi-année",
        after: "son Bac avec mention",
      },
      {
        initials: "RB",
        name: "Rania",
        meta: "Bac SVT · Sousse",
        before: "stressée, perdue",
        after: "admise du premier coup",
      },
    ],
    arrow: "→",
    statsSessions: "séances données",
    statsRating: "★ note moyenne",
    statsFree: "TND la 1ère séance",

    pricingEyebrow: "Tarifs",
    pricingTitle: "Combien ça coûte vraiment ?",
    priceFirstLabel: "Ta 1ère séance",
    priceFirstNote: "sans carte, sans engagement",
    priceSessionLabel: "Ensuite, la séance",
    priceSessionValue: "Fixé par le prof",
    priceSessionNote: "affiché avant de réserver",
    priceSubLabel: "Abonnement",
    priceSubValue: "Aucun",
    priceSubNote: "tu paies séance par séance",
    priceBadge: "Le plus choisi",

    finalTitle: "Ton prochain cours commence ce soir. 1ère séance offerte.",
    finalCta: "Trouve ton prof",
    finalUrgency: "Les créneaux se remplissent vite avant les examens.",
    finalReassure: "0 TND pour commencer · annulation libre · paie en dinar.",

    profOutroTitle: "Tu es prof, du primaire au Bac ?",
    profOutroBody:
      "Donne tes cours en direct, fixe ton tarif, encaisse en dinar.",
    profOutroCta: "Commence à enseigner →",
  },

  ar: {
    profBar: "إنتي أستاذ؟",
    profBarCta: "قرّي في 9arini ←",

    heroBadge: "أول حصة بلاش",
    h1a: "لقّي أستاذك، من الابتدائي للـ",
    h1aHi: "باك",
    h1aEnd: ".",
    h1b: "أساتذة متثبّت منهم.",
    h1c: "تخلّص بالدينار.",
    heroSub:
      "آراء تلامذة وتعريفة واضحة. جرّب بلا أي التزام.",
    ctaPrimary: "لقّي أستاذك",
    ctaGhost: "شوف الأساتذة الكل",
    heroMicro: "0 دينار باش تبدا · بلا كارت · تنجّم تلغي.",

    heroSearch: "أستاذ رياضيات · باك",
    heroResults: "3 أساتذة تلقاو",
    cardFree: "أول حصة بلاش",
    booked: "تحجزت ✓ — حصة بلاش",
    reviewsLabel: "رأي",
    nextLabel: "غدوة · 18:00",

    subjEyebrow: "المواد",
    subjSub: "من الابتدائي للباك. في تونس، صفاقس، سوسة — ولا أونلاين، فين ما كنت.",
    seeAll: "شوف الكل",
    levelsLabel: "المستويات",
    levels: ["ابتدائي", "إعدادي", "ثانوي", "باك"],

    howEyebrow: "كيفاش يخدم",
    howTitle: "من أول كليك للحصة المباشرة.",
    steps: [
      { t: "لوّج على أستاذك", p: "فلتري حسب المادة، المستوى، المدينة، ولا أونلاين." },
      { t: "احجز أول حصة بلاش", p: "0 دينار، من غير كارت، من غير التزام." },
      { t: "احضر الدرس مباشرة", p: "من تليفونك، فينما كنت." },
      { t: "كمّل كان عجبك", p: "الثمن يحدّدو الأستاذ، يبان قبل ما تحجز." },
    ],

    trustEyebrow: "علاش تنجّم تثق",
    trustTitle: "جدّية، أمان، وأول حصة بلاش.",
    trust1Title: "أساتذة متثبّت منهم",
    trust1Body:
      "الهوية متثبّتة، والشهائد تتعرض. اقرا آراء التلامذة قبل ما تحجز.",
    reviewsHeading: "شنوة يقولوا التلامذة",
    reviews: [
      { who: "ياسمين، باك رياضيات", text: "يشرح بالراحة حتى تفهم. أحسن أستاذ." },
      { who: "بوه نتاع مالك", text: "ولدي يستنّى في كل حصة. جدّي وفي الوقت." },
      { who: "عزيز، باك فيزياء", text: "خير من دروس المجموعات. مباشرة للهدف." },
    ],
    trust2Title: "تخلّص بأمان",
    trust2Body:
      "فلوسي، D17، كونيكت. الخلاص يتحجز حتى تكمّل الحصة — كان الأستاذ ما جاش، فلوسك ترجعلك.",
    trust3Title: "أول حصة بلاش",
    trust3Sub: "للحصة الأولى · من غير كارت · من غير اشتراك.",

    resultsEyebrow: "النتائج",
    resultsTitle: "نجحوا في الباك مع أستاذ من 9arini.",
    results: [
      {
        initials: "YA",
        name: "ياسمين",
        meta: "باك رياضيات · تونس",
        before: "14/20 في نوفمبر",
        after: "17 في الباك",
      },
      {
        initials: "PM",
        name: "بوه نتاع مالك",
        meta: "باك فيزياء · صفاقس",
        before: "ضعيف في نص العام",
        after: "نجح بميزة",
      },
      {
        initials: "RB",
        name: "رانية",
        meta: "باك علوم · سوسة",
        before: "متوترة وضايعة",
        after: "نجحت من أول مرة",
      },
    ],
    arrow: "←",
    statsSessions: "حصة تعطات",
    statsRating: "★ معدّل التقييم",
    statsFree: "دينار أول حصة",

    pricingEyebrow: "الأثمنة",
    pricingTitle: "قدّاش تكلّف بالحق؟",
    priceFirstLabel: "أول حصة",
    priceFirstNote: "من غير كارت، من غير التزام",
    priceSessionLabel: "بعدها، الحصة",
    priceSessionValue: "يحدّدو الأستاذ",
    priceSessionNote: "يبان قبل ما تحجز",
    priceSubLabel: "اشتراك",
    priceSubValue: "والو",
    priceSubNote: "تخلّص حصة بحصة",
    priceBadge: "الأكثر اختيار",

    finalTitle: "درسك الجاي يبدا الليلة. أول حصة بلاش.",
    finalCta: "لقّي أستاذك",
    finalUrgency: "الأوقات يتعمّروا فيسع قبل الامتحانات.",
    finalReassure: "0 دينار باش تبدا · تنجّم تلغي · تخلّص بالدينار.",

    profOutroTitle: "إنتي أستاذ، من الابتدائي للباك؟",
    profOutroBody: "قرّي مباشرة، حدّد ثمنك، واقبض بكل ساهلة.",
    profOutroCta: "ابدا تقرّي ←",
  },
} as const;

// Subject chips → /explore?subject=<slug>. Labels per locale, slug shared.
const SUBJECTS: { slug: string; fr: string; ar: string }[] = [
  { slug: "maths", fr: "Maths", ar: "رياضيات" },
  { slug: "physique", fr: "Physique", ar: "فيزياء" },
  { slug: "svt", fr: "SVT", ar: "علوم" },
  { slug: "francais", fr: "Français", ar: "فرنسية" },
  { slug: "philo", fr: "Philo", ar: "فلسفة" },
  { slug: "arabe", fr: "Arabe", ar: "عربية" },
  { slug: "histoire-geo", fr: "Histoire-Géo", ar: "تاريخ-جغرافيا" },
  { slug: "anglais", fr: "Anglais", ar: "إنڨليزية" },
  { slug: "technique", fr: "Technique", ar: "تقني" },
];

// Mock tutor result cards for the hero composition.
const HERO_CARDS = [
  { initials: "YK", name: "Yassine K.", fr: "Maths · Bac", ar: "رياضيات · باك", rating: "4.9", price: "20" },
  { initials: "ST", name: "Sonia T.", fr: "Physique · Bac", ar: "فيزياء · باك", rating: "4.8", price: "18" },
  { initials: "RB", name: "Rania B.", fr: "SVT · Bac", ar: "علوم · باك", rating: "4.9", price: "22" },
];

/* Hook: reveal-on-scroll. Adds `is-in` to opted-in elements as they enter
   the viewport (staggered via CSS var --d). Fully disabled — and content
   shown immediately — under prefers-reduced-motion. Cleans up on unmount. */
function useReveal() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(".lp-rv"));
    if (reduce || !("IntersectionObserver" in window)) {
      nodes.forEach((n) => n.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            obs.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);
}

export default function HomePage() {
  const { locale } = useLocale();
  const c = copy[locale];
  const isAr = locale === "ar";

  // Reveal-on-scroll for all sections below the hero.
  useReveal();

  // Hero choreography: search "resolves" → cards settle → booked confirm.
  const [booked, setBooked] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setBooked(true); // static composition already shows the confirmation
      return;
    }
    timers.current.push(window.setTimeout(() => setBooked(true), 2100));
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
  }, []);

  return (
    <SiteShell>
      {/* Scoped styles: keyframes + reveal + reduced-motion fallback (prefix lp-) */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* ── rhythm ─────────────────────────────────────────────── */
        .lp-sec{padding-block:clamp(40px,6.5vw,88px)}
        .lp-sec.lp-tight{padding-block:clamp(22px,3.5vw,40px)}
        .lp-head{max-width:680px}
        .lp-h2{font-family:var(--fd);font-size:clamp(25px,3.7vw,40px);line-height:1.1;letter-spacing:-1.1px}
        .lp-eyebrow{display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:12px;
          letter-spacing:.7px;text-transform:uppercase;color:var(--blue);
          background:var(--blue50);padding:6px 12px;border-radius:999px}

        /* ── prof bar ───────────────────────────────────────────── */
        .lp-prof-bar{background:var(--ink);color:#fff}
        .lp-prof-bar .container{
          display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;
          padding-block:9px;font-size:13px;font-weight:600;
        }
        .lp-prof-bar a{color:var(--amber);font-weight:700}
        .lp-prof-bar a:hover{text-decoration:underline}

        /* ── hero shell ─────────────────────────────────────────── */
        .lp-hero{position:relative;overflow:hidden;isolation:isolate}
        .lp-hero-wash{position:absolute;inset:0;z-index:-1;pointer-events:none;
          background:
            radial-gradient(720px 420px at 8% 0%,rgba(224,133,46,.10),transparent 60%),
            radial-gradient(820px 520px at 100% 10%,rgba(14,90,166,.12),transparent 58%);
          animation:lp-wash 14s ease-in-out infinite alternate}
        .lp-hero-eyebrow{align-self:start}

        .lp-h1 .lp-line{display:block}
        .lp-h1 .lp-w{display:inline-block;opacity:0;transform:translateY(14px);
          animation:lp-rise .6s cubic-bezier(.2,.7,.2,1) both}

        .lp-cta-primary{position:relative;overflow:hidden}
        .lp-cta-primary svg{transition:transform .18s ease}
        .lp-cta-primary:hover{transform:translateY(-2px);box-shadow:0 20px 32px -14px rgba(224,133,46,.95)}
        .lp-cta-primary:hover svg{transform:translateX(3px)}
        html[dir=rtl] .lp-cta-primary:hover svg{transform:translateX(-3px)}
        .lp-cta-ghost{transition:.18s;border-color:var(--ink)}
        .lp-cta-ghost:hover{transform:translateY(-2px);border-color:var(--blue);color:var(--blue);
          box-shadow:var(--sh-s);background:rgba(255,255,255,.6)}

        .lp-pay-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .lp-pay-chip{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;
          color:var(--ink2);background:var(--paper);border:1px solid var(--line);
          padding:6px 11px;border-radius:999px}
        .lp-pay-dot{width:6px;height:6px;border-radius:50%;background:var(--green)}

        /* ── hero composition ───────────────────────────────────── */
        .lp-stage{position:relative;min-height:clamp(380px,46vw,460px);
          display:flex;align-items:center;justify-content:center}
        .lp-stage-glow{position:absolute;inset:15% 15%;border-radius:var(--r-xl);
          background:linear-gradient(158deg,var(--blue),#082F54);opacity:.10;
          filter:blur(2px);z-index:0;animation:lp-float 7s ease-in-out infinite}
        .lp-stage-zellige{position:absolute;inset:6% 4%;border-radius:var(--r-xl);z-index:0;opacity:.5}

        .lp-panel{position:relative;z-index:1;width:100%;max-width:380px;
          background:rgba(255,255,255,.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
          border:1px solid var(--line);border-radius:var(--r-l);box-shadow:var(--sh-l);
          padding:16px;animation:lp-float 8s ease-in-out infinite}

        /* search cue */
        .lp-search{display:flex;align-items:center;gap:10px;background:var(--paper);
          border:1.5px solid var(--lineCool);border-radius:14px;padding:11px 13px;
          box-shadow:var(--sh-s);position:relative}
        .lp-search.is-go{border-color:var(--blue)}
        .lp-search svg{color:var(--blue);width:18px;height:18px;flex:none}
        .lp-search-txt{font-size:13.5px;font-weight:600;color:var(--ink);white-space:nowrap;
          overflow:hidden;border-inline-end:2px solid transparent;font-family:var(--fb)}
        html[dir=rtl] .lp-search-txt{font-family:var(--fa)}
        .lp-search-txt.is-type{width:0;animation:lp-type 1.1s steps(20,end) .3s forwards,
          lp-caret .7s step-end 0s 6}
        .lp-search-go{margin-inline-start:auto;flex:none;width:30px;height:30px;border-radius:9px;
          background:var(--ochre);color:#fff;display:grid;place-items:center;
          opacity:0;transform:scale(.6);animation:lp-pop .4s cubic-bezier(.2,.7,.2,1) 1.5s forwards}
        .lp-search-go svg{color:#fff;width:15px;height:15px}

        .lp-resmeta{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;
          margin-block:12px 9px;opacity:0;animation:lp-fade .4s ease 1.65s forwards}
        .lp-resleft{display:inline-flex;align-items:center;gap:10px}
        .lp-resmeta b{font-family:var(--fd);font-size:12.5px;color:var(--ink2)}
        .lp-resmeta .lp-live{display:inline-flex;align-items:center;gap:5px;font-size:11px;
          font-weight:700;color:var(--green)}
        .lp-resmeta .lp-live i{width:6px;height:6px;border-radius:50%;background:var(--green);
          font-style:normal;animation:lp-ping 1.6s ease-in-out infinite}

        .lp-cards{position:relative;display:flex;flex-direction:column;gap:9px}
        .lp-card{display:flex;gap:12px;align-items:center;background:var(--paper);
          border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--sh-s);
          padding:12px 13px;will-change:transform,opacity;opacity:0}
        .lp-card-0{animation:lp-rise .55s cubic-bezier(.2,.7,.2,1) 1.7s both}
        .lp-card-1{animation:lp-rise .55s cubic-bezier(.2,.7,.2,1) 1.84s both}
        .lp-card-2{animation:lp-rise .55s cubic-bezier(.2,.7,.2,1) 1.98s both}
        .lp-card-name{display:flex;align-items:center;gap:6px;font-family:var(--fd);
          font-weight:700;font-size:14.5px;margin-bottom:2px}
        .lp-card-sub{font-size:12px;color:var(--muted);margin-bottom:6px}
        .lp-card-price{font-family:var(--fd);font-weight:700;letter-spacing:-.3px;font-size:17px}

        .lp-badge{flex:none;
          display:inline-flex;align-items:center;gap:6px;background:var(--green);color:#fff;
          font-size:11px;font-weight:700;padding:6px 11px;border-radius:999px;
          box-shadow:0 10px 20px -12px rgba(27,156,111,.9);
          animation:lp-pop .5s cubic-bezier(.2,.7,.2,1) 2.2s both}

        .lp-confirm{position:absolute;z-index:5;inset-inline-start:50%;bottom:-18px;
          transform:translateX(-50%);display:inline-flex;align-items:center;gap:9px;
          background:var(--paper);border:1.5px solid var(--green);color:#13724f;
          font-size:13px;font-weight:700;padding:10px 15px;border-radius:14px;
          box-shadow:var(--sh);white-space:nowrap;
          animation:lp-confirm-in .55s cubic-bezier(.2,.7,.2,1) both}
        html[dir=rtl] .lp-confirm{transform:translateX(50%)}
        .lp-confirm-ring{width:20px;height:20px;flex:none}
        .lp-confirm-ring circle{fill:none;stroke:var(--green);stroke-width:2.4;
          stroke-dasharray:58;stroke-dashoffset:58;
          animation:lp-draw .5s ease-out .15s forwards}
        .lp-confirm-ring path{fill:none;stroke:var(--green);stroke-width:2.6;
          stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:18;stroke-dashoffset:18;
          animation:lp-draw .35s ease-out .5s forwards}

        /* ── keyframes ──────────────────────────────────────────── */
        @keyframes lp-rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
        @keyframes lp-fade{from{opacity:0}to{opacity:1}}
        @keyframes lp-pop{0%{opacity:0;transform:scale(.7)}60%{opacity:1;transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}
        @keyframes lp-confirm-in{0%{opacity:0;transform:translateX(-50%) translateY(10px) scale(.85)}60%{transform:translateX(-50%) translateY(0) scale(1.04)}100%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
        @keyframes lp-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes lp-wash{0%{transform:translate3d(0,0,0)}100%{transform:translate3d(0,-12px,0)}}
        @keyframes lp-type{from{width:0}to{width:100%}}
        @keyframes lp-caret{0%,100%{border-color:transparent}50%{border-color:var(--blue)}}
        @keyframes lp-draw{to{stroke-dashoffset:0}}
        @keyframes lp-ping{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}

        /* ── subject chips ──────────────────────────────────────── */
        .lp-chips-wrap{position:relative}
        .lp-chips-row{display:flex;gap:10px;overflow-x:auto;padding:4px 2px 8px;
          -webkit-overflow-scrolling:touch;scrollbar-width:none}
        .lp-chips-row::-webkit-scrollbar{display:none}
        .lp-chip{flex:none;display:inline-flex;align-items:center;gap:7px;
          background:var(--paper);border:1.5px solid var(--line);border-radius:999px;
          padding:11px 17px;font-weight:700;font-size:14px;color:var(--ink);
          white-space:nowrap;transition:.16s;box-shadow:var(--sh-s)}
        .lp-chip:hover{border-color:var(--blue);color:var(--blue);transform:translateY(-2px);
          box-shadow:0 10px 22px -12px rgba(14,90,166,.5)}
        .lp-chip:active{transform:translateY(0)}
        .lp-chip-all{background:var(--blue);border-color:transparent;color:#fff;
          box-shadow:0 12px 22px -12px rgba(14,90,166,.8)}
        .lp-chip-all:hover{background:var(--blue700);color:#fff;border-color:transparent}
        .lp-fade-edge{position:absolute;top:0;bottom:8px;width:34px;z-index:2;pointer-events:none}
        .lp-fade-s{inset-inline-start:0;background:linear-gradient(to right,var(--cream),transparent)}
        .lp-fade-e{inset-inline-end:0;background:linear-gradient(to left,var(--cream),transparent)}
        html[dir=rtl] .lp-fade-s{background:linear-gradient(to left,var(--cream),transparent)}
        html[dir=rtl] .lp-fade-e{background:linear-gradient(to right,var(--cream),transparent)}
        @media (min-width:760px){
          .lp-chips-row{flex-wrap:wrap;overflow-x:visible}
          .lp-fade-edge{display:none}
        }

        /* ── stepper ────────────────────────────────────────────── */
        .lp-steps{position:relative;display:grid;gap:clamp(14px,2vw,22px);
          grid-template-columns:1fr}
        @media (min-width:640px){.lp-steps{grid-template-columns:1fr 1fr}}
        @media (min-width:1000px){.lp-steps{grid-template-columns:repeat(4,1fr)}}
        .lp-step{position:relative;background:var(--paper);border:1px solid var(--line);
          border-radius:var(--r-l);box-shadow:var(--sh-s);padding:clamp(18px,2.2vw,24px);
          transition:.2s}
        .lp-step:hover{transform:translateY(-3px);box-shadow:var(--sh)}
        .lp-step-num{width:42px;height:42px;border-radius:13px;flex:none;display:grid;
          place-items:center;font-family:var(--fd);font-weight:700;font-size:18px;
          background:linear-gradient(150deg,var(--blue),var(--blue700));color:#fff;
          box-shadow:0 8px 18px -10px rgba(14,90,166,.9);margin-bottom:14px}
        .lp-step-t{font-family:var(--fd);font-weight:700;font-size:16.5px;margin-bottom:6px}
        .lp-step-p{font-size:14px;color:var(--ink2);line-height:1.6}
        /* connecting line behind nodes on wide screens */
        .lp-step::after{content:"";position:absolute;top:calc(clamp(18px,2.2vw,24px) + 21px);
          inset-inline-start:calc(100% + 1px);width:calc(clamp(14px,2vw,22px) - 0px);height:2px;
          background:repeating-linear-gradient(to right,var(--blue) 0 6px,transparent 6px 11px);
          opacity:.4;display:none}
        html[dir=rtl] .lp-step::after{background:repeating-linear-gradient(to left,var(--blue) 0 6px,transparent 6px 11px)}
        @media (min-width:1000px){
          .lp-step::after{display:block}
          .lp-step:last-child::after{display:none}
        }

        /* ── trust cards ────────────────────────────────────────── */
        .lp-tcard{position:relative;background:var(--paper);border:1px solid var(--line);
          border-radius:var(--r-l);box-shadow:var(--sh-s);padding:clamp(18px,2.4vw,26px);
          display:flex;flex-direction:column;gap:14px;overflow:hidden;transition:.2s}
        .lp-tcard:hover{transform:translateY(-3px);box-shadow:var(--sh)}
        .lp-tcard::before{content:"";position:absolute;inset-block-start:0;inset-inline:0;
          height:3px;background:var(--accent,var(--blue))}
        .lp-tico{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;flex:none}
        .lp-tt{font-family:var(--fd);font-weight:700;font-size:17px;margin-bottom:6px}
        .lp-tp{font-size:14px;color:var(--ink2);line-height:1.6}
        .lp-review{background:var(--cream);border:1px solid var(--line);border-radius:14px;
          padding:11px 13px;transition:.15s}
        .lp-review:hover{border-color:var(--blue);box-shadow:var(--sh-s)}
        .lp-bignum{font-family:var(--fd);font-weight:700;letter-spacing:-2px;line-height:1;
          font-size:clamp(52px,8vw,76px);color:var(--green)}

        /* ── results ────────────────────────────────────────────── */
        .lp-rcard{background:var(--paper);border:1px solid var(--line);border-radius:var(--r-l);
          box-shadow:var(--sh-s);padding:20px;display:flex;flex-direction:column;gap:14px;
          transition:.2s}
        .lp-rcard:hover{transform:translateY(-3px);box-shadow:var(--sh)}
        .lp-outcome{display:flex;align-items:center;gap:10px;background:var(--green50);
          border-radius:14px;padding:12px 14px}
        .lp-outcome-badge{margin-inline-start:auto;flex:none;background:var(--green);color:#fff;
          font-family:var(--fd);font-weight:700;font-size:12.5px;padding:4px 10px;border-radius:999px}

        .lp-stats{display:grid;grid-template-columns:1fr;gap:clamp(14px,3vw,28px);
          background:linear-gradient(158deg,var(--ink),#0a1626);border-radius:var(--r-xl);
          padding:clamp(24px,4vw,40px) clamp(20px,4vw,40px);color:#fff;text-align:center}
        @media (min-width:640px){.lp-stats{grid-template-columns:repeat(3,1fr)}}
        .lp-stat{position:relative}
        .lp-stat + .lp-stat::before{content:"";position:absolute;inset-inline-start:0;top:14%;
          height:72%;width:1px;background:rgba(255,255,255,.12);display:none}
        @media (min-width:640px){.lp-stat + .lp-stat::before{display:block}}
        .lp-stat b{font-family:var(--fd);font-size:clamp(30px,4.4vw,48px);font-weight:700;
          letter-spacing:-1.4px;display:flex;align-items:center;justify-content:center;gap:8px;
          line-height:1}
        .lp-stat span{font-size:13px;color:#B9C6D6;margin-top:8px;display:block}

        /* ── pricing ────────────────────────────────────────────── */
        .lp-price-grid{display:grid;gap:16px;grid-template-columns:1fr}
        @media (min-width:760px){.lp-price-grid{grid-template-columns:repeat(3,1fr);align-items:stretch}}
        .lp-pcard{position:relative;background:var(--paper);border:1px solid var(--line);
          border-radius:var(--r-l);box-shadow:var(--sh-s);padding:clamp(18px,2.4vw,26px);
          display:flex;flex-direction:column;gap:7px;transition:.2s}
        .lp-pcard:hover{transform:translateY(-3px);box-shadow:var(--sh)}
        .lp-pcard.lp-pcard-hi{border-color:var(--green);box-shadow:0 18px 40px -22px rgba(27,156,111,.55)}
        .lp-plabel{font-size:13px;font-weight:700;color:var(--muted)}
        .lp-pnum{font-family:var(--fd);font-weight:700;font-size:clamp(34px,4vw,44px);
          letter-spacing:-1.6px;line-height:1}
        .lp-pnum small{font-size:17px;color:var(--muted);font-weight:600;letter-spacing:0}
        .lp-pnote{font-size:13px;color:var(--muted);line-height:1.5}
        .lp-pbadge{position:absolute;inset-inline-end:14px;top:-11px;background:var(--green);
          color:#fff;font-size:11px;font-weight:700;padding:5px 11px;border-radius:999px;
          box-shadow:0 10px 20px -12px rgba(27,156,111,.9)}

        /* ── final CTA ──────────────────────────────────────────── */
        .lp-final{position:relative;overflow:hidden;isolation:isolate}
        .lp-final-glow{position:absolute;z-index:0;pointer-events:none;width:60vw;height:60vw;
          max-width:560px;max-height:560px;border-radius:50%;
          background:radial-gradient(circle,rgba(243,194,75,.22),transparent 65%);
          inset-inline-start:-10%;top:-30%;animation:lp-float 9s ease-in-out infinite}
        .lp-final-inner{position:relative;z-index:1;padding-block:clamp(44px,7vw,84px);
          display:flex;flex-direction:column;align-items:center;text-align:center;gap:20px}
        .lp-final-cta{font-size:16px}

        /* ── teacher outro ──────────────────────────────────────── */
        .lp-outro{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;
          gap:18px;background:linear-gradient(135deg,var(--paper),var(--blue50));
          border:1px solid var(--line);border-radius:var(--r-l);box-shadow:var(--sh-s);
          padding:clamp(18px,2.6vw,28px)}

        /* ── reveal-on-scroll ───────────────────────────────────── */
        .lp-rv{opacity:0;transform:translateY(22px);
          transition:opacity .6s cubic-bezier(.2,.7,.2,1),transform .6s cubic-bezier(.2,.7,.2,1);
          transition-delay:var(--d,0ms)}
        .lp-rv.is-in{opacity:1;transform:none}

        /* ── reduced motion: kill all motion, show final state ──── */
        @media (prefers-reduced-motion: reduce){
          .lp-hero-wash,.lp-stage-glow,.lp-stage-zellige,.lp-panel,
          .lp-h1 .lp-w,.lp-search-go,.lp-resmeta,.lp-card-0,.lp-card-1,.lp-card-2,
          .lp-badge,.lp-confirm,.lp-confirm-ring circle,.lp-confirm-ring path,
          .lp-search-txt.is-type,.lp-resmeta .lp-live i,.lp-final-glow{
            animation:none !important}
          .lp-h1 .lp-w,.lp-resmeta,.lp-card,.lp-search-go{opacity:1 !important;transform:none !important}
          .lp-search-txt.is-type{width:100% !important}
          .lp-search-go{opacity:1 !important;transform:none !important}
          .lp-badge{opacity:1 !important;transform:none !important}
          .lp-confirm{opacity:1 !important;transform:translateX(-50%) !important}
          html[dir=rtl] .lp-confirm{transform:translateX(50%) !important}
          .lp-confirm-ring circle{stroke-dashoffset:0 !important}
          .lp-confirm-ring path{stroke-dashoffset:0 !important}
          .lp-rv{opacity:1 !important;transform:none !important;transition:none !important}
        }
      `}} />

      {/* ── CROSS-LINK: slim "Tu es prof ?" bar above the hero ─────────── */}
      <div className="lp-prof-bar">
        <div className="container">
          <span>{c.profBar}</span>
          <Link href="/pour-les-profs">{c.profBarCta}</Link>
        </div>
      </div>

      {/* ── 1) HERO ───────────────────────────────────────────────────── */}
      <section className="web-section lp-hero" style={{ paddingBlock: "clamp(32px,5.5vw,80px)" }}>
        <div className="lp-hero-wash" aria-hidden="true" />
        <div className="container">
          <div className="web-hero">
            {/* LEFT — headline + CTAs */}
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              <span className="chip chip-free lp-hero-eyebrow">
                <Gift style={{ width: 14, height: 14 }} />
                {c.heroBadge}
              </span>

              <h1 className="web-h1 lp-h1">
                <span className="lp-line">
                  <span className="lp-w" style={{ animationDelay: "0.05s" }}>{c.h1a}<span style={{ color: "var(--ochre)" }}>{c.h1aHi}</span>{c.h1aEnd}</span>
                </span>
                <span className="lp-line">
                  <span className="lp-w" style={{ animationDelay: "0.18s", color: "var(--ochre)" }}>{c.h1b}</span>
                </span>
                <span className="lp-line">
                  <span className="lp-w" style={{ animationDelay: "0.31s", color: "var(--blue)" }}>{c.h1c}</span>
                </span>
              </h1>

              <p className="web-lead" style={{ maxWidth: 520 }}>
                {c.heroSub}
              </p>

              <div className="cluster" style={{ gap: 14 }}>
                <Link
                  href="/explore"
                  className="btn btn-primary lp-cta-primary"
                  style={{ width: "auto", paddingInline: 26, paddingBlock: 15, fontSize: 15.5 }}
                >
                  {c.ctaPrimary} <Forward style={{ width: 18, height: 18 }} />
                </Link>
                <Link
                  href="/explore"
                  className="btn btn-ghost lp-cta-ghost"
                  style={{ width: "auto", paddingInline: 24, paddingBlock: 15, fontSize: 15.5 }}
                >
                  {c.ctaGhost}
                </Link>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
                  {c.heroMicro}
                </p>
                <div className="lp-pay-row" aria-hidden="true">
                  <span className="lp-pay-chip"><span className="lp-pay-dot" />Flouci</span>
                  <span className="lp-pay-chip"><span className="lp-pay-dot" />D17</span>
                  <span className="lp-pay-chip"><span className="lp-pay-dot" />Konnect</span>
                </div>
              </div>
            </div>

            {/* RIGHT — animated search → results → booked composition */}
            <div
              className="lp-stage "
              role="img"
              aria-label={
                isAr
                  ? "بحث عن أستاذ رياضيات للباكالوريا يظهر نتائج أساتذة متثبّت منهم مع تقييمات وأثمنة بالدينار وأول حصة بلاش، ثم تأكيد الحجز"
                  : "Recherche d'un prof de Maths au Bac affichant des résultats de profs vérifiés avec notes, prix en dinar et 1ère séance offerte, puis une confirmation de réservation"
              }
            >
              <div className="lp-stage-glow" aria-hidden="true" />
              <div className="zellige lp-stage-zellige" aria-hidden="true" />

              <div className="lp-panel" aria-hidden="true">
                {/* search cue */}
                <div className="lp-search is-go">
                  <Search />
                  <span className="lp-search-txt is-type">{c.heroSearch}</span>
                  <span className="lp-search-go">
                    <Forward style={{ width: 15, height: 15 }} />
                  </span>
                </div>

                {/* results meta */}
                <div className="lp-resmeta">
                  <span className="lp-resleft">
                    <b>{c.heroResults}</b>
                    <span className="lp-live"><i />{isAr ? "مباشر" : "en direct"}</span>
                  </span>
                  <span className="lp-badge">
                    <Gift style={{ width: 13, height: 13 }} />
                    {c.cardFree}
                  </span>
                </div>

                {/* result cards */}
                <div className="lp-cards">
                  {HERO_CARDS.map((card, i) => (
                    <div key={card.initials} className={`lp-card lp-card-${i}`}>
                      <div
                        className="avatar sq"
                        style={{ width: 50, height: 50, fontSize: 19, borderRadius: 14, flex: "none" }}
                      >
                        {card.initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="lp-card-name">
                          {card.name}
                          <Verified />
                        </div>
                        <div className="lp-card-sub">{isAr ? card.ar : card.fr}</div>
                        <div className="metaline">
                          <span>
                            <Star style={{ color: "var(--amber)" }} />
                            <b style={{ fontFamily: "var(--fd)", color: "var(--ink)" }}>{card.rating}</b>
                          </span>
                          <span>
                            <Clock />
                            {c.nextLabel}
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: "end", flex: "none" }}>
                        <div className="lp-card-price">
                          {card.price} <span style={{ fontSize: 12, color: "var(--muted)" }}>TND</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {booked && (
                    <span className="lp-confirm">
                      <svg className="lp-confirm-ring" viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="12" r="9.2" />
                        <path d="M7.5 12.4l3 3 6-6.4" />
                      </svg>
                      {c.booked}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2) SUBJECT CHIPS ──────────────────────────────────────────── */}
      <section
        className="lp-sec lp-tight"
        style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: "var(--cream)" }}
      >
        <div className="container">
          <p className="lp-eyebrow lp-rv" style={{ marginBottom: 16 }}>
            {c.subjEyebrow}
          </p>
          <div className="lp-chips-wrap lp-rv" style={{ ["--d" as string]: "60ms" }}>
            <div className="lp-fade-edge lp-fade-s" aria-hidden="true" />
            <div className="lp-fade-edge lp-fade-e" aria-hidden="true" />
            <div className="lp-chips-row" role="list">
              {SUBJECTS.map((s) => (
                <Link
                  key={s.slug}
                  href={`/explore?subject=${s.slug}`}
                  className="lp-chip"
                  role="listitem"
                >
                  {isAr ? s.ar : s.fr}
                </Link>
              ))}
              <Link href="/explore" className="lp-chip lp-chip-all" role="listitem">
                {c.seeAll} {c.arrow}
              </Link>
            </div>
          </div>
          <div
            className="lp-rv"
            style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 16, ["--d" as string]: "100ms" }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", color: "var(--muted)" }}>
              {c.levelsLabel}
            </span>
            {c.levels.map((lvl, i) => {
              const isBac = i === c.levels.length - 1;
              return (
                <span
                  key={lvl}
                  className="chip"
                  style={
                    isBac
                      ? { background: "var(--blue)", color: "#fff", fontWeight: 700 }
                      : { background: "var(--paper)", border: "1px solid var(--line)", color: "var(--ink2)", fontWeight: 700 }
                  }
                >
                  {lvl}
                </span>
              );
            })}
          </div>
          <p className="muted lp-rv" style={{ fontSize: 13.5, marginTop: 14, ["--d" as string]: "120ms" }}>
            {c.subjSub}
          </p>
        </div>
      </section>

      {/* ── 3) HOW IT WORKS ───────────────────────────────────────────── */}
      <section className="lp-sec">
        <div className="container">
          <div className="lp-head" style={{ marginBottom: 30 }}>
            <p className="lp-eyebrow lp-rv" style={{ marginBottom: 14 }}>
              {c.howEyebrow}
            </p>
            <h2 className="lp-h2 lp-rv" style={{ ["--d" as string]: "60ms" }}>
              {c.howTitle}
            </h2>
          </div>

          <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4 lg:gap-0">
            {/* connecting line behind nodes on desktop */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-[12.5%] top-[42px] hidden h-px bg-gradient-to-r from-transparent via-blue/30 to-transparent lg:block"
            />
            {[Search, Gift, Video, Wallet].map((Icon, i) => {
              const step = c.steps[i];
              return (
                <div
                  key={i}
                  className="lp-rv h-full lg:px-3"
                  style={{ ["--d" as string]: `${i * 90}ms` }}
                >
                  <div className="group relative flex h-full flex-col rounded-[var(--r-l)] border border-solid border-line bg-paper p-5 shadow-[var(--sh-s)] transition hover:-translate-y-1 hover:shadow-[var(--sh)] sm:p-6">
                    <div className="mb-4 flex items-center gap-3">
                      <div
                        aria-hidden="true"
                        className="grid h-11 w-11 flex-none place-items-center rounded-[14px] bg-gradient-to-br from-blue to-blue700 font-display text-[18px] font-bold leading-none text-white shadow-[0_8px_18px_-10px_rgba(14,90,166,.9)]"
                      >
                        {i + 1}
                      </div>
                      <span
                        aria-hidden="true"
                        className="grid h-9 w-9 flex-none place-items-center rounded-[11px] bg-blue50 text-blue"
                      >
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                    </div>
                    <h3 className="mb-1.5 font-display text-[16.5px] font-bold text-ink">{step.t}</h3>
                    <p className="text-[14px] leading-relaxed text-ink2">{step.p}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 4) TRUST BUILDERS ─────────────────────────────────────────── */}
      <section
        className="lp-sec"
        style={{ background: "rgba(255,255,255,.55)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}
      >
        <div className="container">
          <div className="lp-head" style={{ marginBottom: 30 }}>
            <p className="lp-eyebrow lp-rv" style={{ marginBottom: 14 }}>
              {c.trustEyebrow}
            </p>
            <h2 className="lp-h2 lp-rv" style={{ ["--d" as string]: "60ms" }}>
              {c.trustTitle}
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5 md:items-stretch">
            {/* (a) Verified tutors + reviews */}
            <div className="lp-rv relative flex h-full flex-col gap-4 overflow-hidden rounded-[var(--r-l)] border border-solid border-line border-t-2 border-t-blue bg-paper p-5 shadow-[var(--sh-s)] transition hover:-translate-y-1 hover:shadow-[var(--sh)] sm:p-6">
              <div aria-hidden="true" className="grid h-[46px] w-[46px] flex-none place-items-center rounded-[14px] bg-blue50 text-blue">
                <Shield />
              </div>
              <div>
                <h3 className="mb-1.5 font-display text-[17px] font-bold text-ink">{c.trust1Title}</h3>
                <p className="text-[14px] leading-relaxed text-ink2">{c.trust1Body}</p>
              </div>

              {/* Sample rating */}
              <div className="flex items-center gap-2">
                <span className="stars" aria-hidden="true">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} />
                  ))}
                </span>
                <b className="font-display text-[15px] text-ink">4.9</b>
                <span className="text-[12.5px] text-muted">· 47 {c.reviewsLabel}</span>
              </div>

              {/* Mock reviews */}
              <div className="mt-auto flex flex-col gap-2.5">
                <div className="text-[12.5px] font-bold text-muted">{c.reviewsHeading}</div>
                {c.reviews.map((r, i) => (
                  <div
                    key={i}
                    className="rounded-[14px] border border-solid border-line bg-cream p-3 transition hover:border-blue hover:shadow-[var(--sh-s)]"
                  >
                    <div className="mb-[7px] text-[13.5px] leading-snug text-ink2">“{r.text}”</div>
                    <div className="flex items-center gap-[7px] text-[12px] font-bold">
                      <span className="stars" aria-hidden="true">
                        {[0, 1, 2, 3, 4].map((j) => (
                          <Star key={j} className="h-[11px] w-[11px]" />
                        ))}
                      </span>
                      <span className="text-muted">{r.who}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* (b) Secure payment + escrow mini-flow */}
            <div className="lp-rv relative flex h-full flex-col gap-4 overflow-hidden rounded-[var(--r-l)] border border-solid border-line border-t-2 border-t-green bg-paper p-5 shadow-[var(--sh-s)] transition hover:-translate-y-1 hover:shadow-[var(--sh)] sm:p-6" style={{ ["--d" as string]: "90ms" }}>
              <div aria-hidden="true" className="grid h-[46px] w-[46px] flex-none place-items-center rounded-[14px] bg-green50 text-green">
                <Lock />
              </div>
              <div>
                <h3 className="mb-1.5 font-display text-[17px] font-bold text-ink">{c.trust2Title}</h3>
                <p className="text-[14px] leading-relaxed text-ink2">{c.trust2Body}</p>
              </div>

              {/* Escrow mini-flow: tu paies → retenu → versé après le cours */}
              <div className="my-auto flex flex-col gap-2.5 rounded-[var(--r)] border border-solid border-line bg-cream p-4">
                {[
                  { Icon: Wallet, label: isAr ? "تخلّص" : "Tu paies" },
                  { Icon: Lock, label: isAr ? "يتحجز" : "Retenu en sécurité" },
                  { Icon: Bank, label: isAr ? "يتعطى للأستاذ بعد الحصة" : "Versé au prof après le cours" },
                ].map((s, i, arr) => (
                  <div key={i} className="flex flex-col gap-2.5">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="grid h-8 w-8 flex-none place-items-center rounded-[10px] bg-green50 text-green"
                      >
                        <s.Icon className="h-[16px] w-[16px]" />
                      </span>
                      <span className="text-[13px] font-bold text-ink">{s.label}</span>
                    </div>
                    {i < arr.length - 1 && (
                      <span aria-hidden="true" className="ms-[15px] block h-3 w-px bg-green/40" />
                    )}
                  </div>
                ))}
              </div>

              {/* Payment chips */}
              <div className="mt-auto flex flex-wrap items-center gap-2">
                {["Flouci", "D17", "Konnect"].map((m) => (
                  <span key={m} className="chip chip-sand">
                    {m}
                  </span>
                ))}
              </div>
            </div>

            {/* (c) First session free — centered 0 TND focal point */}
            <div className="lp-rv relative flex h-full flex-col items-center gap-4 overflow-hidden rounded-[var(--r-l)] border border-solid border-line border-t-2 border-t-ochre bg-paper p-5 text-center shadow-[var(--sh-s)] transition hover:-translate-y-1 hover:shadow-[var(--sh)] sm:p-6" style={{ ["--d" as string]: "180ms" }}>
              <div aria-hidden="true" className="grid h-[46px] w-[46px] flex-none place-items-center self-start rounded-[14px] bg-[#FFF4DF] text-ochre">
                <Gift />
              </div>
              <h3 className="font-display text-[17px] font-bold text-ink">{c.trust3Title}</h3>

              {/* centered focal 0 TND with soft ring/gift motif */}
              <div className="relative flex flex-1 items-center justify-center py-2">
                <span
                  aria-hidden="true"
                  className="absolute h-[180px] w-[180px] rounded-full bg-[radial-gradient(circle,rgba(243,194,75,.20),transparent_68%)]"
                />
                <span
                  aria-hidden="true"
                  className="absolute h-[150px] w-[150px] rounded-full border border-solid border-ochre/25"
                />
                <div className="relative flex items-baseline gap-1 font-display font-bold leading-none tracking-tight text-green">
                  <span className="text-[clamp(56px,9vw,82px)]">0</span>
                  <span className="text-[20px] font-semibold text-muted">TND</span>
                </div>
              </div>

              <p className="text-[14px] leading-relaxed text-ink2">{c.trust3Sub}</p>
            </div>
          </div>

          {/* Section-closing primary CTA */}
          <div className="lp-rv mt-9 flex justify-center" style={{ ["--d" as string]: "120ms" }}>
            <Link
              href="/explore"
              className="btn btn-primary lp-cta-primary"
              style={{ width: "auto", paddingInline: 28, paddingBlock: 15, fontSize: 15.5 }}
            >
              {c.ctaPrimary} <Forward style={{ width: 18, height: 18 }} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 5) RESULTS / SOCIAL PROOF ─────────────────────────────────── */}
      <section className="lp-sec">
        <div className="container">
          <div className="lp-head" style={{ marginBottom: 30 }}>
            <p className="lp-eyebrow lp-rv" style={{ marginBottom: 14 }}>
              {c.resultsEyebrow}
            </p>
            <h2 className="lp-h2 lp-rv" style={{ ["--d" as string]: "60ms" }}>
              {c.resultsTitle}
            </h2>
          </div>

          <div className="grid-3" style={{ marginBottom: 38 }}>
            {c.results.map((r, i) => (
              <div key={i} className="lp-rcard lp-rv" style={{ ["--d" as string]: `${i * 90}ms` }}>
                <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
                  <div
                    className="avatar sq"
                    style={{ width: 52, height: 52, fontSize: 19, borderRadius: 15, flex: "none" }}
                  >
                    {r.initials}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--fd)", fontWeight: 700, fontSize: 15.5 }}>{r.name}</div>
                    <div className="muted" style={{ fontSize: 12.5 }}>
                      {r.meta}
                    </div>
                  </div>
                  <span className="stars" aria-hidden="true" style={{ marginInlineStart: "auto", flex: "none" }}>
                    {[0, 1, 2, 3, 4].map((j) => (
                      <Star key={j} style={{ width: 12, height: 12 }} />
                    ))}
                  </span>
                </div>
                <div className="lp-outcome">
                  <span style={{ fontSize: 13.5, color: "var(--ink2)" }}>{r.before}</span>
                  <span style={{ fontFamily: "var(--fd)", color: "var(--green)", fontWeight: 700 }}>
                    {c.arrow}
                  </span>
                  <b style={{ fontFamily: "var(--fd)", color: "#13724f", fontSize: 14.5 }}>{r.after}</b>
                </div>
              </div>
            ))}
          </div>

          {/* Stats band */}
          <div className="lp-stats lp-rv">
            <div className="lp-stat">
              <b>
                <Bolt style={{ width: 26, height: 26, color: "var(--amber)" }} /> +1 240
              </b>
              <span>{c.statsSessions}</span>
            </div>
            <div className="lp-stat">
              <b style={{ color: "var(--amber)" }}>
                <Star style={{ width: 24, height: 24, color: "var(--amber)" }} /> 4.9
              </b>
              <span>{c.statsRating}</span>
            </div>
            <div className="lp-stat">
              <b style={{ color: "#5BD1A6" }}>
                <Gift style={{ width: 24, height: 24, color: "#5BD1A6" }} /> 0
              </b>
              <span>{c.statsFree}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6) PRICING TRANSPARENCY ───────────────────────────────────── */}
      <section
        className="lp-sec"
        style={{ background: "var(--cream)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}
      >
        <div className="container">
          <div className="lp-head" style={{ marginBottom: 30 }}>
            <p className="lp-eyebrow lp-rv" style={{ marginBottom: 14 }}>
              {c.pricingEyebrow}
            </p>
            <h2 className="lp-h2 lp-rv" style={{ ["--d" as string]: "60ms" }}>
              {c.pricingTitle}
            </h2>
          </div>

          <div className="lp-price-grid">
            {/* 1ère séance — 0 TND */}
            <div className="lp-pcard lp-pcard-hi lp-rv">
              <span className="lp-pbadge">{c.priceBadge}</span>
              <div className="lp-plabel">{c.priceFirstLabel}</div>
              <div className="lp-pnum" style={{ color: "var(--green)" }}>
                0 <small>TND</small>
              </div>
              <p className="lp-pnote">{c.priceFirstNote}</p>
            </div>

            {/* Séance — fixée par le prof */}
            <div className="lp-pcard lp-rv" style={{ ["--d" as string]: "90ms" }}>
              <div className="lp-plabel">{c.priceSessionLabel}</div>
              <div className="lp-pnum" style={{ color: "var(--ink)", fontSize: "clamp(22px,2.6vw,28px)" }}>
                {c.priceSessionValue}
              </div>
              <p className="lp-pnote">{c.priceSessionNote}</p>
            </div>

            {/* Abonnement — aucun */}
            <div className="lp-pcard lp-rv" style={{ ["--d" as string]: "180ms" }}>
              <div className="lp-plabel">{c.priceSubLabel}</div>
              <div className="lp-pnum" style={{ color: "var(--ink)" }}>
                {c.priceSubValue}
              </div>
              <p className="lp-pnote">{c.priceSubNote}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7) FINAL CTA BAND (cobalt + zellige) ──────────────────────── */}
      <section className="zellige hero-blue lp-final" aria-labelledby="lp-final-title">
        <div className="lp-final-glow" aria-hidden="true" />
        <div className="container">
          <div className="lp-final-inner">
            <h2 id="lp-final-title" className="lp-h2 lp-rv" style={{ color: "#fff", maxWidth: 680 }}>
              {c.finalTitle}
            </h2>

            <Link
              href="/explore"
              className="btn btn-primary lp-cta-primary lp-final-cta lp-rv"
              style={{ width: "auto", paddingInline: 30, paddingBlock: 16, ["--d" as string]: "80ms" }}
            >
              {c.finalCta} <Forward style={{ width: 18, height: 18 }} />
            </Link>

            <div className="lp-rv" style={{ display: "flex", alignItems: "center", gap: 8, color: "#EAF2FB", fontSize: 13.5, ["--d" as string]: "140ms" }}>
              <Bolt style={{ width: 16, height: 16, color: "var(--amber)" }} />
              <span>{c.finalUrgency}</span>
            </div>
            <p className="lp-rv" style={{ color: "#CFE0F3", fontSize: 13, ["--d" as string]: "180ms" }}>{c.finalReassure}</p>
          </div>
        </div>
      </section>

      {/* ── 8) CROSS-LINK (near footer) — teacher panel ───────────────── */}
      <section className="lp-sec">
        <div className="container">
          <div className="lp-outro lp-rv">
            <div style={{ display: "flex", gap: 14, alignItems: "center", minWidth: 0 }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  background: "var(--blue50)",
                  display: "grid",
                  placeItems: "center",
                  color: "var(--blue)",
                  flex: "none",
                }}
              >
                <Users />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "var(--fd)", fontWeight: 700, fontSize: 17, marginBottom: 4 }}>
                  {c.profOutroTitle}
                </div>
                <p style={{ fontSize: 14, color: "var(--ink2)", lineHeight: 1.55 }}>{c.profOutroBody}</p>
              </div>
            </div>
            <Link
              href="/pour-les-profs"
              className="btn btn-ink lp-cta-ghost"
              style={{ width: "auto", paddingInline: 24, paddingBlock: 14, fontSize: 15, flex: "none" }}
            >
              {c.profOutroCta}
            </Link>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
