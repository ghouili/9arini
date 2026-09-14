import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { tutorStanding } from "@tnajem/shared";

/* A tutor's standing is either "new" or "rated" — never both. On 14 Sept one
   storefront header read "Nouveau prof · 1 240 élèves" above a "Pas encore
   d'avis" panel. The type makes that line unbuildable; these tests pin the rule
   that decides which side of the union a tutor lands on. */

describe("tutorStanding — reviews decide, nothing else", () => {
  test("no reviews is new, even with a student count", () => {
    assert.deepEqual(tutorStanding({ reviewCount: 0, rating: 0, students: 1240 }), { kind: "new" });
  });

  test("a stale rating mirror with zero reviews is still new", () => {
    // tutors.rating is a cached copy; a 4.9 with no review rows behind it is not a rating.
    assert.deepEqual(tutorStanding({ reviewCount: 0, rating: 4.9, students: 0 }), { kind: "new" });
  });

  test("one review makes a rated tutor, carrying the numbers", () => {
    assert.deepEqual(tutorStanding({ reviewCount: 1, rating: 4, students: 3 }), {
      kind: "rated",
      rating: 4,
      reviewCount: 1,
      students: 3,
    });
  });

  test("a rated tutor may have zero students (a review outlives a deleted account)", () => {
    const s = tutorStanding({ reviewCount: 2, rating: 4.5, students: 0 });
    assert.equal(s.kind, "rated");
    assert.equal(s.kind === "rated" && s.students, 0);
  });

  test("garbage counts never produce a rating", () => {
    assert.deepEqual(tutorStanding({ reviewCount: Number.NaN, rating: 5, students: 10 }), { kind: "new" });
    assert.deepEqual(tutorStanding({ reviewCount: -1, rating: 5, students: 10 }), { kind: "new" });
  });
});
