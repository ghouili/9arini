import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  and, desc, eq, gt, inArray, isNull, sql as raw, bookings, classes, materials, messages, messageThreads, profiles, reports, reviews, tutors,
  DELETION_GRACE_DAYS,
} from "@tnajem/db";
import {
  isUuid,
  vText,
  vOptionalText,
  normalizeEmail,
  isValidEmail,
  detectContactInfo,
} from "@tnajem/shared";
import { db } from "../db";
import { destroyProfileSessions, getSession } from "../lib/session";
import { requireAdmin } from "../lib/admin";
import { checkRateLimit, ipBucket } from "../lib/rate-limit";
import { auditAdmin } from "../lib/audit";

/* REPORTING, MODERATION AND ACCOUNT DELETION (Step 15). */

/* THE GRACE PERIOD. Thirty days in which the person can change their mind.

   The commonest reason to close an account is a bad day, and the commonest
   regret is having done it irreversibly. A grace period costs us a nullable
   column and costs them nothing; skipping it costs somebody their booking
   history because of an argument with a tutor on a Tuesday. */
/* ONE value, shared with the purge job: packages/db/src/retention.ts. */
export { DELETION_GRACE_DAYS };

const reportBody = z.object({
  subjectKind: z.enum(["tutor", "class", "review", "message", "material", "other"]),
  subjectId: z.string().optional(),
  reason: z.string(),
  reporterEmail: z.string().optional(),
});

type SubjectKind = "tutor" | "class" | "review" | "message" | "material";

async function subjectExists(kind: string, id: string): Promise<boolean> {
  const table = { tutor: tutors, class: classes, review: reviews, message: messages, material: materials }[kind as SubjectKind];
  if (!table) return false;
  const [row] = await db.select({ id: table.id }).from(table).where(eq(table.id, id)).limit(1);
  return Boolean(row);
}

/** A label and a web path for each reported subject. Erased or hidden tutors still
    resolve (an admin needs to see what was reported), but never to a public link. */
async function subjectContext(items: { kind: string; id: string | null }[]): Promise<Map<string, { label: string; href: string | null }>> {
  const out = new Map<string, { label: string; href: string | null }>();
  const ids = (k: string) => items.filter((i) => i.kind === k && i.id && isUuid(i.id)).map((i) => i.id as string);
  const link = (slug: string | null, live: boolean) => (slug && live ? `/${slug}` : null);

  const tutorIds = ids("tutor");
  if (tutorIds.length) {
    for (const t of await db.select({ id: tutors.id, slug: tutors.slug, name: tutors.fullName, status: tutors.status, suspendedAt: tutors.suspendedAt }).from(tutors).where(inArray(tutors.id, tutorIds))) {
      out.set(`tutor:${t.id}`, { label: t.name || "—", href: link(t.slug, t.status === "verified" && !t.suspendedAt) });
    }
  }
  const classIds = ids("class");
  if (classIds.length) {
    for (const c of await db.select({ id: classes.id, title: classes.title }).from(classes).where(inArray(classes.id, classIds))) {
      out.set(`class:${c.id}`, { label: c.title, href: `/class/${c.id}` });
    }
  }
  const materialIds = ids("material");
  if (materialIds.length) {
    for (const m of await db
      .select({ id: materials.id, title: materials.title, slug: tutors.slug, status: tutors.status, suspendedAt: tutors.suspendedAt })
      .from(materials)
      .innerJoin(tutors, eq(materials.tutorId, tutors.id))
      .where(inArray(materials.id, materialIds))) {
      out.set(`material:${m.id}`, { label: m.title, href: link(m.slug, m.status === "verified" && !m.suspendedAt) });
    }
  }
  const messageIds = ids("message");
  if (messageIds.length) {
    for (const m of await db
      .select({ id: messages.id, body: messages.body, minor: messageThreads.studentIsMinor })
      .from(messages)
      .innerJoin(messageThreads, eq(messages.threadId, messageThreads.id))
      .where(inArray(messages.id, messageIds))) {
      /* The evidence itself, and whether a minor is in the conversation: an admin must
         see both to judge it. Conversations have no admin page, so no link. */
      out.set(`message:${m.id}`, { label: `${m.minor ? "[−18] " : ""}${m.body.slice(0, 300)}`, href: null });
    }
  }
  const reviewIds = ids("review");
  if (reviewIds.length) {
    for (const r of await db
      .select({ id: reviews.id, text: reviews.text, slug: tutors.slug, status: tutors.status, suspendedAt: tutors.suspendedAt })
      .from(reviews)
      .innerJoin(tutors, eq(reviews.tutorId, tutors.id))
      .where(inArray(reviews.id, reviewIds))) {
      out.set(`review:${r.id}`, { label: (r.text ?? "").slice(0, 120), href: link(r.slug, r.status === "verified" && !r.suspendedAt) });
    }
  }
  return out;
}

