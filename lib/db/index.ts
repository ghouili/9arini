import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/* ══════════════════════════════════════════════════════════════════════════════
   Server-only Postgres client (postgres.js + Drizzle).

   `dbReady` is false when DATABASE_URL is unset, in which case the data layer
   falls back to demo data in dev and throws in production (see lib/data.ts).

   ── POOL SIZING ─────────────────────────────────────────────────────────────
   Deployment (DEPLOY.md): a VPS running `next start` behind nginx, Postgres on
   the same box, possibly under pm2 — and pm2 in cluster mode forks one Node
   process PER WORKER. Each worker imports this module and opens its OWN pool.
   So the number that matters to Postgres is:

       total connections = (pm2 workers) × DB_POOL_MAX  +  short-lived scripts

   Postgres ships with max_connections = 100, of which 3 are reserved for
   superusers. Budget:

       100  max_connections
       − 3  superuser_reserved_connections
       −10  humans + psql + drizzle-kit push + pg_dump backups + the purge cron
       = 87 usable for the app

   Default DB_POOL_MAX = 10. With the recommended 2 pm2 workers that is 20
   connections — comfortably inside 87, with room to survive a bad deploy that
   leaves an old process holding its pool for a few seconds.

   Why 10 and not 50: a Postgres connection is a forked backend process (~5-10MB
   RSS). Throughput does not scale with connections — it peaks at roughly
   2-4 × CPU cores of *concurrently active* queries and then degrades as the
   backends fight over CPU and locks. On a 2-4 core VPS, ~20 total connections is
   already at the knee of the curve. Queries here are indexed point-lookups of
   1-5 ms, so 10 slots per worker sustains well over 1000 queries/sec/worker.
   Under a viral spike the right behaviour is to QUEUE inside postgres.js (which
   is what a bounded pool does) rather than to open a 4th, 40th, 400th backend
   and thrash the database into a death spiral.

   If you raise the worker count, LOWER DB_POOL_MAX to keep the product under
   ~87. When that stops being enough, the answer is PgBouncer, not a bigger pool
   (see SCALABILITY.md).
   ═════════════════════════════════════════════════════════════════════════════ */

const url = process.env.DATABASE_URL;
export const dbReady = Boolean(url);

const isProd = process.env.NODE_ENV === "production";

/** Per-process pool ceiling. Keep (workers × this) under ~87. */
const POOL_MAX = Math.max(1, Number(process.env.DB_POOL_MAX ?? 10) || 10);

/* SSL. Postgres on the same VPS over the loopback interface needs no TLS (and a
   default Postgres install does not even offer it — forcing `require` there is a
   guaranteed connection error). A REMOTE database must always use TLS: the
   password and every row would otherwise cross the network in the clear.

   Precedence: explicit DB_SSL env → `sslmode=` already in the URL (postgres.js
   parses it) → auto-detect from the host. */
function sslOption(dbUrl: string): "require" | boolean | undefined {
  const forced = process.env.DB_SSL;
  if (forced === "require") return "require";
  if (forced === "0" || forced === "false") return false;
  if (/[?&]sslmode=/.test(dbUrl)) return undefined; // let the URL decide

  let host = "";
  try {
    host = new URL(dbUrl).hostname;
  } catch {
    return undefined;
  }
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "";
  return isProd && !local ? "require" : false;
}

/* Prepared statements. postgres.js prepares by default; server-side plan caching
   is a real win on the hot point-lookups (sessions.token, tutors.slug). It is
   ALSO the one setting that breaks the day you put PgBouncer in transaction
   pooling mode in front of Postgres — a prepared statement lives on a server
   connection the next transaction may not get back. Ship it ON now, and set
   DB_PREPARE=0 in the same change that introduces PgBouncer. */
const PREPARE = process.env.DB_PREPARE !== "0";

function createClient(dbUrl: string) {
  const sql = postgres(dbUrl, {
    max: POOL_MAX,
    // Seconds a connection may sit idle before it is closed. Keeps the steady
    // state small between traffic spikes instead of pinning max backends forever.
    idle_timeout: 20,
    // Recycle connections every 30 min: bounds per-backend memory growth and lets
    // a failed-over/restarted Postgres get clean connections without a redeploy.
    max_lifetime: 60 * 30,
    // Fail fast when Postgres is down or saturated. The default is to wait
    // forever, which under load turns a DB outage into every Node request
    // hanging until the client gives up — nginx 504s and no capacity to serve
    // the CACHED storefront pages that would otherwise still be fine.
    connect_timeout: 10,
    prepare: PREPARE,
    ssl: sslOption(dbUrl),
    // NOTICE spam (e.g. "relation already exists") is noise in prod logs.
    onnotice: isProd ? () => {} : undefined,
    connection: { application_name: "9arini" }, // shows up in pg_stat_activity
  });

  /* Give in-flight queries a moment to finish on a pm2 reload / systemd restart
     instead of severing them mid-transaction. Registered exactly once, inside
     the singleton branch, so dev HMR cannot pile up listeners. */
  const close = () => {
    void sql.end({ timeout: 5 });
  };
  process.once("SIGTERM", close);
  process.once("SIGINT", close);

  return sql;
}

/* TRUE SINGLETON — not just in dev.

   Next.js dev (HMR) re-evaluates this module on every save, and a bundler can
   legitimately instantiate a module twice in one process (separate server/route
   chunks, or a `next start` standalone build). Every re-evaluation used to call
   postgres() again and LEAK a whole pool: the old one keeps its sockets open
   with nothing referencing it, so an afternoon of editing walks Postgres up to
   "sorry, too many clients already" — and the same class of leak in production
   silently multiplies the connection budget above by however many times the
   module got instantiated. Caching on globalThis is the only place a value
   survives both. Cheap insurance; there is no downside to it in production. */
const g = globalThis as unknown as { __qariniSql?: ReturnType<typeof postgres> };

const sql = url ? (g.__qariniSql ?? createClient(url)) : null;
if (sql) g.__qariniSql = sql;

export const db = sql ? drizzle(sql, { schema }) : (null as unknown as ReturnType<typeof drizzle<typeof schema>>);
export { sql };
export { schema };
