import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  PLANS,
  planByCode,
  isPlanCode,
  defaultPlanCode,
  effectivePlan,
  subscriptionIsLive,
  canOpenAnotherClass,
  classLimitLabel,
  monthsOffered,
  tnd,
  type Plan,
} from "@tnajem/shared";

/* PLANS AND ENTITLEMENTS (Step 16).

   These are the numbers /tarifs publishes and the numbers POST /classes
   enforces. They are the same numbers because they come from one array — and
   this file is what stops that array being edited into something the page and
   the server read differently. */

const plan = (code: string): Plan => {
  const p = planByCode(code);
  assert.ok(p, `missing plan: ${code}`);
  return p;
};

describe("the catalogue", () => {
  test("every published price is a whole number of dinars", () => {
    /* A price of 29.5 TND would render as "29.5 TND" on /tarifs and would be
       stored as 29500 millimes — fine — but the copy formatter assumes a whole
       number, and a half-dinar subscription is not a decision anyone has made. */
    for (const p of PLANS) {
      assert.equal(p.monthlyMillimes % 1000, 0, `${p.code} monthly is not whole dinars`);
      assert.equal(p.yearlyMillimes % 1000, 0, `${p.code} yearly is not whole dinars`);
    }
  });

  test("no plan is priced below zero, and no yearly price exceeds 12 monthly", () => {
    for (const p of PLANS) {
      assert.ok(p.monthlyMillimes >= 0, `${p.code} monthly is negative`);
      assert.ok(p.yearlyMillimes >= 0, `${p.code} yearly is negative`);
      /* Paying yearly must never cost MORE than paying monthly for a year. That
         is not a rounding concern, it is the kind of thing a pricing edit does by
         accident and nobody notices until a tutor does the arithmetic. */
      assert.ok(
        p.yearlyMillimes <= p.monthlyMillimes * 12,
        `${p.code}: the annual price is worse than paying monthly`,
      );
    }
  });

  test("plan codes are unique", () => {
    assert.equal(new Set(PLANS.map((p) => p.code)).size, PLANS.length);
  });

  test("`pilot` is not listed — it is what everyone is on, not something to buy", () => {
    assert.equal(plan("pilot").listed, false);
    assert.equal(plan("pilot").maxClasses, null);
    assert.equal(plan("pilot").exploreBoost, 0, "the pilot must not buy placement");
  });

  test("a paid plan never gives LESS than a cheaper one", () => {
    /* Monotonicity. Somebody paying more must not get a lower class limit or a
       smaller boost — a pricing table that inverts is a bug people only find
       after they have paid for the wrong tier. */
    const paid = PLANS.filter((p) => p.listed).sort((a, b) => a.monthlyMillimes - b.monthlyMillimes);
    for (let i = 1; i < paid.length; i += 1) {
      const lo = paid[i - 1];
      const hi = paid[i];
      const loMax = lo.maxClasses ?? Number.POSITIVE_INFINITY;
      const hiMax = hi.maxClasses ?? Number.POSITIVE_INFINITY;
      assert.ok(hiMax >= loMax, `${hi.code} allows fewer classes than the cheaper ${lo.code}`);
      assert.ok(hi.exploreBoost >= lo.exploreBoost, `${hi.code} ranks below the cheaper ${lo.code}`);
    }
  });
});

describe("planByCode / isPlanCode", () => {
  test("an unknown code resolves to null, never to a default", () => {
    /* Deliberate: a caller that cannot name the plan has to decide what to do.
       Silently returning `gratuit` here would mean a typo'd grant quietly gives
       a tutor LESS than the admin intended, with no error anywhere. */
    assert.equal(planByCode("pr0"), null);
    assert.equal(planByCode(""), null);
    assert.equal(planByCode(null), null);
    assert.equal(planByCode(undefined), null);
  });

  test("isPlanCode refuses anything that is not a code", () => {
    assert.equal(isPlanCode("pro"), true);
    assert.equal(isPlanCode("PRO"), false);
    assert.equal(isPlanCode("pr0"), false);
    assert.equal(isPlanCode(42), false);
    assert.equal(isPlanCode(null), false);
  });
});

describe("the default plan follows the payments switch", () => {
  test("payments OFF -> pilot, and the pilot has no class limit", () => {
    assert.equal(defaultPlanCode(false), "pilot");
    assert.equal(effectivePlan(null, false).maxClasses, null);
  });

  test("payments ON -> gratuit, which allows exactly one open class", () => {
    /* THE CLIFF, asserted rather than left implicit. Flipping PAYMENTS_ENABLED
       drops every ungranted tutor from unlimited to one. That is intended — the
       alternative is grandfathering everyone into unlimited forever, which is a
       pricing decision disguised as a migration detail — and the admin grant
       exists so tutors can be moved onto plans before the switch. */
    assert.equal(defaultPlanCode(true), "gratuit");
    assert.equal(effectivePlan(null, true).maxClasses, 1);
  });

  test("a granted plan wins over the default, in both switch positions", () => {
    assert.equal(effectivePlan("pro", false).code, "pro");
    assert.equal(effectivePlan("pro", true).code, "pro");
  });

  test("a granted code this deploy does not know falls back to the DEFAULT", () => {
    /* The safe direction. An unknown code must not produce a plan object with
       undefined limits — `maxClasses: undefined` would make canOpenAnotherClass
       return false for everyone, locking out class creation entirely. */
    const p = effectivePlan("plan-from-the-future", false);
    assert.equal(p.code, "pilot");
    assert.notEqual(p.maxClasses, undefined);
  });
});

