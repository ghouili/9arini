import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, asc, eq, sql as raw, plans, subscriptions, tutors } from "@tnajem/db";
import {
  isUuid,
  vOptionalText,
  isPlanCode,
  effectivePlan,
  type PlanCode,
} from "@tnajem/shared";
import { paymentsEnabled } from "@tnajem/shared/payments";
import { db } from "../db";
import { requireAdmin } from "../lib/admin";
import { auditAdmin } from "../lib/audit";
import { subscriptionIsLiveSql } from "../lib/entitlements";

/* PLANS AND GRANTS (Step 16) — the admin surface.

   EVERY GRANT IS MANUAL, because there is no checkout: payments are off, so
   nothing here charges anybody and no row implies a debt. That is not a
   shortcut waiting to be replaced by a "real" flow — it is what "entitlements
   enforced server-side" means while billing does not exist. The entitlement
   machinery is real and testable now; the money is a later, separate decision
   with its own sign-off (see packages/shared/src/payments.ts).

   The grant is audit-logged like every other privileged action (Step 15): moving
   a tutor onto Prestige changes where they rank on /explore, and "who did that?"
   needs an answer. */

/* A grant with no end date is the honest default while there is no billing cycle
   to renew it. Bounded so a typo cannot hand out a century. */
const MAX_GRANT_MONTHS = 60;

const grantBody = z.object({
  tutorId: z.string(),
  planCode: z.string(),
  months: z.number().optional(),
  note: z.string().optional(),
});

const revokeBody = z.object({ tutorId: z.string(), note: z.string().optional() });

function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

