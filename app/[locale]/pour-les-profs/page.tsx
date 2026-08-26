"use client";
/* ───────────────────────────────────────────────────────────────────────────
   /pour-les-profs — 9arini TUTOR (teacher) landing page.
   "Shopify for Tunisian tutors": branded page, live classes, you set your price.

   FREE PILOT: 9arini processes no money. The student pays the tutor DIRECTLY,
   off-platform; we take 0 % commission and issue no payouts. Online payment +
   the 12 % platform fee are "bientôt" only — never stated as current features.
   Zero lessons taught, zero tutors, zero reviews → no counts, no testimonials,
   no ratings, no earnings claimed as real. The only money figure on the page is
   an arithmetic EXAMPLE, labelled as one.

   SIMPLIFIED PASS: the page used to run seven sections (hero, share loop,
   income, features, how, founding tutors, FAQ, final). A tutor needs five
   answers — free page in 2 minutes · you set your price · you keep 100 % · we
   verify you by hand · you teach live — so it now runs five sections and one
   repeated CTA (→ /onboarding). The hero scene shows the TUTOR'S PAGE, not a
   money counter: what you get, not what you might earn.

   Self-contained: bilingual copy (FR + Tunisian Derija) lives in `copy` below.
   Uses the app design system (globals.css tokens + classes), SiteShell, useLocale.
   RTL-safe (logical properties only). Honors prefers-reduced-motion.
   ─────────────────────────────────────────────────────────────────────────── */
import React, { useEffect, useRef, useState } from "react";
import { Link } from "@/components/Link";
import { SiteShell } from "@/components/SiteShell";
import { useLocale } from "@/components/LocaleProvider";
import { Wallet, Video, Share, Shield, Check, Users, Bolt, Forward } from "@/components/icons";

/* ═══════════════════════════════════════════════════════════════════════════
   COPY — FR + Tunisian Derija (ar). Warm, tutor-first, structurally parallel.
   ═══════════════════════════════════════════════════════════════════════════ */
