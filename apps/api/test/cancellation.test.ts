import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  cancellationOutcome,
  CANCEL_FREE_WINDOW_HOURS,
  CANCEL_FREE_WINDOW_MS,
  LATE_CANCEL_RETAINED_PCT,
} from "@tnajem/shared";

/* The 48h / 40% rule. A deadline and a percentage are the two things a user will
   dispute, so both get pinned here rather than trusted to a comment. */

const H = 60 * 60 * 1000;
const START = Date.UTC(2026, 8, 20, 18, 0, 0); // a fixed instant; no wall clock in tests

/** Cancel `hoursBefore` hours before START, on a seat worth `amount`. */
const at = (hoursBefore: number, amount = 20) =>
  cancellationOutcome({ scheduledAt: START, amountTnd: amount, now: START - hoursBefore * H });

describe("the constants are the ones the copy promises", () => {
  test("48 hours", () => {
    assert.equal(CANCEL_FREE_WINDOW_HOURS, 48);
    assert.equal(CANCEL_FREE_WINDOW_MS, 48 * H);
  });
  test("40 percent", () => {
    assert.equal(LATE_CANCEL_RETAINED_PCT, 0.4);
  });
});

describe("THE BOUNDARY — 47h59m / 48h00m / 48h01m", () => {
  /* The tie goes to the STUDENT: "jusqu'à 48 heures avant" reads as inclusive,
     and Terms §7 now says so explicitly. Exactly 48h is free. */
  test("47h59m before -> LATE", () => {
    const o = cancellationOutcome({
      scheduledAt: START,
      amountTnd: 20,
      now: START - (47 * H + 59 * 60 * 1000),
    });
    assert.equal(o.late, true);
    assert.equal(o.retainedTnd, 8);
  });

  test("exactly 48h00m before -> FREE (inclusive boundary)", () => {
    const o = at(48);
    assert.equal(o.late, false);
    assert.equal(o.retainedTnd, 0);
    assert.equal(o.releasedTnd, 20);
  });

  test("48h01m before -> FREE", () => {
    const o = cancellationOutcome({
      scheduledAt: START,
      amountTnd: 20,
      now: START - (48 * H + 60 * 1000),
    });
    assert.equal(o.late, false);
    assert.equal(o.retainedTnd, 0);
  });

  test("one millisecond inside the window is already late", () => {
    const o = cancellationOutcome({
      scheduledAt: START,
      amountTnd: 20,
      now: START - (48 * H - 1),
    });
    assert.equal(o.late, true);
  });
});

describe("the money", () => {
  test("free cancellation retains nothing and releases everything", () => {
    const o = at(72, 35);
    assert.deepEqual(
      { late: o.late, retained: o.retainedTnd, released: o.releasedTnd },
      { late: false, retained: 0, released: 35 },
    );
  });

  test("late cancellation retains 40%", () => {
    const o = at(3, 35);
    assert.equal(o.late, true);
    assert.equal(o.retainedTnd, 14);
    assert.equal(o.releasedTnd, 21);
  });

  test("A FREE SESSION RETAINS NOTHING — 40% of zero is zero", () => {
    /* The case most likely to produce a wrong-looking number in front of a
       student: they cancelled a free first session late and must not be shown a
       retained amount at all. */
    const o = at(1, 0);
    assert.equal(o.late, true);
    assert.equal(o.amountTnd, 0);
    assert.equal(o.retainedTnd, 0);
    assert.equal(o.releasedTnd, 0);
  });

  test("retained + released === amount, exactly, for every price 0..200", () => {
    /* THE LEDGER INVARIANT: retained + released is exactly the amount.

       WHAT THIS DOES AND DOES NOT CATCH — measured, not assumed. Rewriting
       released as toCentimes(amount * 0.6) does NOT fail this test, because
       amount is pre-rounded to centimes and 0.4 x centimes never lands on a .5
       fractional part; the two forms agree across 0-2000 TND. What it does catch
       is dropping the rounding (0.2 + 0.306 = 0.506, not 0.51), a sign error, or
       a rate that stops summing to 1. It would also start discriminating the
       moment the rate becomes something like 1/3. */
    for (let cents = 0; cents <= 20000; cents += 1) {
      const amount = cents / 100;
      const o = at(1, amount);
      assert.equal(
        Math.round((o.retainedTnd + o.releasedTnd) * 100),
        Math.round(amount * 100),
        `ledger does not balance at ${amount} TND`,
      );
    }
  });

  test("amounts round to the centime, matching numeric(7,2)", () => {
    // 40% of 0.51 is 0.204 — must not persist a third decimal the column drops.
    const o = at(1, 0.51);
    assert.equal(o.retainedTnd, 0.2);
    assert.equal(o.releasedTnd, 0.31);
  });

  test("the applied rate is reported, so the ledger can store it", () => {
    assert.equal(at(1).retainedPct, LATE_CANCEL_RETAINED_PCT);
    assert.equal(at(72).retainedPct, 0);
  });
});

describe("hostile and degenerate input fails CLOSED", () => {
  test("a class that already started is late, not an error", () => {
    const o = at(-2, 20);
    assert.equal(o.late, true);
    assert.ok(o.msBeforeStart < 0);
  });

  test("an unparseable date is LATE, never free", () => {
    /* NaN loses every comparison, so `msBeforeStart < WINDOW` would be FALSE and
       an unparseable date would read as "free to cancel" — the generous answer,
       arrived at by accident. */
    const o = cancellationOutcome({ scheduledAt: "not a date", amountTnd: 20, now: START });
    assert.equal(o.late, true);
  });

  test("a negative amount cannot produce a negative retention", () => {
    const o = at(1, -50);
    assert.equal(o.amountTnd, 0);
    assert.equal(o.retainedTnd, 0);
    assert.equal(o.releasedTnd, 0);
  });

  test("a non-finite amount is treated as zero", () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      const o = at(1, bad);
      assert.equal(o.amountTnd, 0, `amount ${String(bad)}`);
      assert.equal(o.retainedTnd, 0);
    }
  });
});
