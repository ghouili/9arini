import { config } from "dotenv";
config({ path: ".env.local", override: true }); // .env.local wins over any stray shell DATABASE_URL

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { otpCodes, rateLimits, sessions, tutors, verificationDocs } from "../lib/db/schema";
import {
  purgeExpiredAuthRows, purgeExpiredVerificationDocs, RETENTION_DAYS, storageBase,
} from "../lib/retention";

/* Retention purge — CLI entry point. Runs TWO jobs:
 *
 *   1. ID documents past the 90-day window (files + verification_docs rows) — the
 *      /privacy promise.
 *   2. Expired auth rows (sessions + otp_codes) — pure housekeeping on two tables
 *      that otherwise grow by one row per login / per OTP, forever.
 *
 *   npm run db:purge               # run both
 *   npm run db:purge -- --dry-run  # show what would go, change nothing
 *   npm run db:purge -- --days=30  # override the ID-document window (default 90)
 *
 * --days applies to the ID-document window only: an auth row's own expires_at IS
 * its retention policy, so there is no window to tune.
 *
 * Standalone script, same pattern as lib/db/seed.ts: connects to Postgres
 * directly instead of importing lib/db/index.ts, which is guarded by
 * `server-only` and throws when run via tsx outside the Next runtime.
 *
 * Idempotent — safe to run on a cron (daily is plenty). The equivalent HTTP
 * entry point for platform schedulers is app/api/cron/purge/route.ts.
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
    console.error("✗ DATABASE_URL not set. Start your local Postgres and set it in .env.local.");
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql, { schema: { tutors, verificationDocs, sessions, otpCodes, rateLimits } });

  console.log(
    `Retention purge — storage=${storageBase()}${dryRun ? " · DRY RUN (nothing will be deleted)" : ""}`,
  );

  const res = await purgeExpiredVerificationDocs(db, {
    dryRun,
    retentionDays,
    log: (line) => console.log(line),
  });

  for (const err of res.errors) console.error(`✗ ${err}`);

  console.log(
    dryRun
      ? `✓ Dry run: ${res.docsDeleted} document(s) from ${res.tutorsAffected} tutor(s) are past the ${res.retentionDays}-day window.`
      : `✓ Purged ${res.docsDeleted} document row(s) / ${res.filesDeleted} file(s) from ${res.tutorsAffected} tutor(s).`,
  );

  /* Second job: expired sessions + OTP codes. Runs even if the document purge
     reported errors — the two are independent, and a disk problem on one tutor's
     scan is no reason to let two forever-growing tables keep growing. */
  const auth = await purgeExpiredAuthRows(db, { dryRun, log: (line) => console.log(line) });

  console.log(
    dryRun
      ? `✓ Dry run: ${auth.sessionsDeleted} expired session(s), ${auth.otpCodesDeleted} expired OTP code(s) and ${auth.rateLimitsDeleted} stale rate-limit row(s) would be deleted.`
      : `✓ Purged ${auth.sessionsDeleted} expired session(s), ${auth.otpCodesDeleted} expired OTP code(s) and ${auth.rateLimitsDeleted} stale rate-limit row(s).`,
  );

  await sql.end();
  process.exit(res.errors.length > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
