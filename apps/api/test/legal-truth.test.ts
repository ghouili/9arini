import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { THREAD_CLOSE_DAYS } from "@tnajem/shared";
import { MODERATION_PLACEHOLDER } from "../src/lib/moderation-hide";
import {
  startApp, stopApp, seedProfile, seedTutor, seedClass, seedBooking, login, call, sql, type App,
} from "./support/fx";

/* phase-a lane L6 (A19) — /privacy AND /terms SAY ONLY WHAT THE CODE DOES.

   The CEO report (§4) found five sentences on these two pages that the code did not
   keep, and Batches 1–5 changed what several others describe. This is the part the
   API gate can run: it reads the two page sources (comments stripped, split into the
   FR and AR copy) and checks that each old false sentence is gone or rephrased, and
   that the sentences describing the Phase A behaviour are there. Each new claim is
   backed by a behavioural test elsewhere (named in phase-a-logs/l6.md). The last
   block drives the one claim no other API test covered: reporting a message needs a
   participant's account.

   The rendered twin — /fr and /ar, both pages, through the browser — is
   e2e/legal-truth.spec.ts. */

const here = dirname(fileURLToPath(import.meta.url));
const PAGE = {
  privacy: resolve(here, "../../web/app/[locale]/privacy/page.tsx"),
  terms: resolve(here, "../../web/app/[locale]/terms/page.tsx"),
} as const;