export async function subscriptionRoutes(app: FastifyInstance): Promise<void> {
  /* ── GET /plans — the catalogue, read from the TABLE ──────────────────────

     Deliberately the table and not the shared constant: this is the endpoint a
     test uses to prove the two agree. See the header of
     packages/shared/src/plans.ts for why the enforcement reads the constant. */
  app.get("/plans", async () => {
    const rows = await db.select().from(plans).orderBy(asc(plans.monthlyMillimes), asc(plans.code));
    return rows.map((p) => ({
      code: p.code,
      monthlyMillimes: p.monthlyMillimes,
      yearlyMillimes: p.yearlyMillimes,
      maxClasses: p.maxClasses,
      exploreBoost: p.exploreBoost,
      listed: p.listed,
    }));
  });

  /* ── GET /admin/plans — every tutor and the plan they are actually on ───── */
  app.get("/admin/plans", async (req) => {
    const session = await requireAdmin(req);
    if (!session) return { ok: false, admin: false, items: [] };

    const rows = await db
      .select({
        tutorId: tutors.id,
        slug: tutors.slug,
        fullName: tutors.fullName,
        status: tutors.status,
        planCode: subscriptions.planCode,
        expiresAt: subscriptions.expiresAt,
        note: subscriptions.note,
        openClasses: raw<number>`(
          select count(*)::int from classes c
          where c.tutor_id = ${tutors.id}
            and coalesce(c.status, 'scheduled') <> 'cancelled'
            and c.scheduled_at > now()
        )`,
      })
      .from(tutors)
      .leftJoin(subscriptions, and(eq(subscriptions.tutorId, tutors.id), subscriptionIsLiveSql))
      .orderBy(asc(tutors.fullName))
      .limit(200);

    return {
      ok: true,
      admin: true,
      paymentsEnabled: paymentsEnabled(),
      items: rows.map((r) => {
        const plan = effectivePlan(r.planCode, paymentsEnabled());
        return {
          tutorId: r.tutorId,
          slug: r.slug,
          fullName: r.fullName,
          status: r.status,
          planCode: plan.code,
          maxClasses: plan.maxClasses,
          exploreBoost: plan.exploreBoost,
          granted: r.planCode !== null,
          expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
          note: r.note,
          openClasses: r.openClasses,
        };
      }),
    };
  });

  /* ── POST /admin/subscriptions — grant a plan ────────────────────────────── */
  app.post("/admin/subscriptions", async (req, reply) => {
    const parsed = grantBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad-request" });

    const session = await requireAdmin(req);
    if (!session) return { ok: false, error: "forbidden" };
    if (!isUuid(parsed.data.tutorId)) return { ok: false, error: "not-found" };

    /* isPlanCode BEFORE the insert, even though the foreign key would also refuse
       an unknown code. The FK raises a 23503 the caller cannot read; this gives
       the admin a named error. Both stay — the constraint is what protects the
       table from any writer, including a future one that forgets this check. */
    if (!isPlanCode(parsed.data.planCode)) return { ok: false, error: "unknown-plan" };
    const code: PlanCode = parsed.data.planCode;
    /* pilot is the DEFAULT, not a grant. Granting it explicitly would write a row
       saying "this tutor was deliberately placed on the pilot plan", which is
       indistinguishable from every tutor who is on it simply because billing has
       not started — and it would then SURVIVE the day payments go live, quietly
       keeping one tutor unlimited for a reason nobody recorded. */
    if (code === "pilot") return { ok: false, error: "not-grantable" };

    const months = parsed.data.months;
    if (months !== undefined) {
      if (!Number.isInteger(months) || months < 1 || months > MAX_GRANT_MONTHS) {
        return { ok: false, error: "invalid-months" };
      }
    }
    const note = vOptionalText(parsed.data.note, { field: "note", max: 500 });
    if (!note.ok) return { ok: false, error: note.error };

    const [tutor] = await db
      .select({ id: tutors.id, slug: tutors.slug })
      .from(tutors)
      .where(eq(tutors.id, parsed.data.tutorId))
      .limit(1);
    if (!tutor) return { ok: false, error: "not-found" };

    const expiresAt = months === undefined ? null : addMonths(new Date(), months);

    /* ONE TRANSACTION. The partial unique index allows a single active row per
       tutor, so the old grant must close before the new one lands — and if the
       insert then failed on its own, the tutor would be left with NO grant and
       silently dropped to the default plan. Superseding a grant must not be able
       to leave someone worse off than either plan. */
    await db.transaction(async (tx) => {
      await tx
        .update(subscriptions)
        .set({ status: "cancelled" })
        .where(and(eq(subscriptions.tutorId, tutor.id), eq(subscriptions.status, "active")));
      await tx.insert(subscriptions).values({
        tutorId: tutor.id,
        planCode: code,
        status: "active",
        grantedBy: session.profile.id,
        note: note.value,
        expiresAt,
      });
    });

    await auditAdmin(
      session.profile.id,
      "subscription.grant",
      { kind: "tutor", id: tutor.id },
      [code, months ? `${months}m` : "open-ended", note.value ?? ""].filter(Boolean).join(" · "),
    );

    /* The plan changes /explore ordering and the tutor's own cached storefront,
       so both drop. A tutor granted Pro who does not move for an hour reads as
       the grant not having worked. */
    return {
      ok: true,
      planCode: code,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      revalidate: { tutors: [tutor.slug], publicTutors: true },
    };
  });

  /* ── POST /admin/subscriptions/revoke ────────────────────────────────────── */
  app.post("/admin/subscriptions/revoke", async (req, reply) => {
    const parsed = revokeBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad-request" });

    const session = await requireAdmin(req);
    if (!session) return { ok: false, error: "forbidden" };
    if (!isUuid(parsed.data.tutorId)) return { ok: false, error: "not-found" };
    const note = vOptionalText(parsed.data.note, { field: "note", max: 500 });
    if (!note.ok) return { ok: false, error: note.error };

    const [tutor] = await db
      .select({ id: tutors.id, slug: tutors.slug })
      .from(tutors)
      .where(eq(tutors.id, parsed.data.tutorId))
      .limit(1);
    if (!tutor) return { ok: false, error: "not-found" };

    const closed = await db
      .update(subscriptions)
      .set({ status: "cancelled", note: note.value })
      .where(and(eq(subscriptions.tutorId, tutor.id), eq(subscriptions.status, "active")))
      .returning({ id: subscriptions.id });

    // Idempotent: revoking nothing is not an error, it is the state being asked for.
    if (closed.length === 0) return { ok: true, already: true };

    await auditAdmin(
      session.profile.id,
      "subscription.revoke",
      { kind: "tutor", id: tutor.id },
      note.value,
    );
    return { ok: true, revalidate: { tutors: [tutor.slug], publicTutors: true } };
  });
}
