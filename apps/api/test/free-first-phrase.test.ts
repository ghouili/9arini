import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mentionsFreeFirstSession } from "@tnajem/shared";

/* The onboarding form warns a tutor whose bio promises a free first session
   while their free-session option is OFF: the page would advertise something the
   booking flow does not honour. These pin what counts as that promise. */

describe("mentionsFreeFirstSession — the promise, however it is written", () => {
  const promises = [
    "« Spécialiste révisions Bac. 1ère séance offerte. »",
    "Première séance gratuite !",
    "1er cours offert pour tester.",
    "Le premier cours est gratuit.",
    "La 1ʳᵉ séance est offerte.",
    "Séance d'essai gratuite",
    "Essai gratuit, sans engagement",
    "awel séance bilech",
    "el 7essa lowla fabor",
    "Awel ders b blech",
    "الحصة الأولى مجانية",
    "أول حصة مجانية",
    "أوّل درس بلاش",
  ];
  for (const text of promises) {
    test(`promise: ${text}`, () => assert.equal(mentionsFreeFirstSession(text), true));
  }

  const notPromises = [
    "Spécialiste révisions Bac. On révise à ton rythme.",
    "Première séance : on fait le point sur ton niveau.",
    "Les annales corrigées sont offertes aux élèves inscrits.",
    "Cours gratuit sur YouTube le dimanche.",
    "Séance de 90 minutes, 20 TND.",
    "الحصة الأولى نعملو فيها تقييم",
    "",
  ];
  for (const text of notPromises) {
    test(`not a promise: ${JSON.stringify(text)}`, () => assert.equal(mentionsFreeFirstSession(text), false));
  }

  test("null and undefined are not a promise", () => {
    assert.equal(mentionsFreeFirstSession(null), false);
    assert.equal(mentionsFreeFirstSession(undefined), false);
  });
});
