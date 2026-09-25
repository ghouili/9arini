import { adminActions } from "@tnajem/db";
import { logEvent } from "@tnajem/shared/observability";
import { db } from "../db";

/* THE ADMIN AUDIT LOG (Step 15).

   Every privileged action gets a row. The admin surface can approve a tutor,
   remove someone's teaching material, reject a photograph and purge an account —
   powers that need a record for the ordinary reason: so "who un-verified this
   tutor?" has an answer, and so an admin knows their actions are attributable
   before they take one.

   ── NO AUDIT ROW, NO ACTION (Phase A+ · P3, D13) ────────────────────────────
   This used to swallow a failed write ("a moderation action must not depend on
   its log line"). The cost of that trade was an action with no record — and the
   table was not even tamper-proof. Both are closed now:
     • admin_actions is APPEND-ONLY in the database (0031: a trigger refuses any
       UPDATE or DELETE, save the FK's own set-null when a profile is deleted);
     • the write THROWS. Callers pass their transaction (`q`), so the action and
       its row commit together or not at all — approve, reject, block, unblock,
       hide, report resolution, plan grant/revoke, avatar and takedown decisions.
       A failed audit write fails the request and changes nothing.
   The failure is still logged as an `audit_write_failed` event first, so an alert
   sees it even when the caller's own error handling is terse.

   ── WHAT MUST NOT GO IN `note` ───────────────────────────────────────────────
   Third-party personal data. A note reading "removed — contained the student's
   number 98123456" has copied that number into a new table, which is precisely
   what contact_leak_flags is careful not to do. Say what was done, not what it
   contained. */
/** The variant that THROWS. For disclosures (reading an identity document), where
    "no record" must mean "no disclosure" — the opposite trade from auditAdmin. */
export async function auditAdminStrict(
  adminProfileId: string,
  action: string,
  subject: { kind: string; id: string },
  note?: string | null,
): Promise<void> {
  await db.insert(adminActions).values({
    adminProfileId,
    action,
    subjectKind: subject.kind,
    subjectId: subject.id,
    note: note ?? null,
  });
}

/** Anything that can run an insert: `db`, or the caller's transaction. */
type Writer = Pick<typeof db, "insert">;

export async function auditAdmin(
  adminProfileId: string | null,
  action: string,
  subject: { kind: string; id: string } | null,
  note?: string | null,
  q: Writer = db,
): Promise<void> {
  try {
    await q.insert(adminActions).values({
      adminProfileId,
      action,
      subjectKind: subject?.kind ?? null,
      subjectId: subject?.id ?? null,
      note: note ?? null,
    });
  } catch (err) {
    /* There is no request logger here, and a silent audit failure is the one thing
       this module must not do. A JSON `event` line since Stage 7, so "the audit
       trail stopped being written" is something an alert can see rather than
       something someone notices in a pm2 log months later. */
    logEvent("error", "audit_write_failed", {
      action,
      subjectKind: subject?.kind,
      subjectId: subject?.id,
      detail: (err as { code?: string }).code ?? (err as Error).name,
    });
    throw err; // Phase A+ (P3): no audit row, no action — the caller's transaction rolls back.
  }
}
