/* Env is loaded from the REPO ROOT, resolved from this module rather than cwd --
   under `npm run db:sql -w @tnajem/web` cwd is apps/web and the root .env files
   would be silently missed. See _paths.ts. */
import { loadEnv, SQL_DIR } from "./_paths";
loadEnv();

import postgres from "postgres";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

/* Apply raw SQL migrations from scripts/sql/.
   Run: npm run db:sql            (applies every .sql file, in filename order)
        npm run db:sql -- 0001    (applies only files whose name starts with 0001)

   WHY NOT `drizzle-kit push`?
   drizzle-kit 0.28.x is not PostgreSQL 17-aware. PG17 stores NOT NULL as *named*
   catalog constraints; drizzle-kit sees constraints it didn't author and emits
   `ALTER TABLE ... DROP CONSTRAINT "<table>_<col>_not_null"` for ~60 columns —
   i.e. it tries to strip NOT NULL off most of the database. Postgres only saves
   you by aborting on 42P16 ("column id is in a primary key"). Until drizzle-kit
   is upgraded, schema changes go through this script.

   Standalone: connects directly and does NOT import lib/db/index.ts (that module
   is guarded by `server-only`, which throws under tsx outside the Next runtime).

   The .sql files are idempotent (IF NOT EXISTS), so re-running is safe. Each file
   is wrapped in a transaction: it applies completely, or not at all. */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("✗ DATABASE_URL is not set (looked in .env.local).");
    process.exit(1);
  }

  const filter = process.argv.slice(2).find((a) => !a.startsWith("-"));
  const dir = SQL_DIR;

  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  } catch {
    console.error(`✗ No SQL directory at ${dir}`);
    process.exit(1);
  }
  if (filter) files = files.filter((f) => f.startsWith(filter));
  if (files.length === 0) {
    console.error("✗ No matching .sql files to apply.");
    process.exit(1);
  }

  // max: 1 — this is a one-shot migration runner, not a server.
  const sql = postgres(url, { max: 1, onnotice: () => {} });

  try {
    const [{ version }] = await sql<{ version: string }[]>`select version()`;
    console.log(`→ ${version.split(",")[0]}`);

    for (const file of files) {
      const text = await readFile(join(dir, file), "utf8");
      process.stdout.write(`→ applying ${file} ... `);
      // begin() gives us all-or-nothing per file. sql.unsafe() with no parameters
      // uses the simple query protocol, so a multi-statement file runs as one batch.
      await sql.begin((tx) => [tx.unsafe(text)]);
      console.log("ok");
    }

    console.log(`\n✓ Applied ${files.length} file(s). Schema is up to date.`);
  } catch (err) {
    console.error("\n✗ Migration failed — nothing from the failing file was committed.");
    console.error(err);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main();
