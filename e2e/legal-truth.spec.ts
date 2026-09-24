import { test, expect, type Page } from "@playwright/test";
import { PAYMENT_STORY, THREAD_CLOSE_DAYS } from "@tnajem/shared";

/* phase-a lane L6 (A19) — /privacy AND /terms SAY ONLY WHAT THE CODE DOES.

   The CEO report (§4) listed five sentences these pages promised and the code did
   not keep: messages reportable "sans compte", contact details removed (links got
   through), the photo erased (old versions stayed), name and phone erased (a
   parent's copies survived in the child's consent), "nous pouvons retirer un
   contenu" (admins could not). Phase A made four of them true and the first one is
   rephrased; Batches 1–5 changed more (the adult-only pilot, conversations that
   close, first name + initial, the one payment story, the phone). This spec reads
   the RENDERED pages, both locales, and checks each old sentence is gone and each
   new one is there. The static twin the API gate runs is
   apps/api/test/legal-truth.test.ts; phase-a-logs/l6.md names the behavioural test
   behind every claim.

   ADDED, never edited into an existing spec. Written by lane L6, not run by it. */

const text = async (page: Page, path: string) => {
  await page.goto(path);
  return (await page.locator("main").innerText()).replace(/\s+/g, " ");
};

/* Never on either page, in either locale. */
const NEVER = [
  "sans compte",
  "te joindre",
  "par SMS",
  "de la main à la main",
  "à régler au prof",
  "en main propre",
  "après la séance",
];

/* The payment stories and rails D4 retired (the same list as e2e/payment-story.spec.ts). */
const OTHER_STORIES: RegExp[] = [
  /en main propre/i,
  /de la main à la main/i,
  /(paies|payes|règles) (ton|le) prof/i,
  /te paie(nt)? directement/i,
  /directement avec (ton prof|lui)/i,
  /au mois, si tu préfères|ou au mois/i,
  /après la séance|après chaque séance/i,
  /paie(ment)? en dinar/i,
  /paiement direct/i,
  /konnect|clictopay|e-?dinar|flouci|\bD17\b|carte bancaire/i,
  /s'arranger financièrement/i,
  /يد بيد|في يدك|بالشهر|تخلّص أستاذك مباشرة|يخلّصك مباشرة|خلاص مباشر|خلّص بالدينار|الخلاص بالدينار|يتفاهمو على الخلاص برّة/,
];

