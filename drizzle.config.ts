import { config } from "dotenv";
import type { Config } from "drizzle-kit";

// Load .env.local (Next's convention) so drizzle-kit sees DATABASE_URL.
config({ path: ".env.local", override: true }); // .env.local wins over any stray shell DATABASE_URL

export default {
  schema: "./lib/db/schema.ts",
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
