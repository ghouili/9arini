"use client";
/* ───────────────────────────────────────────────────────────────────────────
   /pour-les-profs — 9arini TUTOR (teacher) landing page.
   "Shopify for Tunisian tutors": branded page, live classes, you set your price.
   FREE PILOT: 9arini processes no money. The student pays the tutor DIRECTLY,
   off-platform; we take 0 % commission and issue no payouts. Online payment +
   the 12 % platform fee are "bientôt" only — never stated as current features.
   Self-contained: bilingual copy (FR + Tunisian Derija) lives in `copy` below.
   Uses the app design system (globals.css tokens + utility classes), SiteShell,
   useLocale. One primary CTA everywhere → /onboarding. RTL-safe (logical props).

   VISUAL/MOTION PASS: hero is now a composite animated storefront scene
   (floating phone + class filling + LIVE + example count-up + booking chips);
   every section is elevated with scroll-reveal, depth, and refined micro-motion.
   All page-scoped CSS is prefixed `lpp-` and lives in the inline <style> blocks.
   Honors prefers-reduced-motion (static final state, no motion).
   ─────────────────────────────────────────────────────────────────────────── */
import React, { useEffect, useRef, useState } from "react";
import { Link } from "@/components/Link";
import { SiteShell } from "@/components/SiteShell";
import { useLocale } from "@/components/LocaleProvider";
import {
  Wallet,
  Video,
  Share,
  Shield,
  Check,
  Star,
  Users,
  Bolt,
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
    h1c: "Tu gardes 100 %.",
    sub: "Ta boutique de prof, gérée depuis ton téléphone.",
    ctaPrimary: "Crée ta page de prof",
    ctaGhost: "Voir les profs sur 9arini",
    micro: "Gratuit. Sans carte. Zéro commission.",
    pilotChip: "Pilote — on lance",

    // share / growth loop
    shareEyebrow: "Ton lien, ta pub",
    shareTitle: "Un lien à toi. Partage-le, les élèves arrivent.",
    shareBody:
      "Colle ton lien sur WhatsApp, TikTok ou Insta. Chaque partage t'amène des élèves.",
    shareChannels: ["WhatsApp", "TikTok", "Instagram", "Facebook"],
    shareLinkLabel: "Ton lien",
    shareLinkExample: "9arini.tn/ta-page",
    // hero phone (illustration — pas de vraies données)
    phoneName: "Ta page de prof",
    phoneSubject: "Maths · primaire → Bac",
    live: "EN DIRECT",
    balanceLbl: "Exemple — ce mois-ci",
    tnd: "TND",
    sessionTitle: "Intégrales — révision express",
    sessionMeta: "Sam 14h · 90 min",
    free1st: "1er cours offert",
    heroSceneLabel:
      "Illustration : une page de prof 9arini, avec une classe qui se remplit en direct.",
    booked: "réservé",
    newBooking: "Nouvelle réservation",
    joined: "a rejoint",
    classFilling: "Classe en cours de remplissage",
    phoneBadges: ["1er cours offert", "0 % de commission", "Paiement direct"],

    // income anchor
    incomeEyebrow: "Combien tu peux gagner",
    incomeTitle: "Fixe ton tarif, tu gardes tout.",
    incomeLead:
      "Voici un exemple concret — une illustration, pas un plafond :",
    inStudents: "8 élèves",
    inSessions: "2 séances / sem",
    inPrice: "20 TND / séance",
    inGross: "Exemple : 8 élèves × 2 séances × 20 TND",
    inKeepLbl: "Tu gardes, aujourd'hui",
    inKeep: "1 280 TND",
    inWithdraw:
      "Pendant le pilote, l'élève te paie directement, de la main à la main. 9arini ne prend aucune commission et ne touche pas à ton argent. Paiement en ligne : bientôt.",
    inYou: "Toi · 100 %",
    inFee: "9arini · 0 %",
    payBadges: [
      "Tu gardes 100 %",
      "Zéro commission",
      "Paiement en ligne bientôt",
    ],

    // features
    featEyebrow: "Tout ce qu'il te faut",
    featTitle: "Une boutique de prof, prête en 2 minutes",
    f1t: "Ta page brandée",
    f1b: "Ton nom, ta photo, tes matières. Un seul lien à partager partout.",
    f2t: "Ton tarif — tu gardes 100 %",
    f2b: "Tu fixes ton prix, sans plafond. L'élève te paie directement : 9arini ne prend aucune commission.",
    f3t: "Cours en direct",
    f3b: "Lance un cours live, partage l'écran, enregistre. Tout intégré.",
    f4t: "Tes avis d'élèves",
    f4b: "Après chaque séance, ton élève te note. Que de vrais avis — on n'en fabrique aucun.",

    // how it works
    howEyebrow: "Comment ça marche",
    howTitle: "De zéro à ta 1ère réservation ce soir",
    s1t: "Crée ta page",
    s1b: "Nom, matière, photo — deux minutes. On vérifie ton identité à la main, puis ta page passe en ligne.",
    s2t: "Partage ton lien",
    s2b: "WhatsApp, Insta, TikTok. Tes élèves réservent en un clic.",
    s3t: "Donne ton 1er cours",
    s3b: "La 1ère séance est offerte à l'élève. Ensuite, il te paie directement — 9arini ne prend rien.",

    // founding tutors — pre-launch, zero users: no stats, no testimonials
    proofEyebrow: "Profs fondateurs",
    proofTitle: "On lance. Sois parmi les premiers profs.",
    proofLead:
      "9arini démarre : aucun cours donné, aucun avis, aucun chiffre à te gonfler. Juste une place à prendre avant tout le monde.",
    statCommissionVal: "0 %",
    statCommission: "de commission, aujourd'hui",
    statYoursVal: "100 %",
    statYours: "de ton tarif, pour toi",
    statSetupVal: "2 min",
    statSetup: "pour te lancer",
    fd1t: "Ta page avant les autres",
    fd1b: "Tu arrives sur une plateforme neuve. Ton lien, ta page, zéro bruit autour de toi.",
    fd2t: "Zéro commission pendant le pilote",
    fd2b: "L'élève te paie directement, de la main à la main. 9arini ne touche pas à ton argent.",
    fd3t: "On construit avec toi",
    fd3b: "Dis-nous ce qui manque : pendant le pilote, l'avis des premiers profs pèse lourd.",

    // faq
    faqEyebrow: "Avant de te lancer",
    faqTitle: "Les questions qu'on nous pose",
    q1: "Combien 9arini prend ?",
    a1: "Rien, aujourd'hui. Pendant le pilote, tu gardes 100 % : l'élève te paie directement, 9arini ne touche pas à l'argent. Quand le paiement en ligne arrivera, une commission de 12 % s'appliquera — et on te préviendra avant.",
    q2: "Si un élève ne vient pas ?",
    a2: "Tu es prévenu et tu peux replanifier. Comme rien ne passe par 9arini, l'arrangement se fait directement entre toi et l'élève.",
    q3: "Faut-il un diplôme ?",
    a3: "Non. Maîtrise ta matière, une bonne connexion, et tu démarres aujourd'hui. On vérifie ton identité à la main avant que ta page soit publiée.",

    // final
    finalTitle: "Ta page de prof t'attend.",
    finalSub: "Crée-la en 2 minutes.",
    finalReassure: "Gratuit · sans carte · zéro commission · supprimable à tout moment.",

    crossBottom: "Tu es élève ? Trouve ton prof",
  },
  ar: {
    crossTop: "إنتي تلميذ ؟",
    eyebrow: "للأساتذة",
    h1a: "صفحتك متاع أستاذ.",
    h1b: "دروسك مباشرة.",
    h1c: "وتحتفظ بـ 100 %.",
    sub: "بوتيك متاع أستاذ، تسيّرها الكل من تيليفونك.",
    ctaPrimary: "اعمل صفحتك متاع أستاذ",
    ctaGhost: "شوف الأساتذة في 9arini",
    micro: "فابور. بلا كارت. بلا عمولة.",
    pilotChip: "تجربة — توّا نبداو",

    // share / growth loop
    shareEyebrow: "اللينك متاعك، هو الرﭬلام متاعك",
    shareTitle: "لينك خاص بيك. شاركو، والتلامذة يجيو.",
    shareBody:
      "الصق اللينك متاعك في واتساب، تيكتوك ولا إنستا. كل مشاركة تجيبلك تلامذة.",
    shareChannels: ["واتساب", "تيكتوك", "إنستا", "فايسبوك"],
    shareLinkLabel: "اللينك متاعك",
    shareLinkExample: "9arini.tn/صفحتك",
    // hero phone (مثال توضيحي — موش معطيات حقيقية)
    phoneName: "صفحتك متاع أستاذ",
    phoneSubject: "رياضيات · من الابتدائي للباك",
    live: "مباشر",
    balanceLbl: "مثال — هذا الشهر",
    tnd: "دينار",
    sessionTitle: "التكامل — مراجعة سريعة",
    sessionMeta: "السبت 14س · 90 دقيقة",
    free1st: "أول درس فابور",
    heroSceneLabel:
      "رسم توضيحي : صفحة أستاذ في 9arini، والقسم يتعمّر مباشرة.",
    booked: "محجوز",
    newBooking: "حجز جديد",
    joined: "دخل",
    classFilling: "القسم في طور التعمير",
    phoneBadges: ["أول درس فابور", "0 % عمولة", "خلاص مباشر"],

    // income anchor
    incomeEyebrow: "قداش تنجم تربح",
    incomeTitle: "حدّد تعريفتك، وتحتفظ بالكل.",
    incomeLead:
      "هاذا مثال ملموس — توضيح برك، موش سقف :",
    inStudents: "8 تلامذة",
    inSessions: "حصتين / جمعة",
    inPrice: "20 دينار / حصة",
    inGross: "مثال : 8 تلامذة × حصتين × 20 دينار",
    inKeepLbl: "تحتفظ بيه، اليوم",
    inKeep: "1 280 دينار",
    inWithdraw:
      "في فترة التجربة، التلميذ يخلّصك مباشرة، يد بيد. 9arini ما تاخذ حتى عمولة وما تلمسش فلوسك. الخلاص أونلاين : قريب.",
    inYou: "إنتي · 100 %",
    inFee: "9arini · 0 %",
    payBadges: [
      "تحتفظ بـ 100 %",
      "بلا عمولة",
      "الخلاص أونلاين قريب",
    ],

    // features
    featEyebrow: "الكل اللي تحتاجو",
    featTitle: "بوتيك متاع أستاذ، حاضرة في دقيقتين",
    f1t: "صفحتك بإسمك",
    f1b: "إسمك، تصويرتك، موادك. لينك وحيد تنجم تبعثو في كل بلاصة.",
    f2t: "ثمنك إنتي — وتحتفظ بـ 100 %",
    f2b: "إنتي تحدّد ثمنك، بلا سقف. التلميذ يخلّصك مباشرة : 9arini ما تاخذ حتى عمولة.",
    f3t: "دروس مباشرة",
    f3b: "ابدا درس مباشر، شارك الإيكران، سجّل. الكل داخل المنصة.",
    f4t: "آراء تلامذتك",
    f4b: "بعد كل حصة، التلميذ ينقّطك. آراء حقيقية برك — ما نخترعو والو.",

    // how it works
    howEyebrow: "كيفاش يخدم",
    howTitle: "من الصفر لأول حجز متاعك الليلة",
    s1t: "اعمل صفحتك",
    s1b: "إسم، مادة، تصويرة — دقيقتين. نتثبّتو من هويتك بيدينا، ومن بعد صفحتك تولّي أونلاين.",
    s2t: "شارك اللينك متاعك",
    s2b: "واتساب، إنستا، تيكتوك. تلامذتك يحجزو بكليكة.",
    s3t: "اعطي أول درس",
    s3b: "أول حصة فابور للتلميذ. وبعدها يخلّصك مباشرة — 9arini ما تاخذ والو.",

    // الأساتذة المؤسّسين — قبل الإطلاق: لا أرقام لا شهادات
    proofEyebrow: "أساتذة مؤسّسين",
    proofTitle: "توّا نبداو. كون من الأساتذة الأوائل.",
    proofLead:
      "9arini تبدا توّا : حتى درس ما تعطا، حتى رأي ما فما، وحتى رقم ما باش نكبّروه عليك. برك بلاصة تاخذها قبل الكل.",
    statCommissionVal: "0 %",
    statCommission: "عمولة، اليوم",
    statYoursVal: "100 %",
    statYours: "من تعريفتك، ليك إنتي",
    statSetupVal: "دقيقتين",
    statSetup: "باش تنطلق",
    fd1t: "صفحتك قبل الكل",
    fd1b: "تجي لمنصة جديدة. اللينك متاعك، صفحتك، بلا زحمة حواليك.",
    fd2t: "بلا عمولة في فترة التجربة",
    fd2b: "التلميذ يخلّصك مباشرة، يد بيد. 9arini ما تلمسش فلوسك.",
    fd3t: "نبنيوها معاك",
    fd3b: "قلّنا شنوّة ناقص : في فترة التجربة، رأي الأساتذة الأوائل يزن برشة.",

    // faq
    faqEyebrow: "قبل ما تبدا",
    faqTitle: "الأسئلة اللي يسقسيونا عليها",
    q1: "قدّاش تاخذ 9arini ؟",
    a1: "والو، اليوم. في فترة التجربة تحتفظ بـ 100 % : التلميذ يخلّصك مباشرة، و9arini ما تلمسش الفلوس. كي يجي الخلاص أونلاين، باش تولّي فما عمولة 12 % — ونعلموك قبل.",
    q2: "كان التلميذ ما جاش ؟",
    a2: "تتعلّم بيها وتنجّم تبدّل الوقت. وبما إلي حتى حاجة ما تعدّي من 9arini، الاتفاق يكون مباشرة بيناتكم.",
    q3: "يلزم شهادة ؟",
    a3: "لا. اتقن مادتك، كنكسيون مليحة، وتبدا اليوم. نتثبّتو من هويتك بيدينا قبل ما تتنشر صفحتك.",

    // final
    finalTitle: "صفحتك متاع أستاذ تستنّى فيك.",
    finalSub: "اعملها في دقيقتين.",
    finalReassure: "فابور · بلا كارت · بلا عمولة · تنجم تمسحها وقتلي تحب.",

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
     • illustrative monthly-earnings count-up, explicitly labelled "Exemple"
       (money the STUDENT pays the tutor directly — never a 9arini balance/payout)
     • booking chips drifting upward ("Nouvelle réservation") — bookings, not payouts
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

      {/* drifting booking chips (decorative) — bookings, never payouts */}
      <div className="lpp-payouts" aria-hidden="true">
        <span className="lpp-payout lpp-payout-a">
          <Check style={{ width: 13, height: 13 }} /> {c.newBooking}
        </span>
        <span className="lpp-payout lpp-payout-b">
          <Check style={{ width: 13, height: 13 }} /> {c.free1st} · {c.booked}
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

            {/* trust row — pilot truths, no payment rails */}
            <div
              style={{
                marginTop: "auto",
                display: "flex",
                gap: 7,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              {c.phoneBadges.map((p) => (
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
   Sub-component: pilot trust chips (text badges).
   NOT payment rails — 9arini processes no money during the free pilot.
   ═══════════════════════════════════════════════════════════════════════════ */
function PayChips({ c }: { c: Copy }) {
  const colors = ["var(--green)", "var(--blue)", "var(--ochre)"];
  const items = c.payBadges.map((name, i) => ({ name, color: colors[i] }));
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

        /* ---- money panel breakdown bar (pilot: tutor keeps 100 %, 9arini takes 0 %) ----
           GPU-friendly reveal: the fill scales on X (transform, not width) so low-end
           Android doesn't reflow every frame; the track shows the (0 %) remainder.
           transform-origin flips for RTL, matching the file's other dir overrides. ---- */
        .lpp-split { position: relative; height: 12px; border-radius: 999px; overflow: hidden; background: rgba(255,255,255,.18); }
        .lpp-split-you {
          position: absolute; inset-block: 0; inset-inline-start: 0; width: 100%;
          background: linear-gradient(90deg,#54D6AC,#1B9C6F);
          transform: scaleX(0); transform-origin: left; will-change: transform;
          transition: transform 1.1s cubic-bezier(.2,.7,.2,1) .15s;
        }
        html[dir="rtl"] .lpp-split-you { transform-origin: right; }
        .lpp-split.is-in .lpp-split-you { transform: scaleX(1); }

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
                {/* Pre-launch, not "live activity" — we claim newness, not traffic. */}
                <span
                  className="chip lpp-live"
                  style={{ background: "var(--green)", color: "#fff", gap: 6 }}
                >
                  <span className="lpp-live-dot" aria-hidden="true" />
                  {c.pilotChip}
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
                  href="/explore"
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
              <h2 className="web-h2" style={{ marginBottom: 12 }}>
                {c.incomeTitle}
              </h2>
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

              <PayChips c={c} />
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
                icon: <Star />,
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

      {/* ═══ FOUNDING TUTORS ═══════════════════════════════════════════════
          Pre-launch: zero lessons taught, zero tutors, zero reviews. No
          testimonials, no user counts, no average rating. The band below shows
          only structural facts we control (0 % commission, you keep 100 %,
          2-minute setup), and the cards sell being early.
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="web-section">
        <div className="container">
          <SectionHead eyebrow={c.proofEyebrow} title={c.proofTitle} center />

          <Reveal
            as="p"
            className="web-lead"
            style={{
              textAlign: "center",
              maxWidth: 620,
              marginInline: "auto",
              marginBottom: "clamp(22px,3.5vw,34px)",
            }}
          >
            {c.proofLead}
          </Reveal>

          {/* facts band — promises we control, not metrics we claim to have earned */}
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
              { v: c.statCommissionVal, l: c.statCommission, color: "var(--green)" },
              { v: c.statYoursVal, l: c.statYours, color: "var(--blue)" },
              { v: c.statSetupVal, l: c.statSetup, color: "var(--ochre)" },
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

          {/* why be early — no invented tutors, no invented quotes */}
          <div className="grid-3">
            {[
              {
                icon: <Bolt />,
                bg: "var(--blue50)",
                fg: "var(--blue)",
                t: c.fd1t,
                b: c.fd1b,
              },
              {
                icon: <Wallet />,
                bg: "var(--green50)",
                fg: "var(--green)",
                t: c.fd2t,
                b: c.fd2b,
              },
              {
                icon: <Users />,
                bg: "#FFF4DF",
                fg: "var(--ochre)",
                t: c.fd3t,
                b: c.fd3b,
              },
            ].map((f, i) => (
              <Reveal key={i} delay={i * 90}>
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

          <Reveal
            delay={280}
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: "clamp(26px,4vw,40px)",
            }}
          >
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
              // .panel would otherwise paint this white; force the intended dark
              // cobalt surface (matches the hero phone) so the light text reads.
              background: "linear-gradient(158deg,var(--blue),#082F54)",
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
            <h2 className="web-h2" style={{ color: "#fff", marginBottom: 8 }}>
              {c.finalTitle}
            </h2>
            <p
              className="web-lead"
              style={{
                color: "#CFE0F3",
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
                color: "#CFE0F3",
                marginTop: 18,
                display: "flex",
                alignItems: "center",
                gap: 8,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <Shield style={{ width: 15, height: 15, color: "#54D6AC" }} />
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
   Sub-component: income result panel (illustrative earnings example + split bar).
   Animates the split bar (tutor 100 % / 9arini 0 % during the free pilot).
   ═══════════════════════════════════════════════════════════════════════════ */
function IncomePanel({ c }: { c: Copy }) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`panel panel-pad zellige hero-blue lpp-reveal ${shown ? "is-in" : ""}`}
      style={{
        border: "none",
        position: "relative",
        overflow: "hidden",
        // .panel wins the cascade over hero-blue and would paint this white; force the
        // intended dark cobalt surface so the light text + zellige texture read right.
        background: "linear-gradient(158deg,var(--blue),#082F54)",
        boxShadow: "var(--sh-l), 0 30px 60px -40px rgba(14,90,166,.5)",
      }}
    >
      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            fontSize: 12.5,
            color: "#CFE0F3",
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
            color: "#EAF2FC",
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
            color: "var(--amber)",
            lineHeight: 1,
          }}
        >
          {c.inKeep}
        </div>

        {/* 100 / 0 split bar — no commission during the pilot */}
        <div style={{ marginTop: 18 }}>
          <div className={`lpp-split ${shown ? "is-in" : ""}`}>
            <span className="lpp-split-you" />
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
                color: "#CFE0F3",
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
                  background: "#54D6AC",
                }}
              />
              {c.inYou}
            </span>
            <span style={{ color: "#CFE0F3" }}>{c.inFee}</span>
          </div>
        </div>

        <div
          className="trust"
          style={{
            marginTop: 18,
            background: "rgba(255,255,255,.12)",
            position: "relative",
            zIndex: 2,
          }}
        >
          <Shield style={{ color: "#54D6AC" }} />
          <p style={{ color: "#EAF2FC" }}>{c.inWithdraw}</p>
        </div>
      </div>
    </div>
  );
}