const copy = {
  fr: {
    crossTop: "Tu es élève ?",
    eyebrow: "Pour les profs",
    h1a: "Ta page de prof.",
    h1b: "Tes cours en direct.",
    h1c: "Tu gardes 100 %.",
    sub: "Crée ta page gratuitement en 2 minutes, fixe ton tarif, et donne tes cours en direct. L'élève te paie directement : 9arini ne prend rien.",
    ctaPrimary: "Crée ta page de prof",
    ctaGhost: "Voir les profs sur 9arini",
    micro: "Gratuit. Sans carte. Zéro commission.",
    pilotChip: "Pilote — on lance",

    // hero phone (illustration — pas de vraies données)
    phoneName: "Ta page de prof",
    phoneSubject: "Maths · primaire → Bac",
    live: "EN DIRECT",
    sessionTitle: "Intégrales — révision express",
    sessionMeta: "Sam 14h · 90 min",
    free1st: "1er cours offert",
    priceExample: "20 TND",
    shareLinkLabel: "Ton lien",
    shareLinkExample: "9arini.tn/ta-page",
    classFilling: "Classe en cours de remplissage",
    phoneBadges: ["0 % de commission", "Paiement direct"],
    heroSceneLabel: "Illustration : une page de prof 9arini — nom, matière, un cours en direct et le lien à partager.",

    // ce que tu obtiens
    featEyebrow: "Ce que tu obtiens",
    featTitle: "Une boutique de prof, prête en 2 minutes",
    f1t: "Ta page, ton lien",
    f1b: "Ton nom, ta matière, tes cours. Un seul lien à coller sur WhatsApp, Insta ou TikTok — c'est là que tes élèves réservent.",
    f2t: "Ton tarif — tu gardes 100 %",
    f2b: "Tu fixes ton prix, cours par cours, sans plafond. L'élève te paie directement : 9arini ne prend aucune commission.",
    f3t: "Vérifié à la main",
    f3b: "On regarde ta pièce d'identité nous-mêmes. Une fois validé, ta page passe en ligne et apparaît dans Explorer — souvent sous 24–48 h.",
    f4t: "Cours en direct",
    f4b: "Lance ta séance, partage l'écran, ajoute ton tableau blanc et ton quiz. Tes élèves entrent en un tap.",

    // comment ça marche
    howEyebrow: "Comment ça marche",
    howTitle: "De zéro à ta 1ʳᵉ réservation",
    s1t: "Crée ta page",
    s1b: "Nom, matière, une phrase sur toi. Deux minutes, sans carte bancaire.",
    s2t: "Fais-toi vérifier",
    s2b: "Envoie ta pièce d'identité. On vérifie à la main, puis ta page est publique.",
    s3t: "Partage et enseigne",
    s3b: "Poste ton lien, publie ton cours. La 1ʳᵉ séance est offerte à l'élève, ensuite il te paie directement.",

    // l'exemple chiffré
    incomeEyebrow: "Combien tu peux gagner",
    incomeTitle: "Fixe ton tarif, tu gardes tout.",
    incomeLead: "Un exemple d'arithmétique — pas une promesse, et pas un plafond :",
    inStudents: "8 élèves",
    inSessions: "2 séances / sem",
    inPrice: "20 TND / séance",
    inGross: "Exemple : 8 élèves × 2 séances × 20 TND",
    inKeepLbl: "Tu gardes, aujourd'hui",
    inKeep: "1 280 TND",
    inYou: "Toi · 100 %",
    inFee: "9arini · 0 %",
    inWithdraw:
      "Pendant le pilote, l'élève te paie directement, de la main à la main. 9arini ne prend aucune commission et ne touche pas à ton argent. Paiement en ligne : bientôt.",

    // faq
    faqEyebrow: "Avant de te lancer",
    faqTitle: "Les questions qu'on nous pose",
    q1: "Combien 9arini prend ?",
    a1: "Rien, aujourd'hui. Pendant le pilote, tu gardes 100 % : l'élève te paie directement, 9arini ne touche pas à l'argent. Quand le paiement en ligne arrivera, une commission de 12 % s'appliquera — et on te préviendra avant.",
    q2: "Faut-il un diplôme ?",
    a2: "Non. Maîtrise ta matière, une bonne connexion, et tu démarres aujourd'hui. On vérifie ton identité à la main avant que ta page soit publiée.",
    q3: "Si un élève ne vient pas ?",
    a3: "Tu es prévenu et tu peux replanifier. Comme rien ne passe par 9arini, l'arrangement se fait directement entre toi et l'élève.",

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
    sub: "اعمل صفحتك فابور في دقيقتين، حدّد تعريفتك، واعطي دروسك مباشرة. التلميذ يخلّصك مباشرة : 9arini ما تاخذ والو.",
    ctaPrimary: "اعمل صفحتك متاع أستاذ",
    ctaGhost: "شوف الأساتذة في 9arini",
    micro: "فابور. بلا كارت. بلا عمولة.",
    pilotChip: "تجربة — توّا نبداو",

    phoneName: "صفحتك متاع أستاذ",
    phoneSubject: "رياضيات · من الابتدائي للباك",
    live: "مباشر",
    sessionTitle: "التكامل — مراجعة سريعة",
    sessionMeta: "السبت 14س · 90 دقيقة",
    free1st: "أول درس فابور",
    priceExample: "20 دينار",
    shareLinkLabel: "اللينك متاعك",
    shareLinkExample: "9arini.tn/صفحتك",
    classFilling: "القسم في طور التعمير",
    phoneBadges: ["0 % عمولة", "خلاص مباشر"],
    heroSceneLabel: "رسم توضيحي : صفحة أستاذ في 9arini — إسم، مادة، درس مباشر واللينك اللي تشاركو.",

    featEyebrow: "شنوّة باش تاخذ",
    featTitle: "بوتيك متاع أستاذ، حاضرة في دقيقتين",
    f1t: "صفحتك، ولينكك",
    f1b: "إسمك، مادتك، دروسك. لينك وحيد تلصقو في واتساب، إنستا ولا تيكتوك — ومن غادي تلامذتك يحجزو.",
    f2t: "ثمنك إنتي — وتحتفظ بـ 100 %",
    f2b: "إنتي تحدّد ثمنك، درس بدرس، بلا سقف. التلميذ يخلّصك مباشرة : 9arini ما تاخذ حتى عمولة.",
    f3t: "التثبّت يتعمل بيدينا",
    f3b: "نشوفو بطاقة تعريفك بيدينا. كي تتقبل، صفحتك تولّي أونلاين وتبان في «اكتشف» — عادةً في 24–48 ساعة.",
    f4t: "دروس مباشرة",
    f4b: "ابدا حصتك، شارك الإيكران، زيد السبورة والكويز متاعك. تلامذتك يدخلو بنقرة.",

    howEyebrow: "كيفاش يخدم",
    howTitle: "من الصفر لأول حجز متاعك",
    s1t: "اعمل صفحتك",
    s1b: "إسم، مادة، وجملة عليك. دقيقتين، بلا كارت بنكية.",
    s2t: "تثبّت من هويتك",
    s2b: "ابعث بطاقة تعريفك. نتثبّتو بيدينا، ومن بعد صفحتك تولّي ظاهرة للناس.",
    s3t: "شارك وقرّي",
    s3b: "انشر لينكك، وانشر درسك. أول حصة فابور للتلميذ، ومن بعد يخلّصك مباشرة.",

    incomeEyebrow: "قداش تنجم تربح",
    incomeTitle: "حدّد تعريفتك، وتحتفظ بالكل.",
    incomeLead: "هاذا مثال حساب — موش وعد، وموش سقف :",
    inStudents: "8 تلامذة",
    inSessions: "حصتين / جمعة",
    inPrice: "20 دينار / حصة",
    inGross: "مثال : 8 تلامذة × حصتين × 20 دينار",
    inKeepLbl: "تحتفظ بيه، اليوم",
    inKeep: "1 280 دينار",
    inYou: "إنتي · 100 %",
    inFee: "9arini · 0 %",
    inWithdraw:
      "في فترة التجربة، التلميذ يخلّصك مباشرة، يد بيد. 9arini ما تاخذ حتى عمولة وما تلمسش فلوسك. الخلاص أونلاين : قريب.",

    faqEyebrow: "قبل ما تبدا",
    faqTitle: "الأسئلة اللي يسقسيونا عليها",
    q1: "قدّاش تاخذ 9arini ؟",
    a1: "والو، اليوم. في فترة التجربة تحتفظ بـ 100 % : التلميذ يخلّصك مباشرة، و9arini ما تلمسش الفلوس. كي يجي الخلاص أونلاين، باش تولّي فما عمولة 12 % — ونعلموك قبل.",
    q2: "يلزم شهادة ؟",
    a2: "لا. اتقن مادتك، كنكسيون مليحة، وتبدا اليوم. نتثبّتو من هويتك بيدينا قبل ما تتنشر صفحتك.",
    q3: "كان التلميذ ما جاش ؟",
    a3: "تتعلّم بيها وتنجّم تبدّل الوقت. وبما إلي حتى حاجة ما تعدّي من 9arini، الاتفاق يكون مباشرة بيناتكم.",

    finalTitle: "صفحتك متاع أستاذ تستنّى فيك.",
    finalSub: "اعملها في دقيقتين.",
    finalReassure: "فابور · بلا كارت · بلا عمولة · تنجم تمسحها وقتلي تحب.",
    crossBottom: "إنتي تلميذ ؟ لقا أستاذك",
  },
} as const;

