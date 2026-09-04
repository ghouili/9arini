/* Path + env resolution for the CLI scripts.

   NEVER use process.cwd() in these scripts. Under npm workspaces
   (`npm run db:sql -w @tnajem/web`) cwd is apps/web, not the repo root, so:
     - `config({ path: ".env" })` silently loads nothing and DATABASE_URL is unset
     - join(process.cwd(), "scripts", "sql") resolves somewhere else entirely

   The second one is the dangerous shape. The retention job builds document paths
   the same way: a purge that runs with the wrong cwd finds no files, counts every
   one as already-gone, and DELETES THE ROWS ANYWAY -- leaving orphaned national ID
   scans on disk with nothing pointing at them, while reporting success. Resolve
   from the module's own location instead. */
import { config } from "dotenv";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";

/** packages/db — the directory this script's package lives in. */
export const PKG_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** The workspace root: walk up until we find the root package.json (the one
    declaring workspaces). Falls back to PKG_ROOT when run outside a monorepo. */
export function repoRoot(): string {
  let dir = PKG_ROOT;
  for (let i = 0; i < 6; i++) {
    const pkg = join(dir, "package.json");
    if (existsSync(pkg)) {
      try {
        /* readFileSync must be IMPORTED: this package is type:module, so a bare
           require() throws ReferenceError -- and the catch below swallowed it,
           so the walk silently ran past the repo root and .env was never found. */
        const j = JSON.parse(readFileSync(pkg, "utf8"));
        if (j.workspaces) return dir;
      } catch { /* keep walking */ }
    }
    const up = resolve(dir, "..");
    if (up === dir) break;
    dir = up;
  }
  return PKG_ROOT;
}

/** Load .env then .env.local from the REPO ROOT, matching Next's precedence. */
export function loadEnv(): void {
  const root = repoRoot();
  config({ path: join(root, ".env") });
  config({ path: join(root, ".env.local"), override: true });
}

/** packages/db/sql, resolved from this module — never from cwd. */
export const SQL_DIR = join(PKG_ROOT, "sql");
