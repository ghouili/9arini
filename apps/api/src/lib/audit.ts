import { adminActions } from "@tnajem/db";
import { logEvent } from "@tnajem/shared/observability";
import { db } from "../db";

/* THE ADMIN AUDIT LOG (Step 15).

   Every privileged action gets a row. The admin surface can approve a tutor,
   remove someone's teaching material, reject a photograph and purge an account —
   powers that need a record for the ordinary reason: so "who un-verified this
   tutor?" has an answer, and so an admin knows their actions are attributable
   before they take one.

   ── WHY IT NEVER THROWS ──────────────────────────────────────────────────────
   Failing a moderation action because its log line could not be written would
   make the audit trail a liveness dependency of moderation itself: the day the
   table has a problem, nobody can remove abusive content. The action is the
   thing that protects users; the log describes it.

   That is a deliberate trade and it has a cost — a lost row is a gap nobody
   notices — so the failure is LOGGED loudly rather than swallowed, which is what
   makes the gap findable.

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

export async function auditAdmin(
  adminProfileId: string | null,
  action: string,
  subject: { kind: string; id: string } | null,
  note?: string | null,
): Promise<void> {
  try {
    await db.insert(adminActions).values({
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
  }
}
