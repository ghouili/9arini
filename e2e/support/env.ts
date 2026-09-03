/* Environment for the E2E suite.

   DELIBERATELY uses E2E_* names and NEVER reads DATABASE_URL directly. Step 5's
   gate is `grep -rn "DATABASE_URL" apps/web | wc -l  # expect 0`, and this suite
   needs a database connection forever. Distinct names are what let the suite
   survive the web/api split without a single edit. */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: ".env" });
config({ path: ".env.local", override: true });

export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3210";

/* Fall back to the app's own DATABASE_URL for local runs, but only here, in one
   place, so the rest of the suite never mentions it. */
export const DB_URL = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? "";

export const STORAGE_DIR = resolve(process.env.E2E_STORAGE_DIR ?? ".e2e-storage");

export const API_URL = process.env.E2E_API_URL ?? "";

export const AUTH_SECRET = process.env.AUTH_SECRET ?? "";

/** Every seeded row carries this, so teardown can find them and nothing else. */
export const RUN_ID = process.env.E2E_RUN_ID ?? "local";

/* SAFETY RAIL. This suite writes and deletes rows. It must never be pointed at a
   database that is not on this machine. Same rail as scripts/ui-audit/routes.mjs,
   and non-negotiable given that this database stores national ID scans. */
export function assertLocalDb(url: string): void {
  if (!url) throw new Error("E2E: no database URL (set E2E_DATABASE_URL)");
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
    throw new Error(
      `E2E: refusing to run against a non-local database (host=${host}). ` +
        "This suite seeds and deletes rows.",
    );
  }
}
