/* Env from the REPO ROOT, resolved from this module rather than cwd. See
   _paths.ts -- a purge with the wrong cwd finds no files, treats every document
   as already-gone, and deletes the rows anyway. */
import { loadEnv } from "./_paths";
loadEnv();

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/schema";
import { runRetention, RETENTION_DAYS, DELETION_GRACE_DAYS } from "../src/retention";

/* Retention purge — CLI entry point. THE SAME RUN AS POST /cron/purge.
 *
 *   1. ID documents past the 90-day window (files + verification_docs rows) — the
 *      /privacy promise.
 *   2. Expired auth rows (sessions, otp_codes, stale rate_limits).
 *   3. Accounts whose 30-day deletion grace has expired (Step 15).
 *   4. Subscriptions past their expiry (Step 16) — bookkeeping only.
 *
 * It used to run jobs 1 and 2 ONLY, while the docs said the CLI and the HTTP cron
 * were interchangeable: a host scheduling the CLI never erased a deleted account.
 * Both now call runRetention() in packages/db/src/retention.ts.
 *
 *   npm run db:purge               # run all four
 *   npm run db:purge -- --dry-run  # show what would go, change nothing
 *   npm run db:purge -- --days=30  # override the ID-document window (default 90)
 *
 * --days applies to the ID-document window only. Exit code 1 if any job failed or
 * any document could not be removed — a scheduler should alert on it.
 *
 * Never prints STORAGE_DIR, DATABASE_URL or a file name. Idempotent — daily is plenty.
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const daysArg = args.find((a) => a.startsWith("--days="));
  const retentionDays = daysArg ? Number(daysArg.split("=")[1]) : RETENTION_DAYS;

  if (!Number.isFinite(retentionDays) || retentionDays < 0) {
    console.error(`✗ --days must be a non-negative number (got "${daysArg}").`);
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("✗ DATABASE_URL is not set (repo-root .env).");
    process.exit(1);
  }

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(sql, { schema });

  console.log(
    `Retention purge — STORAGE_DIR ${process.env.STORAGE_DIR?.trim() ? "set" : "NOT SET"}` +
      `${dryRun ? " · DRY RUN (nothing will be deleted)" : ""}`,
  );

  const run = await runRetention(db, { dryRun, retentionDays, log: (line) => console.log(`  ${line}`) });
  const d = run.documents;
  const a = run.auth;

  console.log("");
  console.log(
    d
      ? dryRun
        ? `✓ 1 documents     ${d.docsDeleted} document(s) from ${d.tutorsAffected} tutor(s) are past the ${d.retentionDays}-day window`
        : `✓ 1 documents     purged ${d.docsDeleted} row(s) / ${d.filesDeleted} file(s) from ${d.tutorsAffected} tutor(s)${d.filesMissing ? ` (${d.filesMissing} file(s) already gone)` : ""}`
      : "✗ 1 documents     job failed",
  );
  for (const err of d?.errors ?? []) console.error(`    ✗ ${err}`);
  console.log(
    a
      ? `✓ 2 auth rows     ${dryRun ? "would delete" : "deleted"} ${a.sessionsDeleted} session(s), ${a.otpCodesDeleted} OTP code(s), ${a.rateLimitsDeleted} rate-limit row(s)`
      : "✗ 2 auth rows     job failed",
  );
  console.log(
    run.accounts
      ? `✓ 3 accounts      ${run.accounts.due} past the ${DELETION_GRACE_DAYS}-day deletion grace${dryRun ? "" : `, ${run.accounts.purged} erased`}`
      : "✗ 3 accounts      job failed",
  );
  console.log(
    run.subscriptions
      ? `✓ 4 subscriptions ${run.subscriptions.due} past expiry${dryRun ? "" : `, ${run.subscriptions.expired} marked expired`}`
      : "✗ 4 subscriptions job failed",
  );
  for (const f of run.failedJobs) console.error(`✗ ${f.job}: ${f.error}`);

  await sql.end();
  const failed = run.failedJobs.length > 0 || (d?.errors.length ?? 0) > 0;
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(`✗ purge crashed: ${(e as Error).name}`);
  process.exit(1);
});
