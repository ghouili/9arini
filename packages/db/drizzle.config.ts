import { config } from "dotenv";
import type { Config } from "drizzle-kit";

/* Env from the REPO ROOT, resolved from this module rather than cwd — drizzle-kit
   runs with cwd packages/db under a workspace script, where a relative .env path
   silently loads nothing. Same helper the migration runner uses. */
import { loadEnv } from "./bin/_paths";
loadEnv();

export default {
  /* The schema moved to this package in Step 2. It pointed at ./lib/db/schema.ts
     -- a path that no longer exists -- which db:studio and db:generate would have
     failed on the first time anyone ran them. */
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/tnajem" },

  /* Print the SQL before it runs. The index work in schema.ts is additive
     (CREATE INDEX only), and this is how you confirm that — if a `db:push` ever
     prints a DROP or an ALTER ... TYPE against a table with rows in it, that is
     your cue to stop and switch to `db:generate` + `db:migrate`. */
  verbose: true,

  /* Ask before applying. `db:push` is run by hand against production in DEPLOY.md
     §4; an unattended, unconfirmed push is how a schema change becomes an
     outage. Costs one keypress, buys you the chance to read the `verbose` output
     above it. */
  strict: true,
} satisfies Config;
