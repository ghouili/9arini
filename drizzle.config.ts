import { config } from "dotenv";
import type { Config } from "drizzle-kit";

// Load .env.local (Next's convention) so drizzle-kit sees DATABASE_URL.
config({ path: ".env.local", override: true }); // .env.local wins over any stray shell DATABASE_URL

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/qarini" },
} satisfies Config;