/** Comments out, strings in. `//` only when it starts a comment, so a URL survives. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
}

type Copy = { raw: string; all: string; fr: string; ar: string };
function read(page: keyof typeof PAGE): Copy {
  const raw = readFileSync(PAGE[page], "utf8");
  const all = stripComments(raw);
  const at = all.search(/\n {2}ar: \{/);
  assert.ok(at > 0, `${page}: the page keeps its { fr, ar } copy object`);
  return { raw, all, fr: all.slice(0, at), ar: all.slice(at) };
}

const privacy = read("privacy");
const terms = read("terms");
const both = [["privacy", privacy], ["terms", terms]] as const;

const has = (hay: string, needle: string, why: string) => assert.ok(hay.includes(needle), `${why}: missing « ${needle} »`);
const hasNot = (hay: string, needle: string, why: string) => assert.ok(!hay.includes(needle), `${why}: still says « ${needle} »`);

describe("A19 · the five sentences of CEO report §4", () => {
  test("1. a message is no longer reportable « sans compte »: it needs a participant's account", () => {
    for (const [name, c] of both) {
      hasNot(c.all, "sans compte", name);
      hasNot(c.ar, "بلا حساب", `${name} (ar)`);
      has(c.fr, "se signale depuis sa conversation, par l'élève ou le prof qui y participe, connecté à son compte", name);
      has(c.ar, "تتبلّغ من المحادثة متاعها، من التلميذ ولا الأستاذ اللي فيها، وهو داخل لحسابو", `${name} (ar)`);
    }
    hasNot(privacy.fr, "une séance, un document ou un message, sans compte", "privacy");
    hasNot(terms.fr, "un document ou un message — sans compte —", "terms");
  });

  test("2. contact details: the whole number or handle is masked, messaging links included (A1)", () => {
    hasNot(privacy.fr, "Les coordonnées (numéro, email, lien) en sont retirées automatiquement", "privacy");
    for (const needle of ["wa.me", "t.me", "Facebook", "Instagram", "+216", "masquées automatiquement, en entier"]) has(privacy.fr, needle, "privacy");
    has(privacy.fr, "Ce filtre n'attrape pas tout", "privacy");
    for (const needle of ["wa.me", "t.me", "+216"]) has(privacy.ar, needle, "privacy (ar)");
    has(terms.fr, "Dans un avis ou un message, les coordonnées sont masquées en entier", "terms");
    has(terms.ar, "في التقييم ولا الرسالة، معلومات الاتصال تتخبّى بالكامل", "terms (ar)");
  });

  test("3. every photo is erased, earlier versions included; a replaced photo is deleted (A11)", () => {
    hasNot(privacy.fr, "tes documents partagés et ta photo sont effacés du stockage", "privacy");
    has(privacy.fr, "toutes tes photos — y compris les versions que tu avais remplacées — sont effacés du stockage", "privacy");
    has(privacy.fr, "Quand tu remplaces ou supprimes ta photo, l'ancienne est effacée du stockage", "privacy");
    hasNot(privacy.ar, "الملفات اللي شاركتهم وتصويرتك يتمسحو", "privacy (ar)");
    has(privacy.ar, "حتى النسخ القديمة اللي بدّلتها", "privacy (ar)");
    has(privacy.ar, "القديمة تتمسح من التخزين", "privacy (ar)");
  });

  test("4. a parent's name, e-mail and phone are erased from the child's consent too (A27)", () => {
    has(privacy.fr, "ton nom, ton e-mail et ton téléphone sont aussi effacés de cet accord", "privacy");
    has(privacy.fr, "il n'en reste que le fait qu'il a été donné, sa date, son texte et sa version", "privacy");
    has(privacy.fr, "Accord parental : conservé tant que le compte de l'enfant existe", "privacy §5");
    has(privacy.ar, "يتمسحو زادة من الموافقة هاذي", "privacy (ar)");
    has(privacy.ar, "موافقة الوليّ: تتحفظ ما دام حساب الطفل موجود", "privacy §5 (ar)");
  });

  test("5. « nous pouvons retirer un contenu » now says what an admin can do (A28)", () => {
    hasNot(terms.fr, "nous pouvons retirer un contenu ou suspendre un compte", "terms");
    has(terms.fr, "nous pouvons masquer un message ou un avis, retirer un document ou suspendre un compte", "terms");
    hasNot(terms.ar, "ننجّمو ننحّيو محتوى ولا نعلّقو حساب", "terms (ar)");
    has(terms.ar, "ننجّمو نخبّيو رسالة ولا تقييم، ننحّيو وثيقة ولا نعلّقو حساب", "terms (ar)");
    for (const [name, c] of both) {
      has(c.fr, MODERATION_PLACEHOLDER.fr, `${name}: the placeholder readers actually see`);
      has(c.ar, MODERATION_PLACEHOLDER.ar, `${name} (ar): the placeholder readers actually see`);
    }
    has(privacy.fr, "seuls les administrateurs peuvent encore le lire", "privacy");
  });
});

describe("A19 · what Batches 1–5 changed", () => {
  test("the adult-only pilot, with birth month + year (A24, A14)", () => {
    for (const [name, c] of both) {
      has(c.fr, "Pendant le pilote, Tnajem est réservé aux 18 ans et plus", name);
      has(c.fr, "mois et ton année de naissance", name);
      has(c.fr, "tu comptes comme majeur à partir du mois qui suit celui de tes 18 ans", name);
      has(c.ar, "في فترة التجربة، تنجّم كان للّي عمرهم 18 سنة وفوق", `${name} (ar)`);
      has(c.ar, "شهر وعام ولادتك", `${name} (ar)`);
    }
    hasNot(privacy.fr, "Tnajem est utilisé par des collégiens et des lycéens", "privacy");
    hasNot(privacy.fr, "beaucoup d'élèves sont mineurs", "privacy");
    hasNot(privacy.fr, "ton année de naissance (uniquement pour savoir si un accord parental est nécessaire)", "privacy");
    hasNot(privacy.ar, "تنجّم يستعملوها تلاميذ إعدادي وثانوي", "privacy (ar)");
    has(terms.fr, "Prof : tu dois avoir 18 ans ou plus", "terms");
  });

  test("conversations close — immediately on a block or a withdrawal, else THREAD_CLOSE_DAYS after the class (A2)", () => {
    assert.equal(THREAD_CLOSE_DAYS, 7, "FOUNDER default the pages quote");
    for (const [name, c] of both) {
      has(c.all, "THREAD_CLOSE_DAYS", `${name}: the number comes from @tnajem/shared, not typed in`);
      has(c.fr, "${THREAD_CLOSE_DAYS} jours après la fin de la séance", name);
      has(c.fr, "quand l'un des deux comptes est suspendu ou quand un parent retire son accord", name);
      has(c.fr, "Une conversation fermée reste lisible, et on peut encore y signaler un message, mais plus personne ne peut y écrire", name);
      has(c.ar, "${THREAD_CLOSE_DAYS} أيّام بعد ما تكمل الحصة", `${name} (ar)`);
    }
    hasNot(privacy.fr, "Quand une réservation est annulée, la conversation reste lisible mais on ne peut plus y écrire.", "privacy");
  });

  test("students see a tutor as first name + initial (A23)", () => {
    has(privacy.fr, "ton prénom suivi de l'initiale de ton nom", "privacy §4");
    has(privacy.fr, "Ton nom complet n'est montré ni aux élèves ni au public", "privacy §4");
    hasNot(privacy.fr, "Ta page publique de prof (nom, matière, bio, photo)", "privacy §4");
    has(terms.fr, "un élève voit le prénom de son prof et l'initiale de son nom", "terms §8");
    // phase-a/verify-fix (D12): in a conversation the student sees the first name only (publicDisplayName).
    has(terms.fr, "dans une conversation, son prénom seulement", "terms §8");
    hasNot(terms.fr, "un élève voit le prénom de son prof. ", "terms §8");
    for (const [name, c] of both) has(c.ar, "الحرف الأوّل من لقب", `${name} (ar)`);
  });

  test("payments: one future story, labelled « Bientôt », and nothing else (A22, D4)", () => {
    for (const [name, c] of both) {
      has(c.all, "<PaymentStory", `${name}: the labelled sentence is rendered by the shared component`);
      for (const half of [c.fr, c.ar]) {
        assert.match(half, /story: \{\s*audience: "student",\s*note: "[^"]{20,}"/, `${name}: the labelled sentence, with its note, in both locales`);
      }
      for (const banned of ["Konnect", "ClicToPay", "e-dinar", "de la main à la main", "à régler au prof", "en main propre", "au mois", "après la séance", "Aucune carte", "s'arranger financièrement"]) {
        hasNot(c.all, banned, name);
      }
      for (const banned of ["يتفاهمو على الخلاص برّة", "حتى بطاقة"]) hasNot(c.ar, banned, `${name} (ar)`);
    }
  });

  test("the phone is for Tnajem's own messages, never shown to a tutor (A3)", () => {
    for (const [name, c] of both) {
      hasNot(c.fr, "te joindre", name);
      hasNot(c.ar, "نلقاوك", `${name} (ar)`);
      has(c.fr, "messages que Tnajem peut t'envoyer sur ton compte et tes séances", name);
      hasNot(c.all, "SMS", `${name}: no SMS is promised (SMS is optional and off by default)`);
      has(c.fr, "jamais montré à un prof ou à un élève", name);
      has(c.ar, "عمرو ما يتوّرى لأستاذ ولا لتلميذ", `${name} (ar)`);
    }
  });

  test("a guardian's phone is no longer collected (A18.2)", () => {
    hasNot(privacy.fr, "le nom, le téléphone et l'adresse e-mail du parent", "privacy");
    hasNot(privacy.fr, "Nom et téléphone du parent", "privacy");
    hasNot(privacy.fr, "dont nous conservons le nom, le téléphone, l'adresse e-mail", "privacy §8");
    hasNot(terms.fr, "son nom, son téléphone et son adresse e-mail", "terms");
    has(privacy.fr, "ne demandons pas son téléphone", "privacy");
    has(privacy.ar, "ما نطلبوش التليفون متاعو", "privacy (ar)");
  });

  test("every sentence on retention, lawful basis or consent that changed carries a LEGAL-REVIEW marker", () => {
    for (const [name, c] of both) {
      const n = (c.raw.match(/LEGAL-REVIEW:/g) ?? []).length;
      assert.ok(n >= 4, `${name}: only ${n} LEGAL-REVIEW markers`);
    }
  });
});

/* ── The one claim no API test backed: reporting a message needs a participant ── */