export async function moderationRoutes(app: FastifyInstance): Promise<void> {
  /* ── POST /reports — NO ACCOUNT REQUIRED ─────────────────────────────────────

     Reachable logged out, deliberately. The person most likely to need this
     button is a parent who found something on a public storefront and has no
     login, or a student who has already been driven off the platform by whatever
     they are reporting. Requiring an account to report abuse means the reports we
     most need never arrive.

     That makes it an unauthenticated write, so it is rate-limited per IP. It is
     also why the reporter's e-mail is OPTIONAL: a report nobody can follow up is
     still a signal, and demanding contact details is one more reason not to file. */
  app.post("/reports", async (req, reply) => {
    const parsed = reportBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad-request" });

    const rl = await checkRateLimit(`report:${ipBucket(req.ip)}`, 10, 60 * 60_000);
    if (!rl.ok) return { ok: false, error: "too-many-requests" };

    const reason = vText(parsed.data.reason, { field: "reason", max: 2000, min: 10 });
    if (!reason.ok) return { ok: false, error: reason.error };

    let reporterEmail: string | null = null;
    if (parsed.data.reporterEmail?.trim()) {
      const e = normalizeEmail(parsed.data.reporterEmail);
      if (!isValidEmail(e)) return { ok: false, error: "invalid-email" };
      reporterEmail = e;
    }

    const subjectId = parsed.data.subjectId?.trim() || null;
    if (subjectId && subjectId.length > 200) return { ok: false, error: "not-found" };
    /* The thing reported must exist. A report about an id that points at nothing is
       a report nobody can act on — and an open write endpoint that accepts any id is
       an easy way to flood the queue with noise. "other" names no subject. */
    if (parsed.data.subjectKind !== "other" && subjectId) {
      if (!isUuid(subjectId) || !(await subjectExists(parsed.data.subjectKind, subjectId))) {
        return { ok: false, error: "not-found" };
      }
    }

    /* The reporter may be signed in, and attributing the report is useful — but
       it is never required, and an anonymous one is not second class. */
    const session = await getSession(req);

    /* NOTE: detectContactInfo is NOT applied to `reason`. A report is the one
       place where a phone number is legitimate evidence — "he asked me to text
       him on 98123456" is the entire substance of the complaint. Masking it here
       would destroy the report to enforce a rule that exists to protect the
       person filing it. This is the deliberate exception to Step 8, and it is
       narrow: reports are read only by admins, never rendered publicly. */
    const scan = detectContactInfo(reason.value);

    const [row] = await db
      .insert(reports)
      .values({
        subjectKind: parsed.data.subjectKind,
        subjectId,
        reporterProfileId: session?.profile.id ?? null,
        reporterEmail,
        reason: reason.value,
      })
      .returning({ id: reports.id });

    /* Nothing is hidden, removed or suspended by filing a report, and the
       response says "received" rather than implying an outcome. An
       unauthenticated endpoint that took content down on request would be a
       censorship button for anyone who found the URL. */
    return { ok: true, id: row.id, status: "received", containsContactInfo: scan.found };
  });

  /* ── GET /admin/reports ──────────────────────────────────────────────────── */
  app.get("/admin/reports", async (req) => {
    const session = await requireAdmin(req);
    if (!session) return [];
    const rows = await db
      .select()
      .from(reports)
      .where(eq(reports.status, "open"))
      .orderBy(desc(reports.createdAt))
      .limit(200);
    const context = await subjectContext(rows.map((r) => ({ kind: r.subjectKind, id: r.subjectId })));
    return rows.map((r) => ({
      id: r.id,
      subjectKind: r.subjectKind,
      subjectId: r.subjectId,
      /* What the report is ABOUT, for an admin: a title and a page they can open.
         Resolved here so the queue never shows a bare uuid. */
      subject: (r.subjectId && context.get(`${r.subjectKind}:${r.subjectId}`)) || null,
      reason: r.reason,
      reporterEmail: r.reporterEmail,
      createdAt: new Date(r.createdAt).toISOString(),
    }));
  });

  /* ── POST /admin/reports/:id ─────────────────────────────────────────────── */
  app.post<{ Params: { id: string } }>("/admin/reports/:id", async (req, reply) => {
    const parsed = z
      .object({ action: z.enum(["actioned", "dismissed"]), note: z.string().optional() })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad-request" });

    const session = await requireAdmin(req);
    if (!session) return { ok: false, error: "forbidden" };
    if (!isUuid(req.params.id)) return { ok: false, error: "not-found" };

    const note = vOptionalText(parsed.data.note, { field: "note", max: 1000 });
    if (!note.ok) return { ok: false, error: note.error };

    const [r] = await db.select().from(reports).where(eq(reports.id, req.params.id)).limit(1);
    if (!r) return { ok: false, error: "not-found" };
    if (r.status !== "open") return { ok: true, already: true }; // idempotent

    await db
      .update(reports)
      .set({
        status: parsed.data.action,
        resolvedAt: raw`now()`,
        resolvedBy: session.profile.id,
        resolutionNote: note.value,
      })
      .where(eq(reports.id, r.id));

    await auditAdmin(
      session.profile.id,
      `report.${parsed.data.action}`,
      { kind: "report", id: r.id },
      note.value,
    );
    return { ok: true };
  });

  /* ══════════════════════════════════════════════════════════════════════════
     SELF-SERVICE ACCOUNT DELETION
     ══════════════════════════════════════════════════════════════════════════ */

  /* ── POST /account/delete — request it ───────────────────────────────────── */
  app.post("/account/delete", async (req) => {
    const session = await getSession(req);
    if (!session) return { ok: false, error: "not-authenticated" };
    const uid = session.profile.id;

    /* BLOCKED WHILE BOOKED, and this is a courtesy to the OTHER side. A student
       vanishing from a class the tutor has prepared for, or a tutor vanishing
       from one students have booked, is a no-show dressed up as a privacy
       action. Cancel first — that path exists, it tells the counterparty, and it
       settles the ledger honestly. */
    const [asStudent] = await db
      .select({ n: raw<number>`count(*)::int` })
      .from(bookings)
      .innerJoin(classes, eq(bookings.classId, classes.id))
      .where(
        and(
          eq(bookings.studentId, uid),
          raw`coalesce(${bookings.status}, 'reserved') <> 'cancelled'`,
          gt(classes.scheduledAt, raw`now()`),
        ),
      );
    if ((asStudent?.n ?? 0) > 0) return { ok: false, error: "has-upcoming-bookings" };

    const [asTutor] = await db
      .select({ n: raw<number>`count(*)::int` })
      .from(classes)
      .innerJoin(tutors, eq(classes.tutorId, tutors.id))
      .where(
        and(
          eq(tutors.profileId, uid),
          raw`coalesce(${classes.status}, 'scheduled') <> 'cancelled'`,
          gt(classes.scheduledAt, raw`now()`),
        ),
      );
    if ((asTutor?.n ?? 0) > 0) return { ok: false, error: "has-upcoming-classes" };

    await db
      .update(profiles)
      .set({ deletionRequestedAt: raw`now()`, deletionStatus: "requested" })
      .where(eq(profiles.id, uid));

    /* Every OTHER device is signed out now. Someone asking for their account to be
       deleted — perhaps because a phone was lost or shared — must not stay signed
       in elsewhere for the 30-day grace. This browser keeps its session, so the
       page can show the request and the way to cancel it. */
    await destroyProfileSessions(uid, { keepToken: session.token });

    return { ok: true, graceDays: DELETION_GRACE_DAYS };
  });

  /* ── POST /account/delete/cancel — change of mind ────────────────────────── */
  app.post("/account/delete/cancel", async (req) => {
    const session = await getSession(req);
    if (!session) return { ok: false, error: "not-authenticated" };
    await db
      .update(profiles)
      .set({ deletionRequestedAt: null, deletionStatus: "cancelled" })
      .where(eq(profiles.id, session.profile.id));
    return { ok: true };
  });

  /* ── GET /account/deletion — what state am I in? ─────────────────────────── */
  app.get("/account/deletion", async (req) => {
    const session = await getSession(req);
    if (!session) return null;
    const [p] = await db
      .select({ at: profiles.deletionRequestedAt, status: profiles.deletionStatus })
      .from(profiles)
      .where(eq(profiles.id, session.profile.id))
      .limit(1);
    if (!p?.at || p.status !== "requested") return { requested: false, graceDays: DELETION_GRACE_DAYS };
    const purgeAt = new Date(new Date(p.at).getTime() + DELETION_GRACE_DAYS * 86_400_000);
    return {
      requested: true,
      requestedAt: new Date(p.at).toISOString(),
      purgeAt: purgeAt.toISOString(),
      graceDays: DELETION_GRACE_DAYS,
    };
  });
}

/* The account purge job moved to @tnajem/db (retention.ts) so `npm run db:purge` runs
   it too; POST /cron/purge calls it through runRetention(). */
export { purgeDeletedAccounts } from "@tnajem/db";
