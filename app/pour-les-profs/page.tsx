"use client";
/* ───────────────────────────────────────────────────────────────────────────
   /pour-les-profs — 9arini TUTOR (teacher) landing page.
   "Shopify for Tunisian tutors": branded page, live classes, paid in TND, keep 88%.
   Self-contained: bilingual copy (FR + Tunisian Derija) lives in `copy` below.
   Uses the app design system (globals.css tokens + utility classes), SiteShell,
   useLocale. One primary CTA everywhere → /onboarding. RTL-safe (logical props).

   VISUAL/MOTION PASS: hero is now a composite animated storefront scene
   (floating phone + class filling + LIVE + TND count-up + drifting payout chips);
   every section is elevated with scroll-reveal, depth, and refined micro-motion.
   All page-scoped CSS is prefixed `lpp-` and lives in the inline <style> blocks.
   Honors prefers-reduced-motion (static final state, no motion).
   ─────────────────────────────────────────────────────────────────────────── */
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SiteShell } from "@/components/SiteShell";
import { useLocale } from "@/components/LocaleProvider";
import {
  Wallet,
  Trend,
  Video,
  Share,
  Shield,
  Check,
  Star,
  Users,
  Bolt,
  Book,
  Forward,
} from "@/components/icons";

/* ═══════════════════════════════════════════════════════════════════════════
   COPY — FR + Tunisian Derija (ar). Authentic, warm tutor-first voice.
   ═══════════════════════════════════════════════════════════════════════════ */
const copy = {
  fr: {
    crossTop: "Tu es élève ?",
    eyebrow: "Pour les profs",
    h1a: "Ta page de prof.",
    h1b: "Tes cours en direct.",
    h1c: "Payé en dinar.",
    sub: "Ta boutique de prof, gérée depuis ton téléphone.",
    ctaPrimary: "Crée ta page de prof",
    ctaGhost: "Voir un exemple de page",
    micro: "Gratuit. Sans carte.",

    // share / growth loop
    shareEyebrow: "Ton lien, ta pub",
    shareTitle: "Un lien à toi. Partage-le, les élèves arrivent.",
    shareBody:
      "Colle ton lien sur WhatsApp, TikTok ou Insta. Chaque partage t'amène des élèves.",
    shareChannels: ["WhatsApp", "TikTok", "Instagram", "Facebook"],
    shareLinkLabel: "Ton lien",
    shareLinkExample: "9arini.tn/ta-page",
    // hero phone
    phoneName: "Yassine Khelifi",
    phoneSubject: "Maths · primaire → Bac",
    live: "EN DIRECT",
    balanceLbl: "Solde",
    tnd: "TND",
    sessionTitle: "Intégrales — révision express",
    sessionMeta: "Sam 14h · 90 min",
    free1st: "1er cours offert",
    heroSceneLabel:
      "Page de prof 9arini : une classe se remplit en direct et le solde en dinar augmente.",
    booked: "réservé",
    joined: "a rejoint",
    classFilling: "Classe en cours de remplissage",

    // income anchor
    incomeEyebrow: "Combien tu peux gagner",
    incomeLead:
      "Tu fixes ton tarif, tu gardes 88 %. Un exemple — pas un plafond :",
    inStudents: "8 élèves",
    inSessions: "2 séances / sem",
    inPrice: "20 TND / séance",
    inGross: "1 280 TND / mois",
    inKeepLbl: "Tu gardes",
    inKeep: "1 126 TND",
    inWithdraw: "Retraits sous 48 h sur Flouci, Konnect & D17. Sans carte.",
    inYou: "Toi · 88 %",
    inFee: "9arini · 12 %",

    // features
    featEyebrow: "Tout ce qu'il te faut",
    featTitle: "Une boutique de prof, prête en 2 minutes",
    f1t: "Ta page brandée",
    f1b: "Ton nom, ta photo, tes matières. Un seul lien à partager partout.",
    f2t: "Payé en dinar — tu gardes 88 %",
    f2b: "Tes élèves paient en TND. 9arini prend 12 %, le reste est à toi.",
    f3t: "Cours en direct",
    f3b: "Lance un cours live, partage l'écran, enregistre. Tout intégré.",
    f4t: "Vends tes fiches",
    f4b: "Résumés, exercices, séries corrigées : un revenu qui tourne 24h/24.",

    // how it works
    howEyebrow: "Comment ça marche",
    howTitle: "De zéro à ta 1ère réservation ce soir",
    s1t: "Crée ta page",
    s1b: "Nom, matière, photo. Deux minutes, c'est en ligne.",
    s2t: "Partage ton lien",
    s2b: "WhatsApp, Insta, TikTok. Tes élèves réservent en un clic.",
    s3t: "Encaisse dès la 1ère réservation",
    s3b: "L'élève paie à la réservation. L'argent arrive sous 48 h.",

    // social proof
    proofEyebrow: "Ils enseignent déjà",
    proofTitle: "Des profs tunisiens, payés chaque semaine",
    statStudents: "élèves",
    statRating: "note moyenne",
    statTutors: "profs actifs",
    t1: "J'ai partagé mon lien sur WhatsApp le soir. Le lendemain, 4 réservations. Mon retrait Flouci en deux jours.",
    t1n: "Yassine",
    t1m: "Maths · Sousse",
    t2: "Avant je courais après les paiements. Là : l'élève paie, je donne le cours, je suis payée. Net.",
    t2n: "Ines",
    t2m: "Anglais · Sfax",
    t3: "Mes fiches de physique se vendent même quand je dors. Un vrai deuxième revenu.",
    t3n: "Skander",
    t3m: "Physique · Gafsa",

    // faq
    faqEyebrow: "Avant de te lancer",
    faqTitle: "Les questions qu'on nous pose",
    q1: "Qui paie les frais ?",
    a1: "9arini prend 12 %, zéro frais caché. Tu vois ce que tu gardes avant de publier.",
    q2: "Si un élève ne vient pas ?",
    a2: "Il a payé à la réservation — tu gardes la séance. Aucun temps gratuit.",
    q3: "Faut-il un diplôme ?",
    a3: "Non. Maîtrise ta matière, une bonne connexion, et tu démarres aujourd'hui.",

    // final
    finalTitle: "Ta page de prof t'attend.",
    finalSub: "Crée-la en 2 minutes.",
    finalReassure: "Gratuit · sans carte · supprimable à tout moment.",

    crossBottom: "Tu es élève ? Trouve ton prof",
  },
  ar: {
    crossTop: "إنتي تلميذ ؟",
    eyebrow: "للأساتذة",
    h1a: "صفحتك متاع أستاذ.",
    h1b: "دروسك مباشرة.",
    h1c: "وخلاصك بالدينار.",
    sub: "بوتيك متاع أستاذ، تسيّرها الكل من تيليفونك.",
    ctaPrimary: "اعمل صفحتك متاع أستاذ",
    ctaGhost: "شوف مثال متاع صفحة",
    micro: "فابور. بلا كارت.",

    // share / growth loop
    shareEyebrow: "اللينك متاعك، هو الرﭬلام متاعك",
    shareTitle: "لينك خاص بيك. شاركو، والتلامذة يجيو.",
    shareBody:
      "الصق اللينك متاعك في واتساب، تيكتوك ولا إنستا. كل مشاركة تجيبلك تلامذة.",
    shareChannels: ["واتساب", "تيكتوك", "إنستا", "فايسبوك"],
    shareLinkLabel: "اللينك متاعك",
    shareLinkExample: "9arini.tn/صفحتك",
    // hero phone
    phoneName: "ياسين الخليفي",
    phoneSubject: "رياضيات · من الابتدائي للباك",
    live: "مباشر",
    balanceLbl: "الرصيد",
    tnd: "دينار",
    sessionTitle: "التكامل — مراجعة سريعة",
    sessionMeta: "السبت 14س · 90 دقيقة",
    free1st: "أول درس فابور",
    heroSceneLabel:
      "صفحة أستاذ 9arini : القسم يتعمّر مباشرة والرصيد بالدينار يزيد.",
    booked: "محجوز",
    joined: "دخل",
    classFilling: "القسم في طور التعمير",

    // income anchor
    incomeEyebrow: "قداش تنجم تربح",
    incomeLead:
      "إنتي تحدّد التعريفة، تحتفظ بـ 88 %. مثال — موش سقف :",
    inStudents: "8 تلامذة",
    inSessions: "حصتين / جمعة",
    inPrice: "20 دينار / حصة",
    inGross: "1 280 دينار / شهر",
    inKeepLbl: "تحتفظ بـ",
    inKeep: "1 126 دينار",
    inWithdraw: "السحب في ظرف 48 ساعة على Flouci و Konnect و D17. بلا كارت.",
    inYou: "إنتي · 88 %",
    inFee: "9arini · 12 %",

    // features
    featEyebrow: "الكل اللي تحتاجو",
    featTitle: "بوتيك متاع أستاذ، حاضرة في دقيقتين",
    f1t: "صفحتك بإسمك",
    f1b: "إسمك، تصويرتك، موادك. لينك وحيد تنجم تبعثو في كل بلاصة.",
    f2t: "خلاصك بالدينار — تحتفظ بـ 88 %",
    f2b: "تلامذتك يخلصو بالدينار. 9arini تاخذ 12 %، والباقي الكل متاعك.",
    f3t: "دروس مباشرة",
    f3b: "ابدا درس مباشر، شارك الإيكران، سجّل. الكل داخل المنصة.",
    f4t: "بيع فيشاتك",
    f4b: "ملخصات، تمارين، سلاسل مصحّحة : مدخول يدور 24 ساعة على 24.",

    // how it works
    howEyebrow: "كيفاش يخدم",
    howTitle: "من الصفر لأول حجز متاعك الليلة",
    s1t: "اعمل صفحتك",
    s1b: "إسم، مادة، تصويرة. دقيقتين، وتولّي أونلاين.",
    s2t: "شارك اللينك متاعك",
    s2b: "واتساب، إنستا، تيكتوك. تلامذتك يحجزو بكليكة.",
    s3t: "اقبض من أول حجز",
    s3b: "التلميذ يخلّص وقت الحجز. الفلوس توصلك في ظرف 48 ساعة.",

    // social proof
    proofEyebrow: "أساتذة يقرّيو معانا",
    proofTitle: "أساتذة تونسيين، يتخلّصو كل جمعة",
    statStudents: "تلميذ",
    statRating: "معدّل التنقيط",
    statTutors: "أستاذ نشيط",
    t1: "نشرت اللينك متاعي في واتساب في الليل. في الغدوة لقيت 4 حجوزات. سحب Flouci وصلني في يومين.",
    t1n: "ياسين",
    t1m: "رياضيات · سوسة",
    t2: "قبل كنت نجري ورا الخلاص. توا : التلميذ يخلّص، نعطي الدرس، ونتخلّص. صافي.",
    t2n: "إيناس",
    t2m: "أنڨليزية · صفاقس",
    t3: "الفيشات متاع الفيزيا يتباعو حتى كي نكون راقد. مدخول ثاني بالحق.",
    t3n: "إسكندر",
    t3m: "فيزياء · ڨفصة",

    // faq
    faqEyebrow: "قبل ما تبدا",
    faqTitle: "الأسئلة اللي يسقسيونا عليها",
    q1: "شكون يخلّص الفريسي ؟",
    a1: "9arini تاخذ 12 %، بلا حتى فريسي مخبّي. تشوف شنوّة باش تحتفظ بيه قبل ما تنشر.",
    q2: "كان التلميذ ما جاش ؟",
    a2: "هو خلّص وقت الحجز — تحتفظ بالحصة. ما تخدمش فابور.",
    q3: "يلزم شهادة ؟",
    a3: "لا. اتقن مادتك، كنكسيون مليحة، وتبدا اليوم.",

    // final
    finalTitle: "صفحتك متاع أستاذ تستنّى فيك.",
    finalSub: "اعملها في دقيقتين.",
    finalReassure: "فابور · بلا كارت · تنجم تمسحها وقتلي تحب.",

    crossBottom: "إنتي تلميذ ؟ لقا أستاذك",
  },
} as const;

