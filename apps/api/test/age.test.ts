import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isAdult, minorsAllowed, vBirthMonth } from "@tnajem/shared";

/* A24 · isAdult is FAIL-SAFE. Adult only when the 18th birthday fell in a month
   that is already over, in Africa/Tunis. In the birthday month itself the day is
   unknown, so the answer is "minor" until the month turns. A missing month or
   year is a minor. */

// 15 Sept 2026, noon in Tunis (UTC+1).
const SEPT_15 = new Date("2026-09-15T11:00:00Z");

describe("isAdult (birth month + year, Africa/Tunis)", () => {
  test("born October 2008 → 17 years 11 months in Sept 2026 → minor", () => {
    assert.equal(isAdult(2008, 10, SEPT_15), false);
  });
  test("born September 2008 → the birthday month itself → minor (the day is unknown)", () => {
    assert.equal(isAdult(2008, 9, SEPT_15), false);
  });
  test("born August 2008 → turned 18 last month → adult", () => {
    assert.equal(isAdult(2008, 8, SEPT_15), true);
  });
  test("a long-ago adult", () => {
    assert.equal(isAdult(1990, 1, SEPT_15), true);
  });
  test("a missing month is a minor, even for 1990", () => {
    assert.equal(isAdult(1990, null, SEPT_15), false);
    assert.equal(isAdult(1990, undefined, SEPT_15), false);
  });
  test("a missing year is a minor", () => {
    assert.equal(isAdult(null, 5, SEPT_15), false);
  });
  test("an out-of-range month is a minor", () => {
    assert.equal(isAdult(1990, 0, SEPT_15), false);
    assert.equal(isAdult(1990, 13, SEPT_15), false);
  });
  test("the month is Tunis's, not the server's: 30 Sept 23:30 UTC is already October in Tunis", () => {
    const lateSept = new Date("2026-09-30T23:30:00Z"); // 1 Oct 00:30 in Tunis
    assert.equal(isAdult(2008, 9, lateSept), true, "September is over in Tunis");
    assert.equal(isAdult(2008, 9, new Date("2026-09-30T22:30:00Z")), false, "still 30 Sept 23:30 in Tunis");
  });
});

describe("vBirthMonth", () => {
  test("accepts 1–12, as numbers or numeric strings", () => {
    assert.equal(vBirthMonth(1), 1);
    assert.equal(vBirthMonth("12"), 12);
  });
  test("anything else is null", () => {
    for (const v of [0, 13, 1.5, "", "x", null, undefined, NaN]) assert.equal(vBirthMonth(v), null, String(v));
  });
});

describe("minorsAllowed reads ALLOW_MINORS on every call", () => {
  test('only the exact string "1" switches minors on', () => {
    const prev = process.env.ALLOW_MINORS;
    try {
      delete process.env.ALLOW_MINORS;
      assert.equal(minorsAllowed(), false);
      process.env.ALLOW_MINORS = "1";
      assert.equal(minorsAllowed(), true);
      process.env.ALLOW_MINORS = "true";
      assert.equal(minorsAllowed(), false);
    } finally {
      if (prev === undefined) delete process.env.ALLOW_MINORS;
      else process.env.ALLOW_MINORS = prev;
    }
  });
});
