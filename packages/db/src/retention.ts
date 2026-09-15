/* ID-document retention purge (INPDP / Loi 2004-63 · Tunisia).
 *
 * /privacy publicly promises: identity documents are deleted AT MOST 90 days
 * after the verification decision. This module is what makes that true.
 *
 * What it does, for every tutor whose verification was DECIDED (status
 * "verified" or "rejected") more than RETENTION_DAYS ago:
 *   1. removes the file from disk (STORAGE_DIR, default ./.storage), then
 *   2. removes the matching `verification_docs` row.
 * File first, row second — if the unlink fails we keep the row so the next run
 * retries it (a row without a file is a lie; a file without a row is a leak).
 *
 * Tutors in "draft" or "pending" are NEVER touched: the admin queue still needs
 * their documents. Tutors with a NULL reviewed_at are skipped too (no decision
 * date = no retention clock).
 *
 * Idempotent: re-running finds nothing left to do; a missing file is not an
 * error (counted as `filesMissing`) and its row is still purged.
 *
 * NOTE: this module deliberately does NOT import "@/lib/db" — that module is
 * guarded by `server-only` and throws under `tsx`. Callers pass their own
 * drizzle handle, so the same code runs from the CLI script and from the
 * cron route. Same reason lib/db/seed.ts connects directly.
 */
import { and, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { readdir, rm, rmdir, stat } from "node:fs/promises";
import { join } from "node:path";
/* ONE storageBase()/resolveDocPath(), in ./storage. There used to be three
   copies of each across the uploader, the admin doc route and this file; they
   agreed only because all three happened to run with the same cwd. */
import { storageBase, resolveDocPath } from "./storage";
export { storageBase };
import { otpCodes, profiles, rateLimits, sessions, subscriptions, tutors, verificationDocs } from "./schema";

export const RETENTION_DAYS = 90;

/** Decided states — the retention clock only starts once a human has ruled. */
const DECIDED = ["verified", "rejected"] as const;

/* Any drizzle/postgres-js handle. The schema generic differs between the
   `server-only` client (typed with the full schema) and the standalone one the
   script builds, so we stay generic on purpose. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PurgeDb = PostgresJsDatabase<any>;

export type PurgedDoc = {
  docId: string;
  tutorId: string;
  kind: string;
  storagePath: string;
  fileExisted: boolean;
};

export type PurgeResult = {
  cutoff: string;          // ISO date: anything decided before this is expired
  retentionDays: number;
  dryRun: boolean;
  tutorsAffected: number;
  docsDeleted: number;     // verification_docs rows removed
  filesDeleted: number;    // files actually unlinked from disk
  filesMissing: number;    // rows whose file was already gone (still purged)
  errors: string[];
  removed: PurgedDoc[];
};

export type PurgeOptions = {
  /** Report what would go, change nothing. */
  dryRun?: boolean;
  /** Override the window (tests / legal changes). Defaults to RETENTION_DAYS. */
  retentionDays?: number;
  /** Where the files live. Defaults to storageBase(). */
  baseDir?: string;
  /** Line logger. Never receives file names or any other document content. */
  log?: (line: string) => void;
};