type Copy = (typeof copy)[keyof typeof copy];

/* ═══════════════════════════════════════════════════════════════════════════
   Count-up hook — animates 0 → target via requestAnimationFrame.
   Honors prefers-reduced-motion (renders the final number, no animation).
   Starts when the element scrolls into view. Cleans up on unmount.
   ═══════════════════════════════════════════════════════════════════════════ */
function useCountUp(target: number, durationMs = 1500) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLElement | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      setValue(target);
      return;
    }

    let raf = 0;
    const run = () => {
      if (started.current) return;
      started.current = true;
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / durationMs);
        // easeOutCubic
        const eased = 1 - Math.pow(1 - p, 3);
        setValue(Math.round(target * eased));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    const el = ref.current;
    let observer: IntersectionObserver | null = null;
    if (el && "IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            run();
            observer?.disconnect();
          }
        },
        { threshold: 0.4 },
      );
      observer.observe(el);
    } else {
      run();
    }

    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [target, durationMs]);

  return { value, ref };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Scroll-reveal — adds `is-in` when the element enters the viewport.
   IntersectionObserver, runs once, disconnects on unmount. Under
   prefers-reduced-motion the element is shown immediately (CSS guard also
   neutralises the transform). Returns a ref + className.
   ═══════════════════════════════════════════════════════════════════════════ */
function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, shown };
}