describe("subscriptionIsLive", () => {
  const NOW = Date.UTC(2026, 0, 15);
  const future = new Date(NOW + 86_400_000);
  const past = new Date(NOW - 86_400_000);

  test("active with no expiry is live", () => {
    assert.equal(subscriptionIsLive({ status: "active", expiresAt: null }, NOW), true);
  });

  test("active but expired is NOT live, without waiting for the nightly sweep", () => {
    /* The resolver is authoritative. If liveness depended on the cron having run,
       a tutor would keep an entitlement for up to a day after it ended — and
       worse, an admin could not grant a new plan because the partial unique index
       still saw the old row as active. */
    assert.equal(subscriptionIsLive({ status: "active", expiresAt: past }, NOW), false);
  });

  test("cancelled and expired rows are never live, expiry date regardless", () => {
    assert.equal(subscriptionIsLive({ status: "cancelled", expiresAt: future }, NOW), false);
    assert.equal(subscriptionIsLive({ status: "expired", expiresAt: future }, NOW), false);
  });

  test("no row at all is not live", () => {
    assert.equal(subscriptionIsLive(null, NOW), false);
    assert.equal(subscriptionIsLive(undefined, NOW), false);
  });

  test("an ISO string expiry is read the same as a Date", () => {
    assert.equal(subscriptionIsLive({ status: "active", expiresAt: future.toISOString() }, NOW), true);
    assert.equal(subscriptionIsLive({ status: "active", expiresAt: past.toISOString() }, NOW), false);
  });

  test("an UNPARSEABLE expiry is treated as dead, not as forever", () => {
    /* Fail closed. A corrupt date must not hand somebody an entitlement that
       never ends — the failure that costs money is the generous one. */
    assert.equal(subscriptionIsLive({ status: "active", expiresAt: "not-a-date" }, NOW), false);
  });

  test("the boundary: expiry exactly NOW is over", () => {
    assert.equal(subscriptionIsLive({ status: "active", expiresAt: new Date(NOW) }, NOW), false);
    assert.equal(subscriptionIsLive({ status: "active", expiresAt: new Date(NOW + 1) }, NOW), true);
  });
});

describe("canOpenAnotherClass", () => {
  test("unlimited always says yes", () => {
    assert.equal(canOpenAnotherClass(plan("pilot"), 0), true);
    assert.equal(canOpenAnotherClass(plan("pro"), 500), true);
  });

  test("the limit BINDS at the limit, not one past it", () => {
    /* Off-by-one on a paid entitlement is the difference between "5 cours" and
       "6 cours" on the pricing page. */
    const gratuit = plan("gratuit");
    assert.equal(canOpenAnotherClass(gratuit, 0), true);
    assert.equal(canOpenAnotherClass(gratuit, 1), false);

    const essentiel = plan("essentiel");
    assert.equal(canOpenAnotherClass(essentiel, 4), true);
    assert.equal(canOpenAnotherClass(essentiel, 5), false);
    assert.equal(canOpenAnotherClass(essentiel, 9), false);
  });
});

describe("the labels /tarifs renders", () => {
  test("the class-limit bullet matches the enforced number, in both locales", () => {
    assert.equal(classLimitLabel(1, "fr"), "1 cours en ligne");
    assert.equal(classLimitLabel(5, "fr"), "Jusqu'à 5 cours");
    assert.equal(classLimitLabel(null, "fr"), "Cours illimités");
    assert.ok(classLimitLabel(5, "ar").includes("5"));
    assert.notEqual(classLimitLabel(null, "ar"), classLimitLabel(5, "ar"));
  });

  test("a changed limit changes the bullet — the page cannot advertise the old one", () => {
    assert.equal(classLimitLabel(3, "fr"), "Jusqu'à 3 cours");
  });

  test('"2 mois offerts" is derived from the two prices', () => {
    assert.equal(monthsOffered(plan("essentiel")), 2);
    assert.equal(monthsOffered(plan("pro")), 2);
    assert.equal(monthsOffered(plan("prestige")), 2);
  });

  test("a free plan offers no months, and never divides by zero", () => {
    assert.equal(monthsOffered(plan("gratuit")), 0);
    assert.equal(monthsOffered(plan("pilot")), 0);
  });

  test("a yearly price with no discount claims nothing", () => {
    const noDiscount: Plan = {
      code: "pro",
      monthlyMillimes: 10_000,
      yearlyMillimes: 120_000,
      maxClasses: null,
      exploreBoost: 0,
      listed: true,
    };
    assert.equal(monthsOffered(noDiscount), 0);
  });

  test("millimes convert to the dinars the page prints", () => {
    assert.equal(tnd(29_000), 29);
    assert.equal(tnd(0), 0);
    assert.equal(tnd(990_000), 990);
  });
});