export async function purgeExpiredVerificationDocs(
  db: PurgeDb,
  opts: PurgeOptions = {},
): Promise<PurgeResult> {
  const retentionDays = opts.retentionDays ?? RETENTION_DAYS;
  const dryRun = opts.dryRun ?? false;
  const baseDir = opts.baseDir ?? storageBase();
  const log = opts.log ?? (() => {});

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const result: PurgeResult = {
    cutoff: cutoff.toISOString(),
    retentionDays,
    dryRun,
    tutorsAffected: 0,
    docsDeleted: 0,
    filesDeleted: 0,
    filesMissing: 0,
    errors: [],
    removed: [],
  };

  // Expired = doc belongs to a tutor whose decision is older than the cutoff.
  // The status filter is what keeps pending/draft tutors safe.
  const expired = await db
    .select({
      docId: verificationDocs.id,
      tutorId: verificationDocs.tutorId,
      kind: verificationDocs.kind,
      storagePath: verificationDocs.storagePath,
      status: tutors.status,
      reviewedAt: tutors.reviewedAt,
    })
    .from(verificationDocs)
    .innerJoin(tutors, eq(verificationDocs.tutorId, tutors.id))
    .where(
      and(
        inArray(tutors.status, [...DECIDED]),
        isNotNull(tutors.reviewedAt),
        lt(tutors.reviewedAt, cutoff),
      ),
    );

  const tutorIds = new Set(expired.map((r) => r.tutorId));
  result.tutorsAffected = tutorIds.size;

  log(
    `retention: window=${retentionDays}d cutoff=${cutoff.toISOString()} ` +
      `expired_docs=${expired.length} tutors=${tutorIds.size}${dryRun ? " (dry-run)" : ""}`,
  );

  for (const row of expired) {
    const abs = resolveDocPath(baseDir, row.storagePath);
    if (!abs) {
      // Unsafe/garbage path — never unlink it, never silently drop the row.
      result.errors.push(`doc ${row.docId}: refusing unsafe storage_path`);
      continue;
    }

    let fileExisted = false;
    try {
      // rm(force) is a no-op when the file is already gone, so probe first —
      // purely to keep an honest deleted/already-gone count in the audit log.
      try {
        await stat(abs);
        fileExisted = true;
      } catch {
        fileExisted = false;
      }

      if (!dryRun) await rm(abs, { force: true });
    } catch (e) {
      // Disk problem: keep the row so the next run retries. Never orphan a file.
      result.errors.push(`doc ${row.docId}: unlink failed — ${(e as Error).message}`);
      continue;
    }

    if (!dryRun) {
      try {
        await db.delete(verificationDocs).where(eq(verificationDocs.id, row.docId));
      } catch (e) {
        result.errors.push(`doc ${row.docId}: row delete failed — ${(e as Error).message}`);
        continue;
      }
    }

    if (fileExisted) result.filesDeleted++;
    else result.filesMissing++;
    result.docsDeleted++;
    result.removed.push({
      docId: row.docId,
      tutorId: row.tutorId,
      kind: row.kind,
      storagePath: row.storagePath,
      fileExisted,
    });
    // Audit line: ids + kind only — no file names, no document content.
    log(
      `  purged doc=${row.docId} tutor=${row.tutorId} kind=${row.kind} ` +
        `decided=${row.reviewedAt instanceof Date ? row.reviewedAt.toISOString() : String(row.reviewedAt)} ` +
        `file=${fileExisted ? "deleted" : "already-gone"}`,
    );
  }

  // Best-effort: drop the per-tutor folder once it is empty. Never fatal.
  if (!dryRun) {
    for (const tutorId of tutorIds) {
      const dir = resolveDocPath(baseDir, join("verification", tutorId));
      if (!dir) continue;
      try {
        const left = await readdir(dir);
        if (left.length === 0) await rmdir(dir);
      } catch {
        /* folder already gone, or not empty — fine either way */
      }
    }
  }

  log(
    `retention: done — rows=${result.docsDeleted} files=${result.filesDeleted} ` +
      `already-gone=${result.filesMissing} errors=${result.errors.length}`,
  );
  return result;
}

/* ══════════════════════════════════════════════════════════════════════════════
   Expired auth rows (SCALABILITY.md §5 / §7).

   `sessions` grows by one row per LOGIN (30-day expiry) and `otp_codes` by one row
   per OTP REQUEST (5-minute expiry). Nothing ever deleted an expired row from
   either: createOtp only clears the rows for the ONE phone it is minting a code
   for, and createSession only GCs the expired rows of the ONE profile logging in.
   So both tables grow exactly as fast as the product does, forever — and every
   login then reads through that garbage.

   Deleting an expired row can never log anyone out or invalidate a code that would
   still have worked: getSession() already treats `expires_at < now()` as no session
   (and deletes it), and verifyOtpCode() already treats it as no code. This purge is
   pure housekeeping — it removes rows the auth layer considers dead already.

   Indexed: `sessions_expires_at_idx` / `otp_codes_expires_at_idx` (schema.ts) make
   both statements index scans rather than a seq scan of a forever-growing table.

   Idempotent, overlap-safe, and unconditional on tutor status — nothing here is
   subject to the 90-day ID-document window; the expiry timestamp on the row IS the
   retention policy. Same contract as purgeExpiredVerificationDocs: the caller
   passes the db handle (so this runs under `tsx` as well as inside Next), dry-run
   only counts, and the return value is the audit record.
   ═════════════════════════════════════════════════════════════════════════════ */