/* Reveal wrapper — staggered fade/slide-in on enter. `delay` in ms via CSS var. */
function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  as?: any;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { ref, shown } = useReveal<HTMLElement>();
  return (
    <Tag
      ref={ref as any}
      className={`lpp-reveal ${shown ? "is-in" : ""} ${className}`}
      style={{ ...style, ["--lpp-d" as any]: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

/* Format an integer with a thin-space thousands separator (matches the app). */
function fmt(n: number) {
  return n.toLocaleString("fr-FR").replace(/ |,/g, " ");
}

/* ═══════════════════════════════════════════════════════════════════════════
   HERO SCENE — composite animated storefront:
     • floating phone (the tutor's 9arini page) w/ zellige + glow + parallax
     • a class filling: student avatars pop in one-by-one on an arc
     • LIVE / EN DIRECT pill pulsing
     • TND balance count-up (Space Grotesk numerals)
     • payout chips drifting upward ("+15 TND · réservé ✓")
   role="img" + aria-label describes the whole scene; inner bits aria-hidden.
   ═══════════════════════════════════════════════════════════════════════════ */
function HeroScene({ c }: { c: Copy }) {
  const { value, ref } = useCountUp(840, 1700);
  const { locale } = useLocale();

  // class-filling avatars (locale-aware initials, brand gradients) on a soft arc
  const seatInits =
    locale === "ar" ? ["أ", "س", "م", "ر"] : ["A", "S", "M", "R"];
  const seats = [
    {
      grad: "linear-gradient(150deg,#F3C24B,#E0852E)",
      x: -118,
      y: -54,
      d: 0.6,
    },
    { grad: "linear-gradient(150deg,#5FB7F0,#0E5AA6)", x: 120, y: -30, d: 1.2 },
    { grad: "linear-gradient(150deg,#54D6AC,#1B9C6F)", x: -126, y: 64, d: 1.8 },
    { grad: "linear-gradient(150deg,#F0A85F,#C26E1C)", x: 128, y: 86, d: 2.4 },
  ];

  return (
    <div
      role="img"
      aria-label={c.heroSceneLabel}
      className="lpp-scene"
      style={{
        position: "relative",
        display: "flex",
        justifyContent: "center",
      }}
    >
      {/* animated cobalt→sand gradient wash + zellige atmosphere */}
      <div className="lpp-wash" aria-hidden="true" />
      <div className="lpp-zellige-wash zellige" aria-hidden="true" />

      {/* soft cobalt glow behind the phone */}
      <div className="lpp-glow" aria-hidden="true" />

      {/* class-filling avatars (decorative) */}
      <div className="lpp-seats" aria-hidden="true">
        {seats.map((s, idx) => (
          <span
            key={idx}
            className="lpp-seat"
            style={{
              ["--sx" as any]: `${s.x}px`,
              ["--sy" as any]: `${s.y}px`,
              ["--sd" as any]: `${s.d}s`,
              background: s.grad,
            }}
          >
            {seatInits[idx]}
          </span>
        ))}
      </div>

      {/* drifting payout chips (decorative) */}
      <div className="lpp-payouts" aria-hidden="true">
        <span className="lpp-payout lpp-payout-a">
          <Check style={{ width: 13, height: 13 }} /> +15 {c.tnd} · {c.booked}
        </span>
        <span className="lpp-payout lpp-payout-b">
          <Check style={{ width: 13, height: 13 }} /> +20 {c.tnd} · {c.booked}
        </span>
      </div>

      {/* the phone */}
      <div className="lpp-phone-wrap" aria-hidden="true">
        <div className="lpp-phone">
          {/* screen */}
          <div
            className="zellige hero-blue lpp-screen"
            style={{
              borderRadius: 28,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              gap: 13,
              padding: "20px 16px 18px",
              minHeight: 452,
            }}
          >
            {/* notch */}
            <div
              style={{
                width: 96,
                height: 6,
                borderRadius: 999,
                background: "rgba(255,255,255,.25)",
                margin: "0 auto 2px",
              }}
            />

            {/* header: avatar + name + live */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                className="avatar sq"
                style={{
                  width: 46,
                  height: 46,
                  fontSize: 19,
                  background: "linear-gradient(150deg,#F3C24B,#E0852E)",
                  borderColor: "rgba(255,255,255,.3)",
                }}
              >
                ي
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "var(--fd)",
                    fontWeight: 700,
                    fontSize: 14.5,
                    color: "#fff",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {c.phoneName}
                </div>
                <div style={{ fontSize: 11, color: "#CFE0F3" }}>
                  {c.phoneSubject}
                </div>
              </div>
              <span
                className="chip lpp-live"
                style={{
                  marginInlineStart: "auto",
                  background: "var(--green)",
                  color: "#fff",
                  fontSize: 10.5,
                  gap: 5,
                  flexShrink: 0,
                }}
              >
                <span className="lpp-live-dot" />
                {c.live}
              </span>
            </div>

            {/* balance card with count-up */}
            <div
              ref={ref as React.RefObject<HTMLDivElement>}
              style={{
                background: "rgba(255,255,255,.10)",
                borderRadius: "var(--r)",
                padding: "15px 16px",
                border: "1px solid rgba(255,255,255,.14)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#CFE0F3",
                  fontWeight: 600,
                  marginBottom: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Wallet style={{ width: 14, height: 14 }} />
                {c.balanceLbl}
              </div>
              <div
                style={{
                  fontFamily: "var(--fd)",
                  fontSize: 36,
                  fontWeight: 700,
                  letterSpacing: "-1.2px",
                  color: "#fff",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <small style={{ fontSize: 18, opacity: 0.85 }}>+</small>
                {fmt(value)}{" "}
                <small style={{ fontSize: 16, opacity: 0.8, fontWeight: 600 }}>
                  {c.tnd}
                </small>
              </div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  marginTop: 10,
                  background: "rgba(243,194,75,.2)",
                  padding: "7px 10px",
                  borderRadius: 10,
                  fontSize: 11.5,
                  fontFamily: "var(--fd)",
                  fontWeight: 700,
                  color: "#EAF2FC",
                }}
              >
                <Trend style={{ width: 14, height: 14 }} />
                +18%
              </div>
            </div>

            {/* live session card */}
            <div
              style={{
                background: "rgba(255,255,255,.10)",
                borderRadius: "var(--r)",
                padding: "13px 14px",
                border: "1px solid rgba(255,255,255,.14)",
                display: "flex",
                alignItems: "center",
                gap: 11,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: "rgba(255,255,255,.14)",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <Video />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 12.5,
                    color: "#fff",
                    marginBottom: 2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {c.sessionTitle}
                </div>
                <div style={{ fontSize: 11, color: "#CFE0F3" }}>
                  {c.sessionMeta}
                </div>
              </div>
              <span
                className="chip"
                style={{
                  background: "var(--ochre)",
                  color: "#fff",
                  fontSize: 10,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {c.free1st}
              </span>
            </div>

            {/* class-filling mini row (inside the screen) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                background: "rgba(255,255,255,.07)",
                border: "1px solid rgba(255,255,255,.12)",
                borderRadius: 12,
                padding: "9px 12px",
              }}
            >
              <span className="lpp-stack" aria-hidden="true">
                {[
                  "linear-gradient(150deg,#F3C24B,#E0852E)",
                  "linear-gradient(150deg,#5FB7F0,#0E5AA6)",
                  "linear-gradient(150deg,#54D6AC,#1B9C6F)",
                ].map((g, i) => (
                  <span
                    key={i}
                    className="lpp-stack-a"
                    style={{ background: g, ["--si" as any]: i }}
                  />
                ))}
                <span className="lpp-stack-more">+5</span>
              </span>
              <span style={{ fontSize: 11, color: "#CFE0F3", fontWeight: 600 }}>
                {c.classFilling}
              </span>
            </div>

            {/* payment trust row */}
            <div
              style={{
                marginTop: "auto",
                display: "flex",
                gap: 7,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              {["Flouci", "Konnect", "D17"].map((p) => (
                <span
                  key={p}
                  style={{
                    fontFamily: "var(--fd)",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#fff",
                    background: "rgba(255,255,255,.12)",
                    border: "1px solid rgba(255,255,255,.16)",
                    borderRadius: 999,
                    padding: "5px 11px",
                  }}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sub-component: payment trust chips (text badges)
   ═══════════════════════════════════════════════════════════════════════════ */
function PayChips() {
  const items: { name: string; color: string }[] = [
    { name: "Flouci", color: "var(--blue)" },
    { name: "Konnect", color: "var(--green)" },
    { name: "D17", color: "var(--ochre)" },
  ];
  return (
    <div className="cluster" style={{ gap: 10 }}>
      {items.map((p) => (
        <span
          key={p.name}
          className="lpp-pay-badge"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontFamily: "var(--fd)",
            fontWeight: 700,
            fontSize: 13.5,
            color: p.color,
            background: "var(--paper)",
            border: "1px solid var(--line)",
            borderRadius: 999,
            padding: "8px 14px",
            boxShadow: "var(--sh-s)",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 9,
              height: 9,
              borderRadius: 999,
              background: p.color,
              flexShrink: 0,
            }}
          />
          {p.name}
        </span>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sub-component: feature card (elevated, hover-lift)
   ═══════════════════════════════════════════════════════════════════════════ */
function FeatureCard({
  icon,
  bg,
  fg,
  title,
  body,
}: {
  icon: React.ReactNode;
  bg: string;
  fg: string;
  title: string;
  body: string;
}) {
  return (
    <div
      className="panel panel-pad lpp-feature"
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <div
        aria-hidden="true"
        className="lpp-feature-ic"
        style={{
          width: 52,
          height: 52,
          borderRadius: 15,
          background: bg,
          color: fg,
          display: "grid",
          placeItems: "center",
        }}
      >
        {icon}
      </div>
      <div>
        <div
          style={{
            fontFamily: "var(--fd)",
            fontWeight: 700,
            fontSize: 17.5,
            marginBottom: 7,
          }}
        >
          {title}
        </div>
        <p style={{ fontSize: 14, color: "var(--ink2)", lineHeight: 1.6 }}>
          {body}
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sub-component: testimonial card
   ═══════════════════════════════════════════════════════════════════════════ */
function Testimonial({
  quote,
  name,
  meta,
  initials,
}: {
  quote: string;
  name: string;
  meta: string;
  initials: string;
}) {
  return (
    <div
      className="panel panel-pad lpp-quote"
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      <span className="stars" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} />
        ))}
      </span>
      <p
        style={{
          fontSize: 14.5,
          color: "var(--ink)",
          lineHeight: 1.65,
          flex: 1,
        }}
      >
        &ldquo;{quote}&rdquo;
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          className="avatar"
          aria-hidden="true"
          style={{ width: 42, height: 42, fontSize: 15, borderRadius: 14 }}
        >
          {initials}
        </div>
        <div>
          <div
            style={{ fontFamily: "var(--fd)", fontWeight: 700, fontSize: 14.5 }}
          >
            {name}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{meta}</div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sub-component: FAQ accordion item (accessible disclosure, animated height)
   ═══════════════════════════════════════════════════════════════════════════ */
function FaqItem({
  q,
  a,
  defaultOpen = false,
}: {
  q: string;
  a: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={`panel lpp-faq ${open ? "is-open" : ""}`}
      style={{ overflow: "hidden" }}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="lpp-faq-btn"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 14,
          textAlign: "start",
          background: "transparent",
          border: 0,
          cursor: "pointer",
          padding: "clamp(15px,2vw,20px) clamp(16px,2.4vw,24px)",
          fontFamily: "var(--fb)",
          color: "var(--ink)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--fd)",
            fontWeight: 700,
            fontSize: 16,
            flex: 1,
          }}
        >
          {q}
        </span>
        <span
          aria-hidden="true"
          className="lpp-faq-ic"
          style={{
            flexShrink: 0,
            width: 30,
            height: 30,
            borderRadius: 9,
            background: open ? "var(--blue)" : "var(--blue50)",
            color: open ? "#fff" : "var(--blue)",
            display: "grid",
            placeItems: "center",
            transition: "background .2s",
          }}
        >
          <svg
            viewBox="0 0 24 24"
            className="ic"
            aria-hidden="true"
            style={{
              width: 16,
              height: 16,
              transform: open ? "rotate(45deg)" : "none",
              transition: "transform .2s",
            }}
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </span>
      </button>
      {/* grid-rows trick: animates open/closed smoothly, height-agnostic */}
      <div className="lpp-faq-wrap" data-open={open}>
        <div className="lpp-faq-inner">
          <div
            style={{
              padding: "0 clamp(16px,2.4vw,24px) clamp(15px,2vw,20px)",
              fontSize: 14.5,
              color: "var(--ink2)",
              lineHeight: 1.65,
            }}
          >
            {a}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sub-component: section eyebrow + heading block (reveal-aware)
   ═══════════════════════════════════════════════════════════════════════════ */
function SectionHead({
  eyebrow,
  title,
  center = false,
}: {
  eyebrow: string;
  title: string;
  center?: boolean;
}) {
  return (
    <Reveal
      style={{
        marginBottom: "clamp(24px,3.5vw,40px)",
        textAlign: center ? "center" : "start",
        maxWidth: center ? 640 : undefined,
        marginInline: center ? "auto" : undefined,
      }}
    >
      <div className="web-eyebrow" style={{ marginBottom: 10 }}>
        {eyebrow}
      </div>
      <h2 className="web-h2">{title}</h2>
    </Reveal>
  );
}

/* Cross-link to the student / home landing. */
function CrossLink({
  label,
  align = "start",
}: {
  label: string;
  align?: "start" | "center";
}) {
  return (
    <div
      style={{
        textAlign: align,
        marginInline: align === "center" ? "auto" : undefined,
      }}
    >
      <Link
        href="/"
        className="lpp-cross"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontWeight: 700,
          fontSize: 13.5,
          color: "var(--blue)",
          background: "var(--blue50)",
          borderRadius: 999,
          padding: "8px 16px",
        }}
      >
        {label}
        <Forward
          className="lpp-cross-arrow"
          style={{ width: 15, height: 15 }}
        />
      </Link>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
export default function PourLesProfsPage() {
  const { locale } = useLocale();
  const c = copy[locale];

  return (
    <SiteShell>
      {/* ═══════════════════════════════════════════════════════════════════
          Scoped styles: keyframes, reveal, hero scene, micro-interactions.
          All selectors are prefixed `lpp-` to avoid clashing with globals.css.
          prefers-reduced-motion guard at the bottom kills all motion.
          ═══════════════════════════════════════════════════════════════════ */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        /* ---- keyframes ---- */
        @keyframes lpp-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes lpp-float { 0%,100% { transform: translateY(0) rotate(-.4deg); } 50% { transform: translateY(-12px) rotate(.4deg); } }
        @keyframes lpp-glow { 0%,100% { opacity: .7; transform: scale(1); } 50% { opacity: 1; transform: scale(1.06); } }
        @keyframes lpp-wash { 0%,100% { transform: translate3d(-2%, -1%, 0) scale(1.05); } 50% { transform: translate3d(2%, 2%, 0) scale(1.12); } }
        @keyframes lpp-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .4; transform: scale(.6); } }
        @keyframes lpp-ring { 0% { box-shadow: 0 0 0 0 rgba(27,156,111,.5); } 70%,100% { box-shadow: 0 0 0 9px rgba(27,156,111,0); } }
        @keyframes lpp-seat-in {
          0% { opacity: 0; transform: translate(calc(var(--sx) * .55), calc(var(--sy) * .55)) scale(.5); }
          60% { opacity: 1; transform: translate(var(--sx), var(--sy)) scale(1.08); }
          100% { opacity: 1; transform: translate(var(--sx), var(--sy)) scale(1); }
        }
        @keyframes lpp-seat-float { 0%,100% { translate: 0 0; } 50% { translate: 0 -6px; } }
        @keyframes lpp-payout {
          0% { opacity: 0; transform: translateY(14px) scale(.92); }
          14% { opacity: 1; transform: translateY(0) scale(1); }
          78% { opacity: 1; transform: translateY(-44px) scale(1); }
          100% { opacity: 0; transform: translateY(-66px) scale(.96); }
        }
        @keyframes lpp-stack-in { from { opacity: 0; transform: scale(.4); } to { opacity: 1; transform: scale(1); } }

        /* ---- scroll reveal ---- */
        .lpp-reveal { opacity: 0; transform: translateY(18px); transition: opacity .6s cubic-bezier(.2,.7,.2,1), transform .6s cubic-bezier(.2,.7,.2,1); transition-delay: var(--lpp-d, 0ms); will-change: opacity, transform; }
        .lpp-reveal.is-in { opacity: 1; transform: none; }

        /* ---- inline rise (faq legacy) ---- */
        .lpp-rise { animation: lpp-rise .28s cubic-bezier(.2,.7,.2,1); }

        /* ---- hero scene ---- */
        .lpp-scene { width: 100%; min-height: 488px; isolation: isolate; }
        .lpp-wash {
          position: absolute; inset: -12% 10%; z-index: 0; border-radius: 40px;
          background:
            radial-gradient(46% 50% at 28% 26%, rgba(14,90,166,.30), transparent 70%),
            radial-gradient(48% 52% at 76% 70%, rgba(241,231,214,.85), transparent 72%),
            radial-gradient(40% 44% at 70% 18%, rgba(243,194,75,.30), transparent 70%);
          filter: blur(6px); animation: lpp-wash 14s ease-in-out infinite;
        }
        .lpp-zellige-wash { position: absolute; inset: -6%; z-index: 0; opacity: .5; border-radius: 36px; }
        .lpp-zellige-wash::before { opacity: .10; }
        .lpp-glow {
          position: absolute; inset-block-start: 8%; inset-inline-start: 50%; translate: -50% 0;
          width: 360px; height: 360px; z-index: 0; border-radius: 999px;
          background: radial-gradient(circle, rgba(14,90,166,.34), transparent 68%);
          filter: blur(10px); animation: lpp-glow 6s ease-in-out infinite;
        }
        .lpp-phone-wrap { position: relative; z-index: 2; animation: lpp-float 7s ease-in-out infinite; }
        .lpp-phone {
          position: relative; width: min(300px, 80vw); border-radius: 38px; padding: 12px;
          background: linear-gradient(160deg,#15263B,#0A1626);
          box-shadow: var(--sh-l), 0 50px 90px -50px rgba(14,90,166,.55);
          border: 1px solid rgba(255,255,255,.08);
        }
        .lpp-screen { box-shadow: inset 0 1px 0 rgba(255,255,255,.10); }

        /* class-filling avatars on an arc around the phone */
        .lpp-seats { position: absolute; inset: 0; z-index: 3; display: grid; place-items: center; pointer-events: none; }
        .lpp-seat {
          position: absolute; width: 46px; height: 46px; border-radius: 15px;
          display: grid; place-items: center; color: #fff; font-family: var(--fd); font-weight: 700; font-size: 17px;
          border: 2.5px solid var(--cream); box-shadow: var(--sh);
          opacity: 0;
          animation:
            lpp-seat-in .7s cubic-bezier(.2,.8,.2,1) forwards var(--sd, .6s),
            lpp-seat-float 5s ease-in-out infinite calc(var(--sd, .6s) + .7s);
        }

        /* drifting payout chips */
        .lpp-payouts { position: absolute; inset-block-end: 8%; inset-inline-end: 2%; z-index: 4; pointer-events: none; }
        .lpp-payout {
          position: absolute; inset-inline-end: 0; white-space: nowrap;
          display: inline-flex; align-items: center; gap: 6px;
          font-family: var(--fd); font-weight: 700; font-size: 12px; color: #0E5031;
          background: #fff; border: 1px solid var(--green50); border-radius: 999px;
          padding: 7px 12px; box-shadow: var(--sh); opacity: 0;
        }
        .lpp-payout .ic { color: var(--green); }
        .lpp-payout-a { animation: lpp-payout 5.4s ease-in-out infinite .8s; }
        .lpp-payout-b { inset-inline-end: 38px; animation: lpp-payout 5.4s ease-in-out infinite 3.4s; }

        .lpp-live { animation: lpp-ring 1.8s ease-out infinite; }
        .lpp-live-dot { width: 7px; height: 7px; border-radius: 999px; background: #fff; display: inline-block; animation: lpp-pulse 1.4s ease-in-out infinite; }

        /* in-screen avatar stack */
        .lpp-stack { display: inline-flex; align-items: center; }
        .lpp-stack-a { width: 22px; height: 22px; border-radius: 7px; border: 2px solid #12243a; margin-inline-start: -7px; display: inline-block; animation: lpp-stack-in .5s cubic-bezier(.2,.8,.2,1) backwards; animation-delay: calc(var(--si) * .18s + 1s); }
        .lpp-stack-a:first-child { margin-inline-start: 0; }
        .lpp-stack-more { margin-inline-start: 6px; font-family: var(--fd); font-weight: 700; font-size: 11px; color: #CFE0F3; }

        /* ---- premium CTAs ---- */
        .lpp-cta-primary, .lpp-cta-ghost { transition: transform .18s cubic-bezier(.2,.7,.2,1), box-shadow .18s, background .16s, border-color .16s; will-change: transform; }
        .lpp-cta-primary:hover { transform: translateY(-2px); box-shadow: 0 20px 34px -16px rgba(224,133,46,.95); }
        .lpp-cta-primary:active { transform: translateY(0); }
        .lpp-cta-ghost:hover { transform: translateY(-2px); border-color: var(--blue); color: var(--blue); box-shadow: var(--sh-s); }
        .lpp-cta-primary:focus-visible, .lpp-cta-ghost:focus-visible { outline: 3px solid var(--blue); outline-offset: 3px; }
        .lpp-cta-primary .ic, .lpp-cta-ghost .ic { transition: transform .2s; }
        .lpp-cta-primary:hover .ic { transform: translateX(3px); }
        html[dir="rtl"] .lpp-cta-primary:hover .ic { transform: translateX(-3px); }

        /* ---- feature cards ---- */
        .lpp-feature { transition: transform .2s cubic-bezier(.2,.7,.2,1), box-shadow .2s, border-color .2s; will-change: transform; }
        .lpp-feature:hover { transform: translateY(-4px); box-shadow: var(--sh); border-color: var(--lineCool); }
        .lpp-feature-ic { transition: transform .25s cubic-bezier(.2,.7,.2,1); }
        .lpp-feature:hover .lpp-feature-ic { transform: scale(1.08) rotate(-3deg); }

        /* ---- stepper ---- */
        .lpp-steps { position: relative; }
        .lpp-step { position: relative; transition: transform .2s; }
        .lpp-step:hover { transform: translateY(-3px); }
        .lpp-node {
          width: 46px; height: 46px; border-radius: 14px; background: var(--ink); color: #fff;
          display: grid; place-items: center; font-family: var(--fd); font-size: 20px; font-weight: 700;
          box-shadow: var(--sh-s); position: relative; z-index: 2;
        }
        .lpp-connector { position: absolute; inset-block-start: 23px; z-index: 0; height: 2px; background: repeating-linear-gradient(90deg, var(--line) 0 7px, transparent 7px 14px); }

        /* ---- money panel breakdown bar ---- */
        .lpp-split { height: 12px; border-radius: 999px; overflow: hidden; display: flex; background: rgba(255,255,255,.16); }
        .lpp-split-you { background: linear-gradient(90deg,#54D6AC,#1B9C6F); width: 0; transition: width 1.1s cubic-bezier(.2,.7,.2,1) .15s; }
        .lpp-split-fee { background: rgba(255,255,255,.30); flex: 1; }
        .lpp-split.is-in .lpp-split-you { width: 88%; }

        /* ---- quote / stat / faq / cross micro ---- */
        .lpp-quote { transition: transform .2s, box-shadow .2s; }
        .lpp-quote:hover { transform: translateY(-3px); box-shadow: var(--sh); }
        .lpp-stat { transition: transform .2s; }
        .lpp-stat:hover { transform: translateY(-2px); }
        .lpp-faq { transition: box-shadow .2s, border-color .2s; }
        .lpp-faq.is-open { box-shadow: var(--sh-s); border-color: var(--lineCool); }
        .lpp-faq-btn:focus-visible { outline: 3px solid var(--blue); outline-offset: -3px; border-radius: var(--r-l); }
        .lpp-faq-wrap { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .28s cubic-bezier(.2,.7,.2,1); }
        .lpp-faq-wrap[data-open="true"] { grid-template-rows: 1fr; }
        .lpp-faq-inner { overflow: hidden; }
        .lpp-cross { transition: background .16s, transform .16s; }
        .lpp-cross:hover { background: #DCE9F7; transform: translateY(-1px); }
        .lpp-cross-arrow { transition: transform .18s; }
        .lpp-cross:hover .lpp-cross-arrow { transform: translateX(3px); }
        html[dir="rtl"] .lpp-cross:hover .lpp-cross-arrow { transform: translateX(-3px); }
        .lpp-pay-badge { transition: transform .16s, box-shadow .16s; }
        .lpp-pay-badge:hover { transform: translateY(-2px); box-shadow: var(--sh); }

        /* ---- final CTA glow ---- */
        .lpp-final { position: relative; overflow: hidden; }
        .lpp-final::after {
          content: ""; position: absolute; inset-block-start: -40%; inset-inline-start: 50%; translate: -50% 0;
          width: 70%; height: 70%; border-radius: 999px; pointer-events: none; z-index: 0;
          background: radial-gradient(circle, rgba(243,194,75,.30), transparent 70%);
          animation: lpp-glow 7s ease-in-out infinite;
        }
        .lpp-final > * { position: relative; z-index: 1; }
        .lpp-bolt { animation: lpp-float 5s ease-in-out infinite; }

        /* ---- reduced motion: freeze everything to final state ---- */
        @media (prefers-reduced-motion: reduce) {
          .lpp-reveal { opacity: 1 !important; transform: none !important; transition: none !important; }
          .lpp-rise, .lpp-phone-wrap, .lpp-glow, .lpp-wash, .lpp-live, .lpp-live-dot,
          .lpp-seat, .lpp-payout, .lpp-stack-a, .lpp-bolt, .lpp-final::after {
            animation: none !important;
          }
          .lpp-seat { opacity: 1; transform: translate(var(--sx), var(--sy)); }
          .lpp-payout-a { opacity: 1; }
          .lpp-payout-b { display: none; }
          .lpp-split-you { transition: none; }
        }
      `,
        }}
      />

      {/* ═══ HERO ═══ */}
      <section
        className="web-section"
        style={{
          paddingTop: "clamp(20px,4vw,52px)",
          paddingBottom: "clamp(40px,6vw,84px)",
        }}
      >
        <div className="container">
          {/* cross-link near the top */}
          <div style={{ marginBottom: "clamp(18px,3vw,28px)" }}>
            <CrossLink label={c.crossTop} />
          </div>

          <div className="web-hero">
            {/* LEFT — copy + CTAs */}
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              <Reveal
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <span className="web-eyebrow">{c.eyebrow}</span>
                <span
                  className="chip lpp-live"
                  style={{ background: "var(--green)", color: "#fff", gap: 6 }}
                >
                  <span className="lpp-live-dot" aria-hidden="true" />
                  {c.live}
                </span>
              </Reveal>

              <Reveal delay={70} as="h1" className="web-h1">
                {c.h1a}
                <br />
                <span style={{ color: "var(--blue)" }}>{c.h1b}</span>
                <br />
                <span style={{ color: "var(--green)" }}>{c.h1c}</span>
              </Reveal>

              <Reveal
                delay={140}
                as="p"
                className="web-lead"
                style={{ maxWidth: 520 }}
              >
                {c.sub}
              </Reveal>

              <Reveal delay={210} className="cluster" style={{ gap: 14 }}>
                <Link
                  href="/onboarding"
                  className="btn btn-primary btn-sm lpp-cta-primary"
                  style={{
                    width: "auto",
                    paddingInline: 26,
                    paddingBlock: 15,
                    fontSize: 15.5,
                  }}
                >
                  {c.ctaPrimary}
                  <Forward style={{ width: 18, height: 18 }} />
                </Link>
                <Link
                  href="/yassine-math"
                  className="btn btn-ghost btn-sm lpp-cta-ghost"
                  style={{
                    width: "auto",
                    paddingInline: 24,
                    paddingBlock: 15,
                    fontSize: 15,
                  }}
                >
                  {c.ctaGhost}
                </Link>
              </Reveal>

              <Reveal
                delay={280}
                as="p"
                style={{
                  fontSize: 12.5,
                  color: "var(--muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <Check
                  style={{ width: 15, height: 15, color: "var(--green)" }}
                />
                {c.micro}
              </Reveal>
            </div>

            {/* RIGHT — animated composite storefront scene */}
            <HeroScene c={c} />
          </div>
        </div>
      </section>

      {/* ═══ SHARE / GROWTH LOOP ═══ */}
      <section className="web-section tight">
        <div className="container">
          <Reveal
            className="panel panel-pad"
            style={{
              display: "grid",
              gap: "clamp(18px,3vw,32px)",
              gridTemplateColumns: "1fr",
              alignItems: "center",
              borderColor: "var(--lineCool)",
              background: "var(--blue50)",
            }}
            data-lpp-share="true"
          >
            {/* left — the message */}
            <div>
              <div
                className="web-eyebrow"
                style={{
                  marginBottom: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Share style={{ width: 15, height: 15 }} />
                {c.shareEyebrow}
              </div>
              <h2 className="web-h2" style={{ marginBottom: 12 }}>
                {c.shareTitle}
              </h2>
              <p
                className="web-lead"
                style={{ marginBottom: 18, maxWidth: 560 }}
              >
                {c.shareBody}
              </p>

              {/* channel chips */}
              <div className="cluster" style={{ gap: 10 }}>
                {c.shareChannels.map((ch) => (
                  <span
                    key={ch}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      fontFamily: "var(--fd)",
                      fontWeight: 700,
                      fontSize: 13.5,
                      color: "var(--blue)",
                      background: "var(--paper)",
                      border: "1px solid var(--line)",
                      borderRadius: 999,
                      padding: "8px 14px",
                      boxShadow: "var(--sh-s)",
                    }}
                  >
                    <Forward style={{ width: 14, height: 14 }} />
                    {ch}
                  </span>
                ))}
              </div>
            </div>

            {/* right — the shareable link mock */}
            <div
              className="zellige hero-blue"
              style={{
                borderRadius: "var(--r-l)",
                padding: "clamp(18px,2.6vw,26px)",
                boxShadow: "var(--sh-l), 0 30px 60px -40px rgba(14,90,166,.55)",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "#CFE0F3",
                  fontWeight: 600,
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <Share style={{ width: 15, height: 15 }} />
                {c.shareLinkLabel}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "rgba(255,255,255,.12)",
                  border: "1px solid rgba(255,255,255,.16)",
                  borderRadius: 12,
                  padding: "12px 14px",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--fd)",
                    fontWeight: 700,
                    fontSize: "clamp(15px,2.6vw,18px)",
                    color: "#fff",
                    direction: "ltr",
                    unicodeBidi: "plaintext",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {c.shareLinkExample}
                </span>
                <span
                  className="chip"
                  aria-hidden="true"
                  style={{
                    marginInlineStart: "auto",
                    background: "var(--ochre)",
                    color: "#fff",
                    fontSize: 11,
                    gap: 5,
                    flexShrink: 0,
                  }}
                >
                  <Forward style={{ width: 13, height: 13 }} />
                  {c.shareEyebrow}
                </span>
              </div>
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {c.shareChannels.map((ch) => (
                  <span
                    key={ch}
                    style={{
                      fontFamily: "var(--fd)",
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: "#fff",
                      background: "rgba(255,255,255,.12)",
                      border: "1px solid rgba(255,255,255,.16)",
                      borderRadius: 999,
                      padding: "5px 11px",
                    }}
                  >
                    {ch}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ INCOME ANCHOR ═══ */}
      <section
        className="web-section tight"
        style={{
          background: "rgba(255,255,255,.55)",
          borderTop: "1px solid var(--line)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div className="container">
          <div
            style={{
              display: "grid",
              gap: "clamp(20px,3vw,40px)",
              gridTemplateColumns: "1fr",
              alignItems: "center",
            }}
            data-lpp-income="true"
          >
            {/* left: the math */}
            <Reveal>
              <div className="web-eyebrow" style={{ marginBottom: 10 }}>
                {c.incomeEyebrow}
              </div>
              <p className="web-lead" style={{ marginBottom: 18 }}>
                {c.incomeLead}
              </p>

              {/* equation chips */}
              <div className="cluster" style={{ gap: 10, marginBottom: 18 }}>
                {[
                  {
                    ic: <Users style={{ width: 16, height: 16 }} />,
                    txt: c.inStudents,
                  },
                  {
                    ic: <Video style={{ width: 16, height: 16 }} />,
                    txt: c.inSessions,
                  },
                  {
                    ic: <Wallet style={{ width: 16, height: 16 }} />,
                    txt: c.inPrice,
                  },
                ].map((x, i) => (
                  <React.Fragment key={i}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        background: "var(--paper)",
                        border: "1px solid var(--line)",
                        borderRadius: 12,
                        padding: "10px 14px",
                        fontFamily: "var(--fd)",
                        fontWeight: 700,
                        fontSize: 14.5,
                        color: "var(--ink)",
                        boxShadow: "var(--sh-s)",
                      }}
                    >
                      <span
                        style={{ color: "var(--blue)", display: "inline-flex" }}
                      >
                        {x.ic}
                      </span>
                      {x.txt}
                    </span>
                    {i < 2 && (
                      <span
                        aria-hidden="true"
                        style={{
                          fontFamily: "var(--fd)",
                          fontWeight: 700,
                          color: "var(--muted)",
                          fontSize: 18,
                        }}
                      >
                        ·
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </div>

              <PayChips />
            </Reveal>

            {/* right: result panel */}
            <IncomePanel c={c} />
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section className="web-section">
        <div className="container">
          <SectionHead eyebrow={c.featEyebrow} title={c.featTitle} />
          <div className="grid-2">
            {[
              {
                icon: <Share />,
                bg: "var(--blue50)",
                fg: "var(--blue)",
                t: c.f1t,
                b: c.f1b,
              },
              {
                icon: <Wallet />,
                bg: "var(--green50)",
                fg: "var(--green)",
                t: c.f2t,
                b: c.f2b,
              },
              {
                icon: <Video />,
                bg: "#FFF4DF",
                fg: "var(--ochre)",
                t: c.f3t,
                b: c.f3b,
              },
              {
                icon: <Book />,
                bg: "var(--blue50)",
                fg: "var(--blue)",
                t: c.f4t,
                b: c.f4b,
              },
            ].map((f, i) => (
              <Reveal key={i} delay={i * 80}>
                <FeatureCard
                  icon={f.icon}
                  bg={f.bg}
                  fg={f.fg}
                  title={f.t}
                  body={f.b}
                />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section
        className="web-section"
        style={{
          background: "rgba(255,255,255,.55)",
          borderTop: "1px solid var(--line)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div className="container">
          <SectionHead eyebrow={c.howEyebrow} title={c.howTitle} center />
          <div
            className="grid-3 lpp-steps"
            style={{
              marginBottom: "clamp(28px,4vw,44px)",
              position: "relative",
            }}
          >
            {/* connector behind the nodes (desktop only — set via responsive CSS) */}
            <div
              className="lpp-connector lpp-connector-line"
              aria-hidden="true"
            />
            {[
              { n: 1, t: c.s1t, b: c.s1b },
              { n: 2, t: c.s2t, b: c.s2b },
              { n: 3, t: c.s3t, b: c.s3b },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 110}>
                <div
                  className="panel panel-pad lpp-step"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    height: "100%",
                  }}
                >
                  <div className="lpp-node" aria-hidden="true">
                    {s.n}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--fd)",
                      fontWeight: 700,
                      fontSize: 17,
                    }}
                  >
                    {s.t}
                  </div>
                  <p
                    style={{
                      fontSize: 14,
                      color: "var(--ink2)",
                      lineHeight: 1.6,
                    }}
                  >
                    {s.b}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal style={{ display: "flex", justifyContent: "center" }}>
            <Link
              href="/onboarding"
              className="btn btn-primary btn-sm lpp-cta-primary"
              style={{
                width: "auto",
                paddingInline: 28,
                paddingBlock: 15,
                fontSize: 15.5,
              }}
            >
              {c.ctaPrimary}
              <Forward style={{ width: 18, height: 18 }} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══ SOCIAL PROOF ═══ */}
      <section className="web-section">
        <div className="container">
          <SectionHead eyebrow={c.proofEyebrow} title={c.proofTitle} center />

          {/* stats band */}
          <Reveal
            className="panel lpp-stat-band"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "clamp(8px,3vw,24px)",
              justifyContent: "center",
              alignItems: "center",
              padding: "clamp(20px,3vw,30px) clamp(16px,4vw,40px)",
              marginBottom: "clamp(28px,4vw,44px)",
            }}
          >
            {[
              { v: "+1 240", l: c.statStudents, color: "var(--blue)" },
              { v: "4.9 ★", l: c.statRating, color: "var(--amber)" },
              { v: "180", l: c.statTutors, color: "var(--green)" },
            ].map((s, i) => (
              <React.Fragment key={s.l}>
                {i > 0 && (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 1,
                      alignSelf: "stretch",
                      background: "var(--line)",
                      minHeight: 38,
                    }}
                  />
                )}
                <div
                  className="lpp-stat"
                  style={{ textAlign: "center", flex: "1 1 110px" }}
                >
                  <div
                    style={{
                      fontFamily: "var(--fd)",
                      fontSize: "clamp(30px,5vw,44px)",
                      fontWeight: 700,
                      letterSpacing: "-1px",
                      color: s.color,
                      lineHeight: 1,
                    }}
                  >
                    {s.v}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--muted)",
                      marginTop: 6,
                      fontWeight: 600,
                    }}
                  >
                    {s.l}
                  </div>
                </div>
              </React.Fragment>
            ))}
          </Reveal>

          <div className="grid-3">
            {[
              { q: c.t1, n: c.t1n, m: c.t1m, ini: "ي" },
              { q: c.t2, n: c.t2n, m: c.t2m, ini: "إ" },
              { q: c.t3, n: c.t3n, m: c.t3m, ini: "إ" },
            ].map((t, i) => (
              <Reveal key={i} delay={i * 90}>
                <Testimonial
                  quote={t.q}
                  name={t.n}
                  meta={t.m}
                  initials={t.ini}
                />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section
        className="web-section"
        style={{
          background: "rgba(255,255,255,.55)",
          borderTop: "1px solid var(--line)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div className="container container-narrow">
          <SectionHead eyebrow={c.faqEyebrow} title={c.faqTitle} center />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { q: c.q1, a: c.a1, open: true },
              { q: c.q2, a: c.a2, open: false },
              { q: c.q3, a: c.a3, open: false },
            ].map((f, i) => (
              <Reveal key={i} delay={i * 80}>
                <FaqItem q={f.q} a={f.a} defaultOpen={f.open} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="web-section">
        <div className="container">
          <Reveal
            className="panel panel-pad zellige hero-blue lpp-final"
            style={{
              border: "none",
              textAlign: "center",
              padding: "clamp(36px,6vw,72px) clamp(20px,4vw,48px)",
              boxShadow: "var(--sh-l), 0 40px 80px -44px rgba(14,90,166,.6)",
            }}
          >
            <div style={{ display: "inline-flex", marginBottom: 18 }}>
              <span
                className="lpp-bolt"
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 18,
                  background: "var(--ochre)",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  boxShadow: "0 18px 30px -12px rgba(224,133,46,.95)",
                }}
              >
                <Bolt />
              </span>
            </div>
            <h2 className="web-h2" style={{ color: "var(--blue)", marginBottom: 8 }}>
              {c.finalTitle}
            </h2>
            <p
              className="web-lead"
              style={{
                color: "var(--ink2)",
                marginBottom: 26,
                maxWidth: 520,
                marginInline: "auto",
              }}
            >
              {c.finalSub}
            </p>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Link
                href="/onboarding"
                className="btn btn-primary lpp-cta-primary"
                style={{
                  width: "auto",
                  paddingInline: 32,
                  paddingBlock: 16,
                  fontSize: 16,
                }}
              >
                {c.ctaPrimary}
                <Forward style={{ width: 18, height: 18 }} />
              </Link>
            </div>
            <p
              style={{
                fontSize: 12.5,
                color: "var(--blue700)",
                marginTop: 18,
                display: "flex",
                alignItems: "center",
                gap: 8,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <Shield style={{ width: 15, height: 15, color: "var(--green)" }} />
              {c.finalReassure}
            </p>
          </Reveal>

          {/* cross-link near the footer */}
          <div style={{ marginTop: "clamp(24px,4vw,40px)" }}>
            <CrossLink label={c.crossBottom} align="center" />
          </div>
        </div>
      </section>

      {/* responsive: income grid → 2 cols on desktop + stepper connector */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media (min-width: 880px) {
          [data-lpp-income="true"] { grid-template-columns: 1.1fr .9fr; }
          [data-lpp-share="true"] { grid-template-columns: 1.15fr .85fr; }
        }
        /* stepper connector spans the row only when it's a 3-col grid */
        .lpp-connector-line { display: none; }
        @media (min-width: 1000px) {
          .lpp-connector-line { display: block; inset-inline-start: 16%; inset-inline-end: 16%; }
        }
      `,
        }}
      />
    </SiteShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sub-component: income result panel (confident money panel with split bar).
   Animates the 88% split bar when it scrolls into view.
   ═══════════════════════════════════════════════════════════════════════════ */
function IncomePanel({ c }: { c: Copy }) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`panel panel-pad zellige hero-blue lpp-reveal ${shown ? "is-in" : ""}`}
      style={{ border: "none", position: "relative", overflow: "hidden" }}
    >
      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            fontSize: 12.5,
            color: "var(--blue)",
            fontWeight: 600,
            marginBottom: 6,
          }}
        >
          {c.inGross}
        </div>
        <div
          style={{
            fontFamily: "var(--fd)",
            fontSize: 13,
            color: "var(--ink)",
            fontWeight: 600,
            marginBottom: 4,
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          <Wallet style={{ width: 16, height: 16 }} />
          {c.inKeepLbl}
        </div>
        <div
          style={{
            fontFamily: "var(--fd)",
            fontSize: "clamp(40px,6vw,56px)",
            fontWeight: 700,
            letterSpacing: "-1.6px",
            color: "var(--ochre)",
            lineHeight: 1,
          }}
        >
          {c.inKeep}
        </div>

        {/* 88/12 split bar */}
        <div style={{ marginTop: 18 }}>
          <div className={`lpp-split ${shown ? "is-in" : ""}`}>
            <span className="lpp-split-you" />
            <span className="lpp-split-fee" />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 8,
              fontFamily: "var(--fd)",
              fontWeight: 700,
              fontSize: 11.5,
            }}
          >
            <span
              style={{
                color: "#1B9C6F",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: "#1B9C6F",
                }}
              />
              {c.inYou}
            </span>
            <span style={{ color: "var(--ink2)" }}>{c.inFee}</span>
          </div>
        </div>

        <div
          className="trust flex flex-row items-center "
          style={{
            marginTop: 18,
            background: "rgba(255,255,255,.12)",
            position: "relative",
            zIndex: 2,
            
          }}
        >
          <Shield style={{ color: "var(--green)" }} />
          <p style={{ color: "var(--ink)" }}>{c.inWithdraw}</p>
        </div>
      </div>
    </div>
  );
}
