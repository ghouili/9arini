import type { Locale, TutorVerifStatus } from "./types";

/* ─────────────────────────────────────────────────────────────────────────────
   THE tutor onboarding ladder — one definition, used by every screen in it.

   Before this module the same funnel was described three different ways:

     • /onboarding         a local 3-step bar whose `step` was `published ? 2 : 1`,
                           so it could never reach 3 while still announcing
                           aria-valuemax={3} to screen readers
     • /onboarding/verify  the hardcoded string "Étape 2 sur 3"
     • /dashboard          a 4-step ladder built from real data

   Three step counts for one journey, two of them fixed and one of them real. A
   tutor who published their page saw "2 / 3" on one screen and "step 2 of 4" on
   the next. The ladder below is the real one (it is the dashboard's, which was
   already derived from actual rows) and it is now the only one.

   Copy lives here rather than in each page's local `copy` object for the same
   reason: the labels ARE the model. If /onboarding called step 2 "Vérification"
   and the dashboard called it "Fais-toi vérifier", the shared bar would be a
   shared bar in name only.
   ──────────────────────────────────────────────────────────────────────────── */

export type StepState = "done" | "current" | "todo" | "waiting";

export type OnboardingStep = {
  key: "store" | "verify" | "class" | "share";
  /** Full title, for the dashboard's expanded checklist. */
  title: string;
  body: string;
  /** Two or three words, for the compact bar on /onboarding and /onboarding/verify. */
  short: string;
  state: StepState;
  cta?: { label: string; href: string };
};

/** Everything the ladder needs to know, sourced from real rows — never a guess. */
export type TutorProgress = {
  hasStorefront: boolean;
  status: TutorVerifStatus;
  hasClass: boolean;
  hasSlug: boolean;
};

export const STEP_COPY = {
  fr: {
    nextTitle: "À faire maintenant",
    nextSub: "Quatre étapes, dans l'ordre. Chacune prend quelques minutes.",
    done: "Fait",
    inProgress: "En cours",
    progressLabel: "Progression de ton inscription",
    stepOf: (a: number, b: number) => `Étape ${a} sur ${b}`,

    st1t: "Crée ta page de prof",
    st1b: "Ton nom, ta matière, ton lien. Deux minutes.",
    st1cta: "Créer ma page",
    st1short: "Ta page",

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
    st2short: "Vérification",

    st3t: "Publie ta 1ʳᵉ classe",
    st3b: "Un titre, une date, ton prix. Tu fixes le tarif, et pendant le pilote tu gardes 100 %.",
    st3cta: "Créer ma classe",
    st3tDone: "Ta 1ʳᵉ classe est publiée",
    st3bDone: "Tu peux en ajouter d'autres quand tu veux.",
    st3short: "Ta 1ʳᵉ classe",

    st4t: "Partage ton lien",
    st4b: "WhatsApp, Insta, TikTok. C'est comme ça que les élèves arrivent.",
    st4cta: "Voir mon lien",
    st4short: "Partage",
  },
  ar: {
    nextTitle: "اللي لازم تعملو توّا",
    nextSub: "أربع مراحل، وحدة وحدة. كل وحدة تاخذ دقايق.",
    done: "تعمل",
    inProgress: "في الطريق",
    progressLabel: "تقدّم التسجيل متاعك",
    stepOf: (a: number, b: number) => `مرحلة ${a} من ${b}`,

    st1t: "اعمل صفحتك متاع أستاذ",
    st1b: "إسمك، مادتك، اللينك متاعك. دقيقتين.",
    st1cta: "اعمل صفحتي",
    st1short: "صفحتك",

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
    st2short: "التثبّت",

    st3t: "انشر أول حصة متاعك",
    st3b: "عنوان، وقت، وثمنك. إنتي تحدّد التعريفة، وفي فترة التجربة تحتفظ بـ 100 %.",
    st3cta: "اعمل حصتي",
    st3tDone: "أول حصة متاعك تنشرت",
    st3bDone: "تنجم تزيد أخرين وقتلي تحب.",
    st3short: "أول حصة",

    st4t: "شارك اللينك متاعك",
    st4b: "واتساب، إنستا، تيكتوك. هكّا التلامذة يجيو.",
    st4cta: "شوف اللينك متاعي",
    st4short: "المشاركة",
  },
} as const;

export type StepCopy = (typeof STEP_COPY)["fr"] | (typeof STEP_COPY)["ar"];

/* Build the ladder from real progress.

   Steps 3 and 4 stay LOCKED until verification passes: createClass() enforces the
   same rule server-side and the storefront is unlisted until approval, so offering
   a button here would be offering one that fails. */
export function buildTutorSteps(p: TutorProgress, locale: Locale): OnboardingStep[] {
  const c = STEP_COPY[locale];
  const verifDone = p.status === "verified";
  const verifWaiting = p.status === "pending";
  const rejected = p.status === "rejected";

  const steps: OnboardingStep[] = [
    {
      key: "store",
      title: c.st1t,
      body: c.st1b,
      short: c.st1short,
      state: p.hasStorefront ? "done" : "current",
      cta: p.hasStorefront ? undefined : { label: c.st1cta, href: "/onboarding" },
    },
    {
      key: "verify",
      title: verifDone ? c.st2tDone : verifWaiting ? c.st2tPending : rejected ? c.st2tRejected : c.st2t,
      body: verifDone ? c.st2bDone : verifWaiting ? c.st2bPending : rejected ? c.st2bRejected : c.st2b,
      short: c.st2short,
      state: verifDone ? "done" : verifWaiting ? "waiting" : p.hasStorefront ? "current" : "todo",
      cta:
        verifDone || verifWaiting || !p.hasStorefront
          ? undefined
          : { label: rejected ? c.st2ctaRejected : c.st2cta, href: "/onboarding/verify" },
    },
    {
      key: "class",
      title: p.hasClass ? c.st3tDone : c.st3t,
      body: p.hasClass ? c.st3bDone : c.st3b,
      short: c.st3short,
      state: p.hasClass ? "done" : verifDone ? "current" : "todo",
      cta: p.hasClass || !verifDone ? undefined : { label: c.st3cta, href: "/dashboard/new-class" },
    },
    {
      key: "share",
      title: c.st4t,
      body: c.st4b,
      short: c.st4short,
      state: verifDone && p.hasSlug ? "current" : "todo",
      cta: verifDone && p.hasSlug ? { label: c.st4cta, href: "#share" } : undefined,
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

/* 1-based index of the step the tutor is ON, for the compact bar's aria values.
   "Where am I" = the first step that is not finished; everything done → the last
   step, because a fully onboarded tutor is at the end of the ladder, not past it. */
export function currentStepNumber(steps: OnboardingStep[]): number {
  const i = steps.findIndex((s) => s.state !== "done");
  return i === -1 ? steps.length : i + 1;
}
