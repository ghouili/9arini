import { and, eq, gt, isNull, or, sql as raw, classes, subscriptions } from "@tnajem/db";
import {
  effectivePlan,
  planByCode,
  PLANS,
  type Plan,
  type PlanCode,
} from "@tnajem/shared";
import { paymentsEnabled } from "@tnajem/shared/payments";
import { db } from "../db";

/* ENTITLEMENTS (Step 16) — the ONE place that answers "what is this tutor
   allowed to do?".

   Everything that enforces a plan calls planForTutor(). Not a helper each route
   reimplements: this project's recurring bug has been two implementations of one
   rule that nothing forces to agree, and an entitlement resolved differently in
   two places means a tutor who is over the limit on one screen and under it on
   another.

   The NUMBERS come from @tnajem/shared PLANS. Only the GRANT comes from the
   database — see the header of packages/shared/src/plans.ts. */

/** SQL for "this subscription is live right now": active, and either open-ended
    or not yet past its expiry. Used by the resolver AND by the /explore join, so
    a boosted card and a granted entitlement can never disagree about liveness. */
export const subscriptionIsLiveSql = and(
  eq(subscriptions.status, "active"),
  or(isNull(subscriptions.expiresAt), gt(subscriptions.expiresAt, raw`now()`)),
);

/** The tutor's live grant, or null. */
export async function liveGrant(
  tutorId: string,
): Promise<{ code: PlanCode; expiresAt: Date | null } | null> {
  const [row] = await db
    .select({ code: subscriptions.planCode, expiresAt: subscriptions.expiresAt })
    .from(subscriptions)
    .where(and(eq(subscriptions.tutorId, tutorId), subscriptionIsLiveSql))
    .limit(1);
  /* planByCode, not a cast. A code in the table that this deploy does not know
     resolves to null and therefore to the DEFAULT plan — which is the safe
     direction — rather than to an object with undefined limits. */
  const known = planByCode(row?.code);
  return known ? { code: known.code, expiresAt: row?.expiresAt ?? null } : null;
}

/** The plan a tutor is actually on right now. */
export async function planForTutor(tutorId: string): Promise<Plan> {
  const grant = await liveGrant(tutorId);
  return effectivePlan(grant?.code ?? null, paymentsEnabled());
}

/** Everything the dashboard needs to explain the tutor's plan to them. */
export async function planStateForTutor(tutorId: string): Promise<{
  plan: Plan;
  granted: boolean;
  expiresAt: Date | null;
  openClasses: number;
}> {
  const [grant, openClasses] = await Promise.all([liveGrant(tutorId), openClassCount(tutorId)]);
  return {
    plan: effectivePlan(grant?.code ?? null, paymentsEnabled()),
    granted: grant !== null,
    expiresAt: grant?.expiresAt ?? null,
    openClasses,
  };
}

/* HOW MANY CLASSES COUNT AGAINST THE LIMIT.

   Open listings: scheduled in the future and not cancelled. Not "every class
   ever created" — a tutor on the free plan who taught a class last month has not
   spent their allowance forever, and reading it that way would turn the listing
   limit /tarifs sells into a lifetime quota nobody agreed to. Cancelled classes
   do not count either: they occupy nothing and are not bookable. */
export async function openClassCount(tutorId: string): Promise<number> {
  const [row] = await db
    .select({ n: raw<number>`count(*)::int` })
    .from(classes)
    .where(
      and(
        eq(classes.tutorId, tutorId),
        raw`coalesce(${classes.status}, 'scheduled') <> 'cancelled'`,
        gt(classes.scheduledAt, raw`now()`),
      ),
    );
  return row?.n ?? 0;
}

/* ── THE EXPIRY SWEEP ────────────────────────────────────────────────────────

   The RESOLVER is authoritative: a grant is dead the second its expiry passes,
   with no wait for a job to run. This sweep only settles the bookkeeping — it
   flips the status so the partial unique index frees up and so an admin reading
   the table is not shown an "active" row that expired in March.

   It is a separate job on the retention cron for the same reason the other three
   are separate: one failing must not stop the others. */
export async function expireSubscriptions(
  database: typeof db,
  opts: { dryRun?: boolean } = {},
): Promise<{ due: number; expired: number }> {
  const due = await database
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, "active"),
        raw`${subscriptions.expiresAt} is not null and ${subscriptions.expiresAt} <= now()`,
      ),
    )
    .limit(1000);
  if (opts.dryRun || due.length === 0) return { due: due.length, expired: 0 };

  const res = await database
    .update(subscriptions)
    .set({ status: "expired" })
    .where(
      and(
        eq(subscriptions.status, "active"),
        raw`${subscriptions.expiresAt} is not null and ${subscriptions.expiresAt} <= now()`,
      ),
    )
    .returning({ id: subscriptions.id });
  return { due: due.length, expired: res.length };
}

/* THE /explore ORDERING WEIGHT, projected from the shared catalogue into SQL.

   Built from PLANS rather than written out, so adding a boosted plan cannot
   leave the ranking behind. A tutor with no live grant sorts at 0 — during the
   pilot that is EVERY tutor, so the ordering is unchanged until somebody is
   deliberately granted Pro or Prestige. */
export function exploreBoostSql() {
  const boosted = PLANS.filter((p) => p.exploreBoost !== 0);
  if (boosted.length === 0) return raw<number>`0`;
  const cases = boosted
    .map((p) => raw`when ${subscriptions.planCode} = ${p.code} then ${p.exploreBoost}`)
    .reduce((acc, frag) => raw`${acc} ${frag}`);
  return raw<number>`case ${cases} else 0 end`;
}