let app: App;
const threadIds: string[] = [];
const messageIds: string[] = [];

before(async () => {
  app = await startApp();
});
after(async () => {
  for (const id of messageIds) {
    await sql`delete from reports where subject_kind = 'message' and subject_id = ${id}`;
    await sql`delete from message_reports where message_id = ${id}`;
  }
  for (const id of threadIds) await sql`delete from message_threads where id = ${id}`; // messages cascade
  await stopApp(app);
});

describe("A19 · « un message se signale depuis sa conversation, par l'élève ou le prof qui y participe »", () => {
  test("signed out: refused; a stranger: not found; the other participant: filed", async () => {
    const tutor = await seedTutor();
    const klass = await seedClass({ tutorId: tutor.id });
    const student = await seedProfile({ role: "student", birthYear: 1995 });
    const booking = await seedBooking({ classId: klass.id, studentId: student.id });
    const threadId = randomUUID();
    await sql`insert into message_threads (id, booking_id, class_id, tutor_profile_id, student_profile_id)
              values (${threadId}, ${booking.id}, ${klass.id}, ${tutor.profileId}, ${student.id})`;
    threadIds.push(threadId);
    const messageId = randomUUID();
    await sql`insert into messages (id, thread_id, sender_profile_id, body)
              values (${messageId}, ${threadId}, ${tutor.profileId}, 'Un message à signaler.')`;
    messageIds.push(messageId);

    const anonymous = await call(app, "POST", `/messages/${messageId}/report`, null, {});
    assert.deepEqual(anonymous.body, { ok: false, error: "not-authenticated" }, anonymous.raw);

    const stranger = await seedProfile({ role: "student", birthYear: 1990 });
    const outsider = await call(app, "POST", `/messages/${messageId}/report`, await login(stranger.id), {});
    assert.deepEqual(outsider.body, { ok: false, error: "not-found" }, outsider.raw);

    const participant = await call(app, "POST", `/messages/${messageId}/report`, await login(student.id), {});
    assert.equal(participant.body?.ok, true, participant.raw);
  });
});