type Copy = (typeof copy)[keyof typeof copy];

/* ═══════════════════════════════════════════════════════════════════════════
   Scroll-reveal — PROGRESSIVE ENHANCEMENT, not a prerequisite for reading.

   This hook used to start hidden (`opacity:0` in the SSR HTML) and only become
   visible once an IntersectionObserver fired from a useEffect. That shipped a
   BLANK HERO for the whole JS download+parse window, and a permanently blank
   page if the bundle never arrived — on the 3G Android this page is actually
   opened on, that is the common case. The <h1>, the sub-headline and the primary
   CTA were all inside it.

   Inverted: the element starts UNARMED, so the server-rendered HTML is already
   the final, visible state. JS then *arms* the animation — and only for elements
   that are currently off-screen, so arming can never blink out something the
   reader is already looking at. With JS off, or if the bundle fails, the page is
   simply a static page. Nothing to go wrong.
   ═══════════════════════════════════════════════════════════════════════════ */
function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    // Already on screen at mount → leave it alone; animating it now would be a
    // visible flash-out/flash-in of content the reader can see.
    const r = el.getBoundingClientRect();
    if (r.bottom > 0 && r.top < window.innerHeight) return;

    setArmed(true);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setArmed(false);
            io.disconnect();
            break;
          }
        }
      },
      /* threshold 0, not 0.16: a section TALLER than the viewport can never
         reach a fractional visibility ratio, so the old 0.16 left tall sections
         armed — and therefore invisible — forever. That is very reachable at
         320px in Arabic. The negative bottom rootMargin does the "wait until
         it's properly on screen" job instead, and it is height-independent. */
      { threshold: 0, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, armed };
}

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
  const { ref, armed } = useReveal<HTMLElement>();
  return (
    <Tag
      ref={ref as any}
      className={`lpp-reveal ${armed ? "lpp-armed" : ""} ${className}`}
      style={{ ...style, ["--lpp-d" as any]: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   HERO SCENE — the tutor's own 9arini page, floating.
   It shows WHAT THEY GET (page, live class, price they set, shareable link),
   never an invented balance. role="img" describes the whole scene.
   ═══════════════════════════════════════════════════════════════════════════ */
function HeroScene({ c }: { c: Copy }) {
  const { locale } = useLocale();
  const seatInits = locale === "ar" ? ["أ", "س", "م", "ر"] : ["A", "S", "M", "R"];
  /* Seat offsets are derived from --phone-w rather than hardcoded, because the
     two have to stay related: at a flat +-120px these avatars sat INSIDE a
     300px-wide phone and landed on top of its content — the "A" covered the "1"
     of "1er cours offert", so the hero of the page tutors share to recruit other
     tutors literally read "ler cours offert". Anchoring them to the phone's half
     width plus a gap means they can never re-enter the content box, at any
     viewport, in either language. */
  const seats = [
    { grad: "linear-gradient(150deg,#F3C24B,#E0852E)", x: "calc(var(--phone-w) / -2 - 26px)", y: -54, d: 0.6 },
    { grad: "linear-gradient(150deg,#5FB7F0,#0E5AA6)", x: "calc(var(--phone-w) / 2 + 28px)", y: -30, d: 1.2 },
    { grad: "linear-gradient(150deg,#54D6AC,#1B9C6F)", x: "calc(var(--phone-w) / -2 - 30px)", y: 64, d: 1.8 },
    { grad: "linear-gradient(150deg,#F0A85F,#C26E1C)", x: "calc(var(--phone-w) / 2 + 24px)", y: 86, d: 2.4 },
  ];

  return (
    <div role="img" aria-label={c.heroSceneLabel} className="lpp-scene">
      <div className="lpp-wash" aria-hidden="true" />
      <div className="lpp-zellige-wash zellige" aria-hidden="true" />
      <div className="lpp-glow" aria-hidden="true" />

      {/* class filling around the phone (decorative) */}
      <div className="lpp-seats" aria-hidden="true">
        {seats.map((s, idx) => (
          <span
            key={idx}
            className="lpp-seat"
            style={{
              ["--sx" as any]: s.x,
              ["--sy" as any]: `${s.y}px`,
              ["--sd" as any]: `${s.d}s`,
              background: s.grad,
            }}
          >
            {seatInits[idx]}
          </span>
        ))}
      </div>

      <div className="lpp-phone-wrap" aria-hidden="true">
        <div className="lpp-phone">
          <div className="zellige hero-blue lpp-screen">
            <div className="lpp-notch" />

            {/* header: avatar + name + LIVE */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                className="avatar sq"
                style={{
                  width: 42, height: 42, fontSize: 18, flex: "none",
                  background: "linear-gradient(150deg,#F3C24B,#E0852E)",
                  borderColor: "rgba(255,255,255,.3)",
                }}
              >
                ي
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="lpp-phone-name">{c.phoneName}</div>
                <div className="lpp-phone-sub">{c.phoneSubject}</div>
              </div>
            </div>

            {/* the class the tutor published: their title, their price */}
            <div className="lpp-card">
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div className="lpp-card-ic">
                  <Video />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="lpp-card-t">{c.sessionTitle}</div>
                  <div className="lpp-card-m">{c.sessionMeta}</div>
                </div>
                <div className="lpp-card-price">{c.priceExample}</div>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                <span className="chip lpp-live" style={{ background: "var(--green-btn)", color: "#fff", gap: 5 }}>
                  <span className="lpp-live-dot" />
                  {c.live}
                </span>
                <span className="chip" style={{ background: "var(--ochre-btn)", color: "#fff" }}>
                  {c.free1st}
                </span>
                <span className="lpp-mini">
                  <Users style={{ width: 12, height: 12 }} /> {c.classFilling}
                </span>
              </div>
            </div>

            {/* the shareable link */}
            <div className="lpp-card">
              <div className="lpp-card-lbl">
                <Share style={{ width: 13, height: 13 }} />
                {c.shareLinkLabel}
              </div>
              <div className="lpp-link" dir="ltr">{c.shareLinkExample}</div>
            </div>

            {/* pilot truths — no payment rails */}
            <div style={{ marginTop: "auto", display: "flex", gap: 7, justifyContent: "center", flexWrap: "wrap" }}>
              {c.phoneBadges.map((p) => (
                <span key={p} className="lpp-badge">{p}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Feature card — equal heights inside a grid row (h-full + column + mt-auto). */
function FeatureCard({
  icon, bg, fg, title, body,
}: {
  icon: React.ReactNode;
  bg: string;
  fg: string;
  title: string;
  body: string;
}) {
  return (
    <div className="panel panel-pad lpp-feature" style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
      <div aria-hidden="true" className="lpp-feature-ic" style={{ width: 52, height: 52, flex: "none", borderRadius: 15, background: bg, color: fg, display: "grid", placeItems: "center" }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <h3 className="lpp-feature-t">{title}</h3>
        <p style={{ fontSize: 14, color: "var(--ink2)", lineHeight: 1.6 }}>{body}</p>
      </div>
    </div>
  );
}

/* FAQ accordion item (accessible disclosure, animated height). */
function FaqItem({ q, a, defaultOpen = false }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`panel lpp-faq ${open ? "is-open" : ""}`} style={{ overflow: "hidden" }}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="lpp-faq-btn">
        <span className="lpp-faq-q">{q}</span>
        <span aria-hidden="true" className="lpp-faq-ic" style={{ background: open ? "var(--blue)" : "var(--blue50)", color: open ? "#fff" : "var(--blue)" }}>
          <svg viewBox="0 0 24 24" className="ic" aria-hidden="true" style={{ width: 16, height: 16, transform: open ? "rotate(45deg)" : "none", transition: "transform .2s" }}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </span>
      </button>
      {/* grid-rows trick: animates open/closed smoothly, height-agnostic */}
      <div className="lpp-faq-wrap" data-open={open}>
        <div className="lpp-faq-inner">
          <div className="lpp-faq-a">{a}</div>
        </div>
      </div>
    </div>
  );
}

function SectionHead({ eyebrow, title, center = false }: { eyebrow: string; title: string; center?: boolean }) {
  return (
    <Reveal
      style={{
        marginBottom: "clamp(24px,3.5vw,40px)",
        textAlign: center ? "center" : "start",
        maxWidth: center ? 640 : undefined,
        marginInline: center ? "auto" : undefined,
      }}
    >
      <div className="web-eyebrow" style={{ marginBottom: 10 }}>{eyebrow}</div>
      <h2 className="web-h2">{title}</h2>
    </Reveal>
  );
}

/* The one CTA, repeated verbatim. Same label, same destination, everywhere. */
function Cta({ label, size = "md" }: { label: string; size?: "md" | "lg" }) {
  return (
    <Link
      href="/onboarding"
      className="btn btn-primary lpp-cta-primary"
      style={{
        width: "auto",
        paddingInline: size === "lg" ? 32 : 26,
        paddingBlock: size === "lg" ? 16 : 15,
        fontSize: size === "lg" ? 16 : 15.5,
        maxWidth: "100%",
      }}
    >
      {label}
      <Forward style={{ width: 18, height: 18, flex: "none" }} />
    </Link>
  );
}

function CrossLink({ label, align = "start" }: { label: string; align?: "start" | "center" }) {
  return (
    <div style={{ textAlign: align }}>
      <Link href="/" className="lpp-cross">
        {label}
        <Forward className="lpp-cross-arrow" style={{ width: 15, height: 15, flex: "none" }} />
      </Link>
    </div>
  );
}

/* Income example panel — arithmetic, labelled as an example, plus the 100/0
   split that is true today (0 % commission, tutor paid directly). */
function IncomePanel({ c }: { c: Copy }) {
  const { ref, armed } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`panel panel-pad zellige hero-blue lpp-reveal lpp-dark ${armed ? "lpp-armed" : ""}`}
      style={{ position: "relative", overflow: "hidden", minWidth: 0 }}
    >
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 13, color: "var(--on-blue-soft)", fontWeight: 600, marginBottom: 8, lineHeight: 1.5 }}>
          {c.inGross}
        </div>
        <div style={{ fontFamily: "var(--fd)", fontSize: 13, color: "#EAF2FC", fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 7 }}>
          <Wallet style={{ width: 16, height: 16, flex: "none" }} />
          {c.inKeepLbl}
        </div>
        <div className="lpp-amount">{c.inKeep}</div>

        {/* 100 / 0 split bar — no commission during the pilot */}
        <div style={{ marginTop: 18 }}>
          <div className={`lpp-split ${armed ? "lpp-armed" : ""}`}>
            <span className="lpp-split-you" />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginTop: 8, fontFamily: "var(--fd)", fontWeight: 700, fontSize: 13 }}>
            <span style={{ color: "var(--on-blue-soft)", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: "#54D6AC", flex: "none" }} />
              {c.inYou}
            </span>
            <span style={{ color: "var(--on-blue-soft)" }}>{c.inFee}</span>
          </div>
        </div>

        <div className="trust" style={{ marginTop: 18, background: "rgba(255,255,255,.12)", position: "relative", zIndex: 2 }}>
          <Shield style={{ color: "#54D6AC" }} />
          <p style={{ color: "#EAF2FC" }}>{c.inWithdraw}</p>
        </div>
      </div>
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
      {/* Page-scoped styles (`lpp-`), injected with dangerouslySetInnerHTML — an
          inline <style>{`…`}</style> in a client component triggers hydration
          errors. UNLAYERED, so it also fixes shared-class problems locally:
          • .panel is defined after .hero-blue in globals, so `panel hero-blue`
            painted WHITE; .lpp-dark forces the intended cobalt surface.
          • --fd (Space Grotesk) has NO Arabic glyphs and its negative tracking
            severs Arabic cursive joins → every display-font block here falls
            back to --fa with normal tracking under html[dir=rtl].
          prefers-reduced-motion guard at the bottom kills all motion. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
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

        /* ---- scroll reveal ---- */
        /* Default state is the FINAL state, so the SSR HTML is readable with no JS.
           .lpp-armed is added by useReveal only for off-screen elements. */
        .lpp-reveal { transition: opacity .6s cubic-bezier(.2,.7,.2,1), transform .6s cubic-bezier(.2,.7,.2,1); transition-delay: var(--lpp-d, 0ms); }
        .lpp-reveal.lpp-armed { opacity: 0; transform: translateY(18px); }

        /* ---- dark cobalt surfaces (beats .panel's white background) ---- */
        .lpp-dark { background: linear-gradient(158deg,var(--blue),#082F54); color: #fff; border-color: transparent;
          box-shadow: var(--sh-l), 0 30px 60px -40px rgba(14,90,166,.5); border-radius: var(--r-l); }

        /* ---- hero scene ---- */
        /* --phone-w is the scene's single source of truth: the phone uses it for
           its width and the floating avatars derive their offsets from it, so
           the two cannot drift apart and collide again. */
        .lpp-scene { --phone-w: min(340px, 86vw);
          position: relative; width: 100%; min-height: 470px; display: flex; justify-content: center; isolation: isolate; }
        .lpp-wash {
          position: absolute; inset: -12% 10%; z-index: 0; border-radius: 40px;
          background:
            radial-gradient(46% 50% at 28% 26%, rgba(14,90,166,.30), transparent 70%),
            radial-gradient(48% 52% at 76% 70%, rgba(241,231,214,.85), transparent 72%),
            radial-gradient(40% 44% at 70% 18%, rgba(243,194,75,.30), transparent 70%);
          filter: blur(6px); animation: lpp-wash 14s ease-in-out infinite;
        }
        /* inset: -6% 0 — a symmetric -6% also bled 6% of the scene width past
           BOTH edges, which is what put horizontal scroll on the page at 320,
           380 and 768px. The soft edge is wanted vertically, not horizontally. */
        .lpp-zellige-wash { position: absolute; inset: -6% 0; z-index: 0; opacity: .5; border-radius: 36px; }
        .lpp-zellige-wash::before { opacity: .10; }
        /* Centred with inset-inline + auto margins, not inset-inline-start:50%
           + translate:-50%. translate is PHYSICAL and inset-inline-start is
           LOGICAL, so in Arabic the two pulled in the same direction and threw
           the glow ~350px off-canvas — the page scrolled sideways to 670px on a
           320px screen. Same trick .toast already uses in globals.css.
           width:min(...,100%) so it can never be wider than the scene either. */
        .lpp-glow {
          position: absolute; inset-block-start: 8%; inset-inline: 0; margin-inline: auto;
          width: min(340px, 100%); aspect-ratio: 1; z-index: 0; border-radius: 999px;
          background: radial-gradient(circle, rgba(14,90,166,.34), transparent 68%);
          filter: blur(10px); animation: lpp-glow 6s ease-in-out infinite;
        }
        .lpp-phone-wrap { position: relative; z-index: 2; animation: lpp-float 7s ease-in-out infinite; }
        .lpp-phone {
          position: relative; width: var(--phone-w); border-radius: 38px; padding: 12px;
          background: linear-gradient(160deg,#15263B,#0A1626);
          box-shadow: var(--sh-l), 0 50px 90px -50px rgba(14,90,166,.55);
          border: 1px solid rgba(255,255,255,.08);
        }
        .lpp-screen { border-radius: 28px; overflow: hidden; display: flex; flex-direction: column; gap: 12px;
          padding: 20px 16px 18px; min-height: 430px; box-shadow: inset 0 1px 0 rgba(255,255,255,.10); }
        .lpp-notch { width: 96px; height: 6px; border-radius: 999px; background: rgba(255,255,255,.25); margin: 0 auto 2px; flex: none; }
        .lpp-phone-name { font-family: var(--fd); font-weight: 700; font-size: 14.5px; color: #fff;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .lpp-phone-sub { font-size: 13px; color: var(--on-blue-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .lpp-card { background: rgba(255,255,255,.10); border: 1px solid rgba(255,255,255,.14);
          border-radius: var(--r); padding: 13px 14px; }
        .lpp-card-ic { width: 40px; height: 40px; flex: none; border-radius: 12px; background: rgba(255,255,255,.14);
          color: #fff; display: grid; place-items: center; }
        /* Wraps to two lines instead of ellipsing. "Integrales - revision express"
           never fits one line beside the icon and the price, in either language,
           so nowrap+ellipsis guaranteed a cut-off class title in the hero of the
           page tutors share to recruit other tutors. */
        .lpp-card-t { font-weight: 700; font-size: 13px; color: #fff; margin-bottom: 2px;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden; line-height: 1.3; }
        .lpp-card-m { font-size: 13px; color: var(--on-blue-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .lpp-card-price { font-family: var(--fd); font-weight: 700; font-size: 14px; color: var(--amber); flex: none; white-space: nowrap; }
        .lpp-card-lbl { display: flex; align-items: center; gap: 7px; font-size: 13px; color: var(--on-blue-soft); font-weight: 600; margin-bottom: 7px; }
        .lpp-link { font-family: var(--fd); font-weight: 700; font-size: 14px; color: #fff; text-align: start;
          background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.16); border-radius: 10px;
          padding: 9px 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .lpp-mini { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 600; color: var(--on-blue-soft); min-width: 0; }
        /* a .chip is inline-flex: beside shrinking text in a flex row it deforms */
        .lpp-card .chip, .lpp-scene .chip { flex: none; }
        .lpp-badge { font-family: var(--fd); font-size: 13px; font-weight: 700; color: #fff;
          background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.16); border-radius: 999px; padding: 5px 11px; }
        .lpp-seats { position: absolute; inset: 0; z-index: 3; display: grid; place-items: center; pointer-events: none; }
        .lpp-seat {
          position: absolute; width: 46px; height: 46px; border-radius: 15px;
          display: grid; place-items: center; color: #fff; font-family: var(--fd); font-weight: 700; font-size: 17px;
          border: 2.5px solid var(--cream); box-shadow: var(--sh); opacity: 0;
          animation:
            lpp-seat-in .7s cubic-bezier(.2,.8,.2,1) forwards var(--sd, .6s),
            lpp-seat-float 5s ease-in-out infinite calc(var(--sd, .6s) + .7s);
        }
        @media (max-width: 520px) { .lpp-seats { display: none; } .lpp-scene { min-height: 0; } }
        .lpp-live { animation: lpp-ring 1.8s ease-out infinite; }
        .lpp-live-dot { width: 7px; height: 7px; border-radius: 999px; background: #fff; display: inline-block; flex: none; animation: lpp-pulse 1.4s ease-in-out infinite; }

        /* ---- CTA ---- */
        .lpp-cta-primary { transition: transform .18s cubic-bezier(.2,.7,.2,1), box-shadow .18s, background .16s; }
        .lpp-cta-primary:hover { transform: translateY(-2px); box-shadow: 0 20px 34px -16px rgba(224,133,46,.95); }
        .lpp-cta-primary:active { transform: translateY(0); }
        .lpp-cta-primary:focus-visible, .lpp-cta-ghost:focus-visible { outline: 3px solid var(--blue); outline-offset: 3px; }
        .lpp-cta-primary .ic { transition: transform .2s; }
        .lpp-cta-primary:hover .ic { transform: translateX(3px); }
        html[dir="rtl"] .lpp-cta-primary:hover .ic { transform: translateX(-3px); }
        .lpp-cta-ghost { transition: transform .18s, border-color .16s, color .16s; }
        .lpp-cta-ghost:hover { transform: translateY(-2px); border-color: var(--blue); color: var(--blue); }

        /* ---- feature cards ---- */
        .lpp-feature { transition: transform .2s cubic-bezier(.2,.7,.2,1), box-shadow .2s, border-color .2s; }
        .lpp-feature:hover { transform: translateY(-4px); box-shadow: var(--sh); border-color: var(--lineCool); }
        .lpp-feature-ic { transition: transform .25s cubic-bezier(.2,.7,.2,1); }
        .lpp-feature:hover .lpp-feature-ic { transform: scale(1.08) rotate(-3deg); }
        .lpp-feature-t { font-family: var(--fd); font-weight: 700; font-size: 17.5px; margin-bottom: 7px; }

        /* ---- stepper ---- */
        .lpp-step { position: relative; transition: transform .2s; height: 100%; }
        .lpp-step:hover { transform: translateY(-3px); }
        .lpp-node {
          width: 46px; height: 46px; flex: none; border-radius: 14px; background: var(--ink); color: #fff;
          display: grid; place-items: center; font-family: var(--fd); font-size: 20px; font-weight: 700;
          box-shadow: var(--sh-s); position: relative; z-index: 2;
        }
        .lpp-step-t { font-family: var(--fd); font-weight: 700; font-size: 17px; }
        .lpp-connector { position: absolute; inset-block-start: 23px; z-index: 0; height: 2px;
          background: repeating-linear-gradient(90deg, var(--line) 0 7px, transparent 7px 14px); display: none; }
        @media (min-width: 1000px) { .lpp-connector { display: block; inset-inline-start: 16%; inset-inline-end: 16%; } }

        /* ---- income ---- */
        .lpp-amount { font-family: var(--fd); font-size: clamp(34px,5.5vw,52px); font-weight: 700;
          letter-spacing: -1.4px; color: var(--amber); line-height: 1.05; overflow-wrap: anywhere; }
        .lpp-split { position: relative; height: 12px; border-radius: 999px; overflow: hidden; background: rgba(255,255,255,.18); }
        .lpp-split-you {
          position: absolute; inset-block: 0; inset-inline-start: 0; width: 100%;
          background: linear-gradient(90deg,#54D6AC,#1B9C6F);
          transform-origin: left;
          transition: transform 1.1s cubic-bezier(.2,.7,.2,1) .15s;
        }
        html[dir="rtl"] .lpp-split-you { transform-origin: right; }
        /* Full bar is the DEFAULT, so it is drawn correctly with no JS; the
           armed state is the empty bar it grows out of. */
        .lpp-split.lpp-armed .lpp-split-you { transform: scaleX(0); }

        /* ---- faq ---- */
        .lpp-faq { transition: box-shadow .2s, border-color .2s; }
        .lpp-faq.is-open { box-shadow: var(--sh-s); border-color: var(--lineCool); }
        .lpp-faq-btn { width: 100%; display: flex; align-items: center; gap: 14px; text-align: start;
          background: transparent; border: 0; cursor: pointer; color: var(--ink);
          padding: clamp(15px,2vw,20px) clamp(16px,2.4vw,24px); font-family: var(--fb); }
        html[dir="rtl"] .lpp-faq-btn { font-family: var(--fa); }
        .lpp-faq-btn:focus-visible { outline: 3px solid var(--blue); outline-offset: -3px; border-radius: var(--r-l); }
        .lpp-faq-q { font-family: var(--fd); font-weight: 700; font-size: 16px; flex: 1; min-width: 0; }
        .lpp-faq-ic { flex: none; width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center;
          margin-inline-start: auto; transition: background .2s; }
        .lpp-faq-wrap { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .28s cubic-bezier(.2,.7,.2,1); }
        .lpp-faq-wrap[data-open="true"] { grid-template-rows: 1fr; }
        .lpp-faq-inner { overflow: hidden; }
        .lpp-faq-a { padding: 0 clamp(16px,2.4vw,24px) clamp(15px,2vw,20px); font-size: 14.5px; color: var(--ink2); line-height: 1.65; }

        /* ---- cross-link ---- */
        .lpp-cross { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 13.5px;
          color: var(--blue); background: var(--blue50); border-radius: 999px; padding: 10px 16px; min-height: 44px;
          transition: background .16s, transform .16s; }
        .lpp-cross:hover { background: #DCE9F7; transform: translateY(-1px); }
        .lpp-cross-arrow { transition: transform .18s; }
        .lpp-cross:hover .lpp-cross-arrow { transform: translateX(3px); }
        html[dir="rtl"] .lpp-cross:hover .lpp-cross-arrow { transform: translateX(-3px); }

        /* ---- final CTA ---- */
        .lpp-final { position: relative; overflow: hidden; text-align: center;
          padding: clamp(36px,6vw,72px) clamp(20px,4vw,48px); }
        .lpp-final::after {
          content: ""; position: absolute; inset-block-start: -40%; inset-inline-start: 50%; translate: -50% 0;
          width: 70%; height: 70%; border-radius: 999px; pointer-events: none; z-index: 0;
          background: radial-gradient(circle, rgba(243,194,75,.30), transparent 70%);
          animation: lpp-glow 7s ease-in-out infinite;
        }
        .lpp-final > * { position: relative; z-index: 1; }
        .lpp-bolt { animation: lpp-float 5s ease-in-out infinite; }

        /* ---- Arabic: --fd has no Arabic glyphs; negative tracking breaks joins ---- */
        html[dir="rtl"] .lpp-phone-name, html[dir="rtl"] .lpp-card-price, html[dir="rtl"] .lpp-badge,
        html[dir="rtl"] .lpp-link, html[dir="rtl"] .lpp-seat, html[dir="rtl"] .lpp-node,
        html[dir="rtl"] .lpp-feature-t, html[dir="rtl"] .lpp-step-t, html[dir="rtl"] .lpp-faq-q,
        html[dir="rtl"] .lpp-amount, html[dir="rtl"] .lpp-eq {
          font-family: var(--fa); letter-spacing: normal;
        }

        /* ---- responsive two-column blocks ---- */
        @media (min-width: 880px) { [data-lpp-income="true"] { grid-template-columns: 1.1fr .9fr; } }

        /* ---- reduced motion: freeze everything to final state ---- */
        @media (prefers-reduced-motion: reduce) {
          .lpp-reveal, .lpp-reveal.lpp-armed { opacity: 1 !important; transform: none !important; transition: none !important; }
          .lpp-phone-wrap, .lpp-glow, .lpp-wash, .lpp-live, .lpp-live-dot, .lpp-seat, .lpp-bolt, .lpp-final::after {
            animation: none !important;
          }
          .lpp-seat { opacity: 1; transform: translate(var(--sx), var(--sy)); }
          .lpp-split-you { transition: none; }
        }
      `,
        }}
      />

      {/* ═══ 1. HERO ═══ */}
      <section className="web-section" style={{ paddingTop: "clamp(20px,4vw,52px)", paddingBottom: "clamp(40px,6vw,84px)" }}>
        <div className="container">
          <div style={{ marginBottom: "clamp(18px,3vw,28px)" }}>
            <CrossLink label={c.crossTop} />
          </div>

          <div className="web-hero">
            {/* LEFT — copy + CTAs */}
            <div style={{ display: "flex", flexDirection: "column", gap: 22, minWidth: 0 }}>
              <Reveal style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span className="web-eyebrow">{c.eyebrow}</span>
                {/* Pre-launch, not "live activity" — we claim newness, not traffic. */}
                <span className="chip lpp-live" style={{ background: "var(--green-btn)", color: "#fff", gap: 6 }}>
                  <span className="lpp-live-dot" aria-hidden="true" />
                  {c.pilotChip}
                </span>
              </Reveal>

              <Reveal delay={70} as="h1" className="web-h1">
                {c.h1a}
                <br />
                <span style={{ color: "var(--blue)" }}>{c.h1b}</span>
                <br />
                <span style={{ color: "var(--green-ink)" }}>{c.h1c}</span>
              </Reveal>

              <Reveal delay={140} as="p" className="web-lead" style={{ maxWidth: 540 }}>
                {c.sub}
              </Reveal>

              <Reveal delay={210} className="cluster" style={{ gap: 14 }}>
                <Cta label={c.ctaPrimary} />
                <Link
                  href="/explore"
                  className="btn btn-ghost lpp-cta-ghost"
                  style={{ width: "auto", paddingInline: 24, paddingBlock: 15, fontSize: 15, maxWidth: "100%" }}
                >
                  {c.ctaGhost}
                </Link>
              </Reveal>

              <Reveal delay={280} as="p" style={{ fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 7 }}>
                <Check style={{ width: 15, height: 15, color: "var(--green)", flex: "none" }} />
                {c.micro}
              </Reveal>
            </div>

            {/* RIGHT — the tutor's page, floating */}
            <HeroScene c={c} />
          </div>
        </div>
      </section>

      {/* ═══ 2. WHAT YOU GET ═══ */}
      <section
        className="web-section"
        style={{ background: "rgba(255,255,255,.55)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}
      >
        <div className="container">
          <SectionHead eyebrow={c.featEyebrow} title={c.featTitle} />
          <div className="grid-2">
            {[
              { icon: <Share />, bg: "var(--blue50)", fg: "var(--blue)", t: c.f1t, b: c.f1b },
              { icon: <Wallet />, bg: "var(--green50)", fg: "var(--green-ink)", t: c.f2t, b: c.f2b },
              { icon: <Shield />, bg: "var(--ochre-tint)", fg: "var(--ochre-ink)", t: c.f3t, b: c.f3b },
              { icon: <Video />, bg: "var(--blue50)", fg: "var(--blue)", t: c.f4t, b: c.f4b },
            ].map((f, i) => (
              <Reveal key={i} delay={i * 80}>
                <FeatureCard icon={f.icon} bg={f.bg} fg={f.fg} title={f.t} body={f.b} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 3. HOW IT WORKS ═══ */}
      <section className="web-section">
        <div className="container">
          <SectionHead eyebrow={c.howEyebrow} title={c.howTitle} center />
          <div className="grid-3" style={{ marginBottom: "clamp(28px,4vw,44px)", position: "relative" }}>
            <div className="lpp-connector" aria-hidden="true" />
            {[
              { n: 1, t: c.s1t, b: c.s1b },
              { n: 2, t: c.s2t, b: c.s2b },
              { n: 3, t: c.s3t, b: c.s3b },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 110}>
                <div className="panel panel-pad lpp-step" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="lpp-node" aria-hidden="true">{s.n}</div>
                  <h3 className="lpp-step-t">{s.t}</h3>
                  <p style={{ fontSize: 14, color: "var(--ink2)", lineHeight: 1.6 }}>{s.b}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal style={{ display: "flex", justifyContent: "center" }}>
            <Cta label={c.ctaPrimary} />
          </Reveal>
        </div>
      </section>

      {/* ═══ 4. THE MATH ═══ */}
      <section
        className="web-section"
        style={{ background: "rgba(255,255,255,.55)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}
      >
        <div className="container">
          <div
            style={{ display: "grid", gap: "clamp(20px,3vw,40px)", gridTemplateColumns: "1fr", alignItems: "center" }}
            data-lpp-income="true"
          >
            <Reveal style={{ minWidth: 0 }}>
              <div className="web-eyebrow" style={{ marginBottom: 10 }}>{c.incomeEyebrow}</div>
              <h2 className="web-h2" style={{ marginBottom: 12 }}>{c.incomeTitle}</h2>
              <p className="web-lead" style={{ marginBottom: 18 }}>{c.incomeLead}</p>

              <div className="cluster" style={{ gap: 10 }}>
                {[
                  { ic: <Users style={{ width: 16, height: 16 }} />, txt: c.inStudents },
                  { ic: <Video style={{ width: 16, height: 16 }} />, txt: c.inSessions },
                  { ic: <Wallet style={{ width: 16, height: 16 }} />, txt: c.inPrice },
                ].map((x, i) => (
                  <React.Fragment key={i}>
                    <span
                      className="lpp-eq"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 8, background: "var(--paper)",
                        border: "1px solid var(--line)", borderRadius: 12, padding: "10px 14px",
                        fontFamily: "var(--fd)", fontWeight: 700, fontSize: 14.5, color: "var(--ink)",
                        boxShadow: "var(--sh-s)", minWidth: 0,
                      }}
                    >
                      <span style={{ color: "var(--blue)", display: "inline-flex", flex: "none" }} aria-hidden="true">{x.ic}</span>
                      {x.txt}
                    </span>
                    {i < 2 && (
                      <span aria-hidden="true" style={{ fontFamily: "var(--fd)", fontWeight: 700, color: "var(--muted)", fontSize: 18 }}>·</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </Reveal>

            <IncomePanel c={c} />
          </div>
        </div>
      </section>

      {/* ═══ 5. FAQ ═══ */}
      <section className="web-section">
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
      <section className="web-section" style={{ paddingTop: 0 }}>
        <div className="container">
          <Reveal className="panel panel-pad zellige lpp-dark lpp-final">
            <div style={{ display: "inline-flex", marginBottom: 18 }}>
              <span
                className="lpp-bolt"
                style={{
                  width: 60, height: 60, borderRadius: 18, background: "var(--ochre)", color: "#fff",
                  display: "grid", placeItems: "center", boxShadow: "0 18px 30px -12px rgba(224,133,46,.95)",
                }}
                aria-hidden="true"
              >
                <Bolt />
              </span>
            </div>
            <h2 className="web-h2" style={{ color: "#fff", marginBottom: 8 }}>{c.finalTitle}</h2>
            <p className="web-lead" style={{ color: "var(--on-blue-soft)", marginBottom: 26, maxWidth: 520, marginInline: "auto" }}>
              {c.finalSub}
            </p>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Cta label={c.ctaPrimary} size="lg" />
            </div>
            <p style={{ fontSize: 13, color: "var(--on-blue-soft)", marginTop: 18, display: "flex", alignItems: "center", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <Shield style={{ width: 15, height: 15, color: "#54D6AC", flex: "none" }} />
              {c.finalReassure}
            </p>
          </Reveal>

          <div style={{ marginTop: "clamp(24px,4vw,40px)", display: "flex", justifyContent: "center" }}>
            <CrossLink label={c.crossBottom} align="center" />
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
