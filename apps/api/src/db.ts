import { createDb } from "@tnajem/db";

/* The API's database handle.

   Note the asymmetry with apps/web, which is deliberate and should not be
   "unified": the web app tolerates a missing DATABASE_URL (createDb returns
   ready:false and the actions fall back to demo data in dev / throw in prod),
   because `next build` evaluates the whole module graph and a boot-time throw
   would kill the build on any box that injects secrets at runtime.

   Fastify has no build step to protect. A missing DATABASE_URL here is simply a
   broken deploy, so it fails at boot and says why — which is far better than
   starting healthy and 500ing on the first request. */

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[tnajem-api] FATAL: DATABASE_URL is required.");
  process.exit(1);
}

const handle = createDb(url, { appName: "tnajem-api" });

export const db = handle.db;
export const sql = handle.sql;
