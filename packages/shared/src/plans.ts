/* PLANS AND ENTITLEMENTS (Step 16).

   ── WHY THE CATALOGUE IS CODE AND NOT A TABLE ────────────────────────────────
   There IS a `plans` table — it is the FK target for a grant, so a typo'd plan
   code is refused by Postgres instead of silently falling back to the default,
   and it is the catalogue of record for anyone reading the database. But the
   numbers BELOW are what the server enforces.

   The split is deliberate. Which plan a tutor is on is DATA: an admin grants it,
   it expires, it changes per tutor. What a plan GIVES YOU is a product decision,
   and a product decision must ship with the deploy that implements it — an
   UPDATE in psql must not be able to change what every tutor on Pro is entitled
   to, silently, with no diff and no review.

   The two are pinned together by a test that reads the table and compares it to
   this array, so the row can never quietly become a lie to whoever reads it.

   ── NOTHING HERE IS BILLED ───────────────────────────────────────────────────
   paymentsEnabled() is false. These prices are the FINAL model and they are
   FUTURE; /tarifs renders them from this same array and labels them as future.
   A grant made by an admin today charges nobody and creates no debt. */

export type PlanCode = "pilot" | "gratuit" | "essentiel" | "pro" | "prestige";

export type Plan = {
  code: PlanCode;
  /** Monthly price in MILLIMES (integer minor units; 1 TND = 1000). */
  monthlyMillimes: number;
  /** Annual price in millimes. Lower than 12× monthly where months are offered. */
  yearlyMillimes: number;
  /** How many classes may be OPEN at once. `null` = unlimited. */
  maxClasses: number | null;
  /** /explore ordering weight. 0 = no boost, and 0 is the pilot's value. */
  exploreBoost: number;
  /** Shown on /tarifs. `pilot` is not a plan anyone can buy. */
  listed: boolean;
};

export const MILLIMES_PER_TND = 1000;

/* ── THE CATALOGUE ───────────────────────────────────────────────────────────

   `pilot` is first and is not listed. It is what every tutor is on today, and it
   grants everything, because that is exactly what /tarifs promises right now:
   "Gratuit pendant le pilote — aucune de ces offres n'est encore facturée."
   Enforcing the Gratuit plan's 1-class limit while telling tutors nothing is
   billed yet would be charging them in capability and calling it free. */
export const PLANS: readonly Plan[] = [
  { code: "pilot",     monthlyMillimes: 0,      yearlyMillimes: 0,      maxClasses: null, exploreBoost: 0, listed: false },
  { code: "gratuit",   monthlyMillimes: 0,      yearlyMillimes: 0,      maxClasses: 1,    exploreBoost: 0, listed: true },
  { code: "essentiel", monthlyMillimes: 29_000, yearlyMillimes: 290_000, maxClasses: 5,   exploreBoost: 0, listed: true },
  { code: "pro",       monthlyMillimes: 59_000, yearlyMillimes: 590_000, maxClasses: null, exploreBoost: 1, listed: true },
  { code: "prestige",  monthlyMillimes: 99_000, yearlyMillimes: 990_000, maxClasses: null, exploreBoost: 2, listed: true },
] as const;

export const PLAN_CODES: readonly PlanCode[] = PLANS.map((p) => p.code);

export function isPlanCode(v: unknown): v is PlanCode {
  return typeof v === "string" && PLAN_CODES.includes(v as PlanCode);
}

/** The plan, or null for an unknown code. Never a silent fallback: a caller that
    cannot name the plan must decide what to do, because guessing here means
    guessing someone's entitlements. */
export function planByCode(code: string | null | undefined): Plan | null {
  return PLANS.find((p) => p.code === code) ?? null;
}

/* THE DEFAULT PLAN — what a tutor with no subscription is on.

   Keyed off the SAME switch that drives the /tarifs banner, so the page and the
   server cannot disagree about whether billing has started. The day
   PAYMENTS_ENABLED=1, the banner stops saying "nothing is billed" and the
   default drops from `pilot` to `gratuit` in the same breath.

   THAT IS A CLIFF AND IT IS MEANT TO BE VISIBLE: a tutor with seven open classes
   and no subscription can no longer open an eighth the moment payments go live.
   Nothing already published is touched or hidden. The admin grant exists so that
   whoever flips the switch can move tutors onto plans first — the alternative,
   grandfathering everyone silently into unlimited forever, is a pricing decision
   dressed up as a migration detail. */
export function defaultPlanCode(paymentsAreEnabled: boolean): PlanCode {
  return paymentsAreEnabled ? "gratuit" : "pilot";
}

/** The plan a tutor is actually on: their live grant, else the default. */
export function effectivePlan(
  grantedCode: string | null | undefined,
  paymentsAreEnabled: boolean,
): Plan {
  const granted = planByCode(grantedCode);
  if (granted) return granted;
  /* The default is a code in PLANS, so this cannot be null — but assert rather
     than `!`, because a future edit that removes `pilot` should fail loudly here
     and not hand every tutor an undefined entitlement. */
  const fallback = planByCode(defaultPlanCode(paymentsAreEnabled));
  if (!fallback) throw new Error("[Tnajem] the default plan is missing from PLANS");
  return fallback;
}

/** Is this subscription live right now? `null` expiry means no expiry. */
export function subscriptionIsLive(
  sub: { status: string; expiresAt: Date | string | null } | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!sub || sub.status !== "active") return false;
  if (sub.expiresAt === null || sub.expiresAt === undefined) return true;
  const at = sub.expiresAt instanceof Date ? sub.expiresAt.getTime() : Date.parse(String(sub.expiresAt));
  return Number.isNaN(at) ? false : at > now;
}

/* ── THE CLASS LIMIT ─────────────────────────────────────────────────────────

   "1 cours en ligne" / "Jusqu'à 5 cours" counts what is OPEN — upcoming and not
   cancelled — not what has ever existed. A tutor on the free plan who taught a
   class last month has not spent their allowance forever; that reading would
   turn a listing limit into a lifetime quota, which is not what the page sells. */
export function canOpenAnotherClass(plan: Plan, openClasses: number): boolean {
  return plan.maxClasses === null || openClasses < plan.maxClasses;
}

/** The bilingual bullet on /tarifs. Derived, so the page can never advertise a
    limit different from the one the API enforces. */
export function classLimitLabel(maxClasses: number | null, locale: "fr" | "ar"): string {
  if (maxClasses === null) return locale === "ar" ? "دروس بلا حدّ" : "Cours illimités";
  if (maxClasses === 1) return locale === "ar" ? "درس واحد أونلاين" : "1 cours en ligne";
  return locale === "ar" ? `حتى لـ ${maxClasses} دروس` : `Jusqu'à ${maxClasses} cours`;
}

/** Whole TND, for display. Every catalogue price is a whole number of dinars. */
export function tnd(millimes: number): number {
  return millimes / MILLIMES_PER_TND;
}

/** How many months of the yearly price are free, 0 when none are. Derived so
    "2 mois offerts" cannot survive a price change that makes it untrue. */
export function monthsOffered(plan: Plan): number {
  if (plan.monthlyMillimes <= 0) return 0;
  const full = plan.monthlyMillimes * 12;
  const saved = full - plan.yearlyMillimes;
  return saved > 0 ? Math.round(saved / plan.monthlyMillimes) : 0;
}