export type AuthPurgeResult = {
  dryRun: boolean;
  cutoff: string;          // ISO — "expired" means expires_at < this
  sessionsDeleted: number;
  otpCodesDeleted: number;
  rateLimitsDeleted: number; // stale fixed-window rows (reset_at < now)
};

export type AuthPurgeOptions = {
  /** Count what would go, delete nothing. */
  dryRun?: boolean;
  /** Line logger. Never receives a token, a phone or a code hash. */
  log?: (line: string) => void;
};

/* postgres.js returns a RowList carrying `.count` (rows affected). The db handle is
   deliberately generic (PurgeDb = PostgresJsDatabase<any>), so read it defensively
   instead of leaning on a driver-specific type: a wrong count must never throw and
   abort a purge that already did its work. */
function affected(res: unknown): number {
  const n = (res as { count?: unknown } | null | undefined)?.count;
  return typeof n === "number" ? n : 0;
}

export async function purgeExpiredAuthRows(
  db: PurgeDb,
  opts: AuthPurgeOptions = {},
): Promise<AuthPurgeResult> {
  const dryRun = opts.dryRun ?? false;
  const log = opts.log ?? (() => {});
  const now = new Date();

  if (dryRun) {
    const [s] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(sessions)
      .where(lt(sessions.expiresAt, now));
    const [o] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(otpCodes)
      .where(lt(otpCodes.expiresAt, now));
    const [r] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(rateLimits)
      .where(lt(rateLimits.resetAt, now));

    const res: AuthPurgeResult = {
      dryRun: true,
      cutoff: now.toISOString(),
      sessionsDeleted: s?.n ?? 0,
      otpCodesDeleted: o?.n ?? 0,
      rateLimitsDeleted: r?.n ?? 0,
    };
    log(
      `auth-retention (dry-run): expired sessions=${res.sessionsDeleted} ` +
        `otp_codes=${res.otpCodesDeleted} rate_limits=${res.rateLimitsDeleted}`,
    );
    return res;
  }

  const s = await db.delete(sessions).where(lt(sessions.expiresAt, now));
  const o = await db.delete(otpCodes).where(lt(otpCodes.expiresAt, now));
  // Stale fixed-window rows: self-healing (reset on next hit) but a key never hit
  // again lingers, so sweep it here on the same daily schedule. Indexed on reset_at.
  const r = await db.delete(rateLimits).where(lt(rateLimits.resetAt, now));

  const res: AuthPurgeResult = {
    dryRun: false,
    cutoff: now.toISOString(),
    sessionsDeleted: affected(s),
    otpCodesDeleted: affected(o),
    rateLimitsDeleted: affected(r),
  };
  log(
    `auth-retention: sessions=${res.sessionsDeleted} otp_codes=${res.otpCodesDeleted} ` +
      `rate_limits=${res.rateLimitsDeleted}`,
  );
  return res;
}

/* ══════════════════════════════════════════════════════════════════════════════
   JOBS 3 AND 4 — moved here from apps/api so the CLI can run them too.

   `npm run db:purge` used to run jobs 1 and 2 only, while POST /cron/purge ran all
   four — and DEPLOY.md and .env.example said "run EITHER". A host that chose the
   CLI never erased an account whose deletion grace had expired, and /privacy
   promises that erasure. Both entry points now call runRetention() below.
   ══════════════════════════════════════════════════════════════════════════════ */

/** Days between "supprimer mon compte" and the erasure (Step 15). */
export const DELETION_GRACE_DAYS = 30;

/* THE ACCOUNT PURGE (Step 15). A hard DELETE of the profile row; everything that
   hangs off it goes by the foreign keys — which is exactly why 0016 rebuilt two:
     reviews.student_id       SET NULL, so the review survives WITHOUT its author;
     cancellations.booking_id SET NULL, so the money ledger survives.
   Sessions, notifications, consents, guardian links, bookings and the profile
   itself (e-mail, phone) go. */
