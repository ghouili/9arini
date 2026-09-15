/* npm run db:backup — a restorable, verifiable snapshot of the database.

     npm run db:backup                 writes to BACKUP_DIR, else <repo>/backups
     npm run db:backup -- --out <dir>

   Produces two files with the same stem:
     tnajem-<UTC timestamp>.dump   pg_dump custom format (compressed, restorable
                                   table by table with pg_restore)
     tnajem-<UTC timestamp>.json   the manifest: sha256 of the dump, server and
                                   pg_dump versions, latest migration file, and
                                   the row count of every table

   THE ROW COUNTS ARE EXACT, not "roughly then". The counts and the dump read the
   SAME snapshot: this script opens a repeatable-read transaction, exports its
   snapshot, counts every table inside it, and runs pg_dump --snapshot=<that id>
   while the transaction is still open. db:restore then proves a restore by
   comparing its counts with these, table by table. A backup nobody has restored is
   a hope, not a backup.

   The dump holds every user's personal data. It is written with owner-only
   permissions, but encrypting it and storing it OFF this machine is the operator's
   job (DEPLOY.md, "Backups"). How long backups are kept is a legal decision that
   has not been made (LEGAL-REVIEW: backup retention period) — this script never
   deletes old ones.

   Needs a DIRECT database connection: snapshot export does not survive a
   transaction-pooling proxy (PgBouncer in transaction mode).

   Uploaded files (STORAGE_DIR) are NOT in this dump. See DEPLOY.md "Backups". */
import { loadEnv, repoRoot, SQL_DIR } from "./_paths";
loadEnv();

import postgres from "postgres";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { chmod, mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { findPgTool, parsePgUrl, pgEnv, runPgTool, summarizePgError, TABLES_SQL, toolVersion, type BackupManifest } from "./_pg";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function sha256(file: string): Promise<string> {
  const h = createHash("sha256");
  for await (const chunk of createReadStream(file)) h.update(chunk as Buffer);
  return h.digest("hex");
}

async function main() {
  console.log("Tnajem db:backup");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Friendly("DATABASE_URL is not set");
  const target = parsePgUrl(url);

  const pgDump = findPgTool("pg_dump");
  const dumpVersion = toolVersion(pgDump);

  const outDir = resolve(argValue("--out") ?? process.env.BACKUP_DIR?.trim() ?? join(repoRoot(), "backups"));
  const outLabel = argValue("--out") ? "--out" : process.env.BACKUP_DIR?.trim() ? "BACKUP_DIR" : "./backups";
  await mkdir(outDir, { recursive: true, mode: 0o700 });

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const stem = `tnajem-${stamp}`;
  const dumpPath = join(outDir, `${stem}.dump`);
  const partial = `${dumpPath}.partial`;
  leftover = partial;

  const migrations = (await readdir(SQL_DIR)).filter((f) => f.endsWith(".sql")).sort();

  const sql = postgres(url, { max: 1, onnotice: () => {}, connect_timeout: 10 });
  let manifest: BackupManifest;
  try {
    const [{ server_version: serverVersion }] = await sql<{ server_version: string }[]>`show server_version`;
    const serverMajor = Number(/^(\d+)/.exec(serverVersion)?.[1] ?? 0);
    console.log(`  ✓ server PostgreSQL ${serverVersion.split(" ")[0]}, pg_dump ${dumpVersion.full}`);
    if (dumpVersion.major < serverMajor) {
      throw new Friendly(`pg_dump ${dumpVersion.major} cannot dump a PostgreSQL ${serverMajor} server — install client tools ${serverMajor}+ (or set PG_BIN)`);
    }

    manifest = await sql.begin("isolation level repeatable read read only", async (tx) => {
      const [{ id: snapshot }] = await tx<{ id: string }[]>`select pg_export_snapshot() as id`;
      const tables: Record<string, number> = {};
      for (const { t } of await tx.unsafe<{ t: string }[]>(TABLES_SQL)) {
        const [{ n }] = await tx.unsafe<{ n: string }[]>(`select count(*)::bigint as n from "${t.replace(/"/g, '""')}"`);
        tables[t] = Number(n);
      }
      console.log(`  ✓ snapshot exported; ${Object.keys(tables).length} tables counted inside it`);

      const run = await runPgTool(
        pgDump,
        ["--format=custom", `--snapshot=${snapshot}`, "--no-password", `--file=${partial}`],
        pgEnv(target),
      );
      if (run.code !== 0) {
        await rm(partial, { force: true });
        throw new Friendly(`pg_dump failed (exit ${run.code}): ${summarizePgError(run.stderr, target)}`);
      }
      return {
        format: "tnajem-backup/1" as const,
        createdAt: new Date().toISOString(),
        dumpFile: basename(dumpPath),
        bytes: 0,
        sha256: "",
        serverVersion: serverVersion.split(" ")[0],
        pgDumpVersion: dumpVersion.full,
        latestMigration: migrations[migrations.length - 1] ?? null,
        tables,
      };
    });
  } finally {
    await sql.end({ timeout: 2 }).catch(() => {});
  }

  await chmod(partial, 0o600).catch(() => {});
  await rename(partial, dumpPath);
  leftover = null;
  manifest.bytes = (await stat(dumpPath)).size;
  manifest.sha256 = await sha256(dumpPath);
  const manifestPath = join(outDir, `${stem}.json`);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600 });

  const rows = Object.values(manifest.tables).reduce((a, b) => a + b, 0);
  console.log(`  ✓ ${manifest.dumpFile} written in ${outLabel} — ${(manifest.bytes / 1024).toFixed(0)} KiB, sha256 ${manifest.sha256.slice(0, 16)}…`);
  console.log(`  ✓ manifest ${basename(manifestPath)}: ${Object.keys(manifest.tables).length} tables, ${rows} rows, migrations through ${manifest.latestMigration}`);
  console.log("\n✓ backup complete. Uploaded files are NOT included — back up the object store too (DEPLOY.md, Backups).");
}

/** An expected failure with a message that is safe to print. */
class Friendly extends Error {}

/** A half-written dump is never left looking like a backup. */
let leftover: string | null = null;

main().catch(async (e) => {
  if (leftover) await rm(leftover, { force: true }).catch(() => {});
  if (e instanceof Friendly) console.error(`\n✗ db:backup: ${e.message}`);
  else {
    const frame = String((e as Error)?.stack ?? "").split("\n").find((l) => l.trim().startsWith("at ")) ?? "";
    console.error(`\n✗ db:backup crashed: ${(e as { code?: string })?.code ?? (e as Error)?.name ?? typeof e} ${frame.trim()}`);
  }
  process.exit(1);
});
