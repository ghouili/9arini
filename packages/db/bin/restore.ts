/* npm run db:restore -- <backup.dump> — restore a db:backup into an EMPTY database,
   and prove it restored everything.

     RESTORE_DATABASE_URL=<new empty database> npm run db:restore -- backups/tnajem-….dump

   WHERE IT RESTORES. Only into the database named by RESTORE_DATABASE_URL, and only
   if that database is EMPTY (no tables in public). It refuses the database in
   DATABASE_URL outright. There is no "--force": restoring over live data destroys
   whatever was written since the backup, with no way back. The recovery path is
   restore into a fresh database, check it, then point DATABASE_URL at it — the old
   one stays untouched until you decide (DEPLOY.md, "Restore").

   WHAT "RESTORED" MEANS. Four checks, each printed:
     1. the dump's sha256 equals the manifest's (the file is the one that was written)
     2. pg_restore ran in a single transaction with --exit-on-error (all or nothing)
     3. every table in the manifest exists in the restored database, and no extra
     4. every table's row count equals the count taken inside the backup's snapshot
   Any failure exits 1.

   Prints no host, user, database name or password. */
import { loadEnv, repoRoot } from "./_paths";
loadEnv();

import postgres from "postgres";
import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import {
  findPgTool, parsePgUrl, pgEnv, runPgTool, sameDatabase, summarizePgError, toolVersion,
  TABLES_SQL, type BackupManifest,
} from "./_pg";

class Friendly extends Error {}

async function sha256(file: string): Promise<string> {
  const h = createHash("sha256");
  for await (const chunk of createReadStream(file)) h.update(chunk as Buffer);
  return h.digest("hex");
}

async function main() {
  console.log("Tnajem db:restore");
  const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!file) throw new Friendly("usage: RESTORE_DATABASE_URL=… npm run db:restore -- <backup.dump>");
  /* RESOLVE AGAINST THE REPO ROOT, not process.cwd().

     `npm run db:restore` forwards to this workspace, so cwd is packages/db — which
     meant the exact command DEPLOY.md and this file's own header document,
     `npm run db:restore -- backups/tnajem-….dump`, looked in
     packages/db/backups/ and answered "does not exist" for a file that was
     sitting in the repo's backups/ the whole time. Found at Stage 8, restoring a
     real backup. An absolute path still works, and so does a path relative to
     wherever you actually are, because cwd is tried too — but the documented form
     has to be the one that works. */
  const candidates = [resolve(file), resolve(repoRoot(), file), resolve(process.env.BACKUP_DIR?.trim() ?? join(repoRoot(), "backups"), basename(file))];
  const dumpPath = candidates.find((p) => existsSync(p));
  if (!dumpPath) {
    throw new Friendly(
      `${basename(file)} does not exist. Looked in:\n` + candidates.map((p) => `      ${p}`).join("\n"),
    );
  }

  const targetUrl = process.env.RESTORE_DATABASE_URL?.trim();
  if (!targetUrl) throw new Friendly("RESTORE_DATABASE_URL is not set — name a NEW, EMPTY database to restore into");
  const target = parsePgUrl(targetUrl);
  if (process.env.DATABASE_URL && sameDatabase(target, parsePgUrl(process.env.DATABASE_URL))) {
    throw new Friendly("RESTORE_DATABASE_URL is the live DATABASE_URL. Restore into a new database, verify it, then switch DATABASE_URL.");
  }

  // 1. The manifest, and the file it describes.
  const manifestPath = dumpPath.replace(/\.dump$/, ".json");
  if (!existsSync(manifestPath)) throw new Friendly(`no manifest next to the dump (${basename(manifestPath)}) — cannot prove the restore`);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as BackupManifest;
  if (manifest.format !== "tnajem-backup/1") throw new Friendly("the manifest is not a tnajem-backup/1 manifest");
  const actual = await sha256(dumpPath);
  if (actual !== manifest.sha256) throw new Friendly("sha256 of the dump does not match its manifest — the file changed or is truncated");
  console.log(`  ✓ 1. ${basename(dumpPath)} matches its manifest (sha256 ${actual.slice(0, 16)}…, taken ${manifest.createdAt})`);

  const pgRestore = findPgTool("pg_restore");
  const restoreVersion = toolVersion(pgRestore);
  const dumpMajor = Number(/^(\d+)/.exec(manifest.pgDumpVersion)?.[1] ?? 0);
  if (restoreVersion.major < dumpMajor) {
    throw new Friendly(`pg_restore ${restoreVersion.major} cannot read a dump made by pg_dump ${dumpMajor} — install client tools ${dumpMajor}+`);
  }

  const sql = postgres(targetUrl, { max: 1, onnotice: () => {}, connect_timeout: 10 });
  try {
    const existing = await sql.unsafe<{ t: string }[]>(TABLES_SQL);
    if (existing.length > 0) {
      throw new Friendly(`the target database is not empty (${existing.length} tables). Restore only into a new, empty database.`);
    }

    // 2. All or nothing.
    const run = await runPgTool(
      pgRestore,
      ["--single-transaction", "--exit-on-error", "--no-owner", "--no-privileges", "--no-password", `--dbname=${target.database}`, dumpPath],
      pgEnv(target),
    );
    if (run.code !== 0) {
      throw new Friendly(`pg_restore failed (exit ${run.code}) and rolled back: ${summarizePgError(run.stderr, target)}`);
    }
    console.log(`  ✓ 2. pg_restore ${restoreVersion.full} completed in one transaction`);

    // 3. Same tables.
    const restored = (await sql.unsafe<{ t: string }[]>(TABLES_SQL)).map((r) => r.t);
    const expected = Object.keys(manifest.tables);
    const missing = expected.filter((t) => !restored.includes(t));
    const extra = restored.filter((t) => !(t in manifest.tables));
    if (missing.length || extra.length) {
      throw new Friendly(`table set differs — missing: ${missing.join(", ") || "none"}; unexpected: ${extra.join(", ") || "none"}`);
    }
    console.log(`  ✓ 3. all ${expected.length} tables present, none unexpected`);

    // 4. Same rows.
    const mismatched: string[] = [];
    let rows = 0;
    for (const t of expected) {
      const [{ n }] = await sql.unsafe<{ n: string }[]>(`select count(*)::bigint as n from "${t.replace(/"/g, '""')}"`);
      rows += Number(n);
      if (Number(n) !== manifest.tables[t]) mismatched.push(`${t} (backup ${manifest.tables[t]}, restored ${n})`);
    }
    if (mismatched.length) throw new Friendly(`row counts differ: ${mismatched.join("; ")}`);
    console.log(`  ✓ 4. every row count matches the backup snapshot (${rows} rows)`);
  } finally {
    await sql.end({ timeout: 2 }).catch(() => {});
  }

  console.log(
    `\n✓ restore verified (migrations through ${manifest.latestMigration}). ` +
      "Uploaded files are restored separately — see DEPLOY.md, Restore.",
  );
}

main().catch((e) => {
  if (e instanceof Friendly) console.error(`\n✗ db:restore: ${e.message}`);
  else {
    const frame = String((e as Error)?.stack ?? "").split("\n").find((l) => l.trim().startsWith("at ")) ?? "";
    console.error(`\n✗ db:restore crashed: ${(e as { code?: string })?.code ?? (e as Error)?.name ?? typeof e} ${frame.trim()}`);
  }
  process.exit(1);
});