const SHOULD: Record<"fr" | "ar", Record<"privacy" | "terms", { gone: string[]; there: string[] }>> = {
  fr: {
    privacy: {
      gone: [
        "une séance, un document ou un message, sans compte",
        "Les coordonnées (numéro, email, lien) en sont retirées automatiquement",
        "tes documents partagés et ta photo sont effacés du stockage",
        "Tnajem est utilisé par des collégiens et des lycéens",
        "beaucoup d'élèves sont mineurs",
        "le nom, le téléphone et l'adresse e-mail du parent",
        "Ta page publique de prof (nom, matière, bio, photo)",
      ],
      there: [
        // §4.1 — a message needs a participant's account
        "Un message, lui, se signale depuis sa conversation, par l'élève ou le prof qui y participe, connecté à son compte",
        // §4.2 — A1
        "les coordonnées sont masquées automatiquement, en entier",
        "wa.me",
        "t.me",
        // §4.3 — A11
        "toutes tes photos — y compris les versions que tu avais remplacées — sont effacés du stockage",
        "Quand tu remplaces ou supprimes ta photo, l'ancienne est effacée du stockage",
        // §4.4 — A27
        "ton nom, ton e-mail et ton téléphone sont aussi effacés de cet accord",
        // §4.5 — A28
        "« Contenu retiré par la modération »",
        // A24 / A14
        "Pendant le pilote, Tnajem est réservé aux 18 ans et plus",
        "ton mois et ton année de naissance",
        // A2
        `${THREAD_CLOSE_DAYS} jours après la fin de la séance`,
        "Une conversation fermée reste lisible, et on peut encore y signaler un message, mais plus personne ne peut y écrire",
        // A23
        "ton prénom suivi de l'initiale de ton nom",
        "Ton nom complet n'est montré ni aux élèves ni au public",
        // A3
        "jamais montré à un prof ou à un élève",
        // A18.2
        "nous ne demandons pas son téléphone",
      ],
    },
    terms: {
      gone: [
        "un document ou un message — sans compte —",
        "nous pouvons retirer un contenu ou suspendre un compte",
        "son nom, son téléphone et son adresse e-mail",
        "Aucune carte",
      ],
      there: [
        "Un message se signale depuis sa conversation, par l'élève ou le prof qui y participe, connecté à son compte",
        "avec le bouton « Signaler »",
        "Dans un avis ou un message, les coordonnées sont masquées en entier",
        "nous pouvons masquer un message ou un avis, retirer un document ou suspendre un compte",
        "« Contenu retiré par la modération »",
        "Pendant le pilote, Tnajem est réservé aux 18 ans et plus",
        "Prof : tu dois avoir 18 ans ou plus",
        `${THREAD_CLOSE_DAYS} jours après la fin de la séance`,
        "un élève voit le prénom de son prof et l'initiale de son nom",
        "jamais montré à un prof ou à un élève",
        "Si tu annules ta séance offerte moins de 48 heures avant le début, elle compte comme utilisée",
        "Si le prof a déplacé la séance après ta réservation, rien n'est retenu",
      ],
    },
  },
  ar: {
    privacy: {
      gone: [
        "وثيقة ولا رسالة، بلا حساب",
        "الملفات اللي شاركتهم وتصويرتك يتمسحو",
        "تنجّم يستعملوها تلاميذ إعدادي وثانوي",
        "يخدم باش نلقاوك",
      ],
      there: [
        "تتبلّغ من المحادثة متاعها، من التلميذ ولا الأستاذ اللي فيها، وهو داخل لحسابو",
        "wa.me",
        "حتى النسخ القديمة اللي بدّلتها",
        "يتمسحو زادة من الموافقة هاذي",
        "« المحتوى هذا تنحّى من طرف المراقبة »",
        "في فترة التجربة، تنجّم كان للّي عمرهم 18 سنة وفوق",
        `${THREAD_CLOSE_DAYS} أيّام بعد ما تكمل الحصة`,
        "الحرف الأوّل من لقبك",
        "ما نطلبوش التليفون متاعو",
      ],
    },
    terms: {
      gone: [
        "وثيقة ولا رسالة — بلا حساب —",
        "ننجّمو ننحّيو محتوى ولا نعلّقو حساب",
        "يتفاهمو على الخلاص برّة تنجّم",
        "يخدم باش نلقاوك",
      ],
      there: [
        "تتبلّغ من المحادثة متاعها، من التلميذ ولا الأستاذ اللي فيها، وهو داخل لحسابو",
        "ننجّمو نخبّيو رسالة ولا تقييم، ننحّيو وثيقة ولا نعلّقو حساب",
        "« المحتوى هذا تنحّى من طرف المراقبة »",
        "في فترة التجربة، تنجّم كان للّي عمرهم 18 سنة وفوق",
        `${THREAD_CLOSE_DAYS} أيّام بعد ما تكمل الحصة`,
        "الحرف الأوّل من لقبو",
      ],
    },
  },
};

for (const locale of ["fr", "ar"] as const) {
  for (const doc of ["privacy", "terms"] as const) {
    test(`/${locale}/${doc}: the old false sentences are gone and the Phase A behaviour is described`, async ({ page }) => {
      const url = `/${locale}/${doc}`;
      const t = await text(page, url);
      for (const s of NEVER) expect(t, `${url} still says « ${s} »`).not.toContain(s);
      for (const s of SHOULD[locale][doc].gone) expect(t, `${url} still says « ${s} »`).not.toContain(s);
      for (const s of SHOULD[locale][doc].there) expect(t, `${url} is missing « ${s} »`).toContain(s);
      for (const re of OTHER_STORIES) expect(t, `${url}: another payment story (${re})`).not.toMatch(re);
    });

    test(`/${locale}/${doc}: the one payment sentence appears only as the future, labelled « ${PAYMENT_STORY[locale].soon} »`, async ({ page }) => {
      const url = `/${locale}/${doc}`;
      const t = await text(page, url);
      const stories = page.locator("[data-payment-story]");
      const n = await stories.count();
      expect(n, `${url} carries the payment paragraph (A22)`).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) {
        const el = stories.nth(i);
        await expect(el, `${url}: payments are off, so the label must be visible`).toHaveAttribute("data-payment-story", "soon");
        await expect(el.getByText(PAYMENT_STORY[locale].soon, { exact: true })).toBeVisible();
      }
      const s = PAYMENT_STORY[locale];
      const sentences = t.split(s.student).length - 1 + (t.split(s.tutor).length - 1);
      expect(sentences, `${url}: the payment sentence appears outside its labelled element`).toBe(n);
    });
  }
}