export async function purgeDeletedAccounts(
  db: PurgeDb,
  opts: { dryRun?: boolean; log?: (line: string) => void } = {},
): Promise<{ due: number; purged: number }> {
  const log = opts.log ?? (() => {});
  const due: { id: string }[] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(
      and(
        eq(profiles.deletionStatus, "requested"),
        sql`${profiles.deletionRequestedAt} < now() - (${DELETION_GRACE_DAYS} * interval '1 day')`,
      ),
    )
    .limit(500);

  if (opts.dryRun || due.length === 0) {
    log(`account-retention${opts.dryRun ? " (dry-run)" : ""}: due=${due.length}`);
    return { due: due.length, purged: 0 };
  }

  let purged = 0;
  for (const p of due) {
    /* One at a time rather than a single DELETE … IN (…): a constraint failure on
       one account must not abandon the rest. A failure leaves the row `requested`,
       so it is simply due again tomorrow — and it is LOGGED (id only), because a
       silently stuck erasure is a broken promise nobody sees. */
    try {
      await db.delete(profiles).where(eq(profiles.id, p.id));
      purged += 1;
    } catch (err) {
      log(`account-retention: could not purge profile ${p.id} (${(err as { code?: string }).code ?? (err as Error).name})`);
    }
  }
  log(`account-retention: due=${due.length} purged=${purged}`);
  return { due: due.length, purged };
}

/* THE SUBSCRIPTION EXPIRY SWEEP (Step 16). Bookkeeping, not enforcement: the
   entitlement resolver already treats a past expiry as dead. This flips the status
   so the partial unique index frees up and an admin is not shown an "active" row
   that ran out in March. */
export async function expireSubscriptions(
  db: PurgeDb,
  opts: { dryRun?: boolean; log?: (line: string) => void } = {},
): Promise<{ due: number; expired: number }> {
  const log = opts.log ?? (() => {});
  const where = and(
    eq(subscriptions.status, "active"),
    sql`${subscriptions.expiresAt} is not null and ${subscriptions.expiresAt} <= now()`,
  );
  const due: { id: string }[] = await db.select({ id: subscriptions.id }).from(subscriptions).where(where).limit(1000);
  if (opts.dryRun || due.length === 0) {
    log(`subscription-expiry${opts.dryRun ? " (dry-run)" : ""}: due=${due.length}`);
    return { due: due.length, expired: 0 };
  }
  const res: { id: string }[] = await db.update(subscriptions).set({ status: "expired" }).where(where).returning({ id: subscriptions.id });
  log(`subscription-expiry: expired=${res.length}`);
  return { due: due.length, expired: res.length };
}

export type RetentionRun = {
  dryRun: boolean;
  documents: PurgeResult | null;
  auth: AuthPurgeResult | null;
  accounts: { due: number; purged: number } | null;
  subscriptions: { due: number; expired: number } | null;
  /** A job that THREW (as opposed to per-document errors inside job 1). */
  failedJobs: { job: string; error: string }[];
};

/* THE ONE RETENTION RUN, for `npm run db:purge` and POST /cron/purge alike.

   Four INDEPENDENT jobs: each is wrapped, so a failure in one (a missing
   STORAGE_DIR, a locked table) never stops the others — an expired account is
   erased even on the night the document store is unreachable. The caller decides
   what a failure means (exit code, HTTP status); `failedJobs` says which. */
export async function runRetention(
  db: PurgeDb,
  opts: { dryRun?: boolean; retentionDays?: number; log?: (line: string) => void } = {},
): Promise<RetentionRun> {
  const dryRun = opts.dryRun ?? false;
  const log = opts.log;
  const failedJobs: RetentionRun["failedJobs"] = [];
  async function job<T>(name: string, run: () => Promise<T>): Promise<T | null> {
    try {
      return await run();
    } catch (err) {
      const error = `${(err as Error).name}: ${(err as Error).message}`.slice(0, 300);
      failedJobs.push({ job: name, error });
      log?.(`${name}: FAILED — ${error}`);
      return null;
    }
  }
  const documents = await job("documents", () => purgeExpiredVerificationDocs(db, { dryRun, retentionDays: opts.retentionDays, log }));
  const auth = await job("auth", () => purgeExpiredAuthRows(db, { dryRun, log }));
  const accounts = await job("accounts", () => purgeDeletedAccounts(db, { dryRun, log }));
  const subs = await job("subscriptions", () => expireSubscriptions(db, { dryRun, log }));
  return { dryRun, documents, auth, accounts, subscriptions: subs, failedJobs };
}
