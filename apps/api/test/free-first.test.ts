import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isEffectivelyFreeFirst, tutorOffersFreeFirst } from "@tnajem/shared";

/* The free first session is a PROMISE ABOUT MONEY, so the rule that decides it
   gets a test rather than a comment.

   Before Step 6 the answer was `Boolean(classes.is_free_first)` and that column
   defaulted to true, so the platform promised a free session on behalf of every
   tutor who had never been asked — on ~30 screens, in the JSON-LD Offer, in the
   site meta description and in llms.txt. The rule is now an AND, and the tutor's
   opt-in is the master switch. */

describe("isEffectivelyFreeFirst — both halves must say yes", () => {
  test("tutor opted in AND class marked free -> free", () => {
    assert.equal(isEffectivelyFreeFirst(true, true), true);
  });

  test("tutor opted in but this class is paid -> NOT free", () => {
    // A tutor who offers free first sessions can still run a paid intensive.
    assert.equal(isEffectivelyFreeFirst(true, false), false);
  });

  test("THE REGRESSION: class flag true, tutor never opted in -> NOT free", () => {
    /* This is the exact shape of the bug. Every class row written before 0008
       carried is_free_first = true from the column default. Trusting the class
       flag alone meant a crafted request — or simply an old row — produced a
       booking marked free against a tutor who never agreed to give one away. */
    assert.equal(isEffectivelyFreeFirst(false, true), false);
  });

  test("neither -> NOT free", () => {
    assert.equal(isEffectivelyFreeFirst(false, false), false);
  });
});

describe("isEffectivelyFreeFirst — null and undefined read as NO", () => {
  /* Rows written before 0008 made is_free_first NOT NULL can still be null in a
     database that has not been migrated, and a DTO can carry undefined. Neither
     may ever be read as a promise: "we never asked" is not "yes". */
  const notYes: (boolean | null | undefined)[] = [null, undefined, false];

  for (const tutorFlag of notYes) {
    test(`tutor=${String(tutorFlag)} with class=true -> NOT free`, () => {
      assert.equal(isEffectivelyFreeFirst(tutorFlag, true), false);
    });
  }
  for (const classFlag of notYes) {
    test(`class=${String(classFlag)} with tutor=true -> NOT free`, () => {
      assert.equal(isEffectivelyFreeFirst(true, classFlag), false);
    });
  }
});

describe("isEffectivelyFreeFirst — only a real boolean true counts", () => {
  /* Strict === true, not a truthiness check. A JSON body is attacker-shaped
     input: `{"isFreeFirst": "yes"}` or `1` must not slip through a `!!` and
     become a free seat. TypeScript does not run at the wire. */
  const sneaky = [1, "true", "yes", "1", {}, []] as unknown[];
  for (const v of sneaky) {
    test(`${JSON.stringify(v)} is not true`, () => {
      assert.equal(isEffectivelyFreeFirst(v as boolean, true), false);
      assert.equal(isEffectivelyFreeFirst(true, v as boolean), false);
    });
  }
});

describe("tutorOffersFreeFirst — the tutor-level surfaces", () => {
  /* The storefront badge, the JSON-LD Offer and the profile meta description
     render for a tutor with no published class at all, which is how the claim
     ended up on every storefront in the catalogue. They ask this, not the
     per-class question. */
  test("true only for an explicit opt-in", () => {
    assert.equal(tutorOffersFreeFirst(true), true);
    assert.equal(tutorOffersFreeFirst(false), false);
    assert.equal(tutorOffersFreeFirst(null), false);
    assert.equal(tutorOffersFreeFirst(undefined), false);
  });
});
