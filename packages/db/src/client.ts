import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createHash } from "node:crypto";
import * as schema from "./schema";

/* ══════════════════════════════════════════════════════════════════════════════
   createDb(url) — the ONLY place a Postgres pool is opened.

   Extracted from apps/web/lib/db/index.ts. Behaviour is unchanged; the difference
   is that it is now a FACTORY with no module-level connection, so the Fastify
   API, the CLI scripts and the web app can each own a pool without the package
   deciding for them.

   NOTE there is no `import "server-only"` here, and there must not be. Fastify
   and tsx both import this package, and `server-only` throws under tsx (see the
   header of bin/apply-sql.ts). The guard is reinstated at the web boundary
   instead — apps/web/lib/db/index.ts — which is where it was actually protecting
   something: a client component importing the DB client and failing the build.

   ── POOL SIZING ─────────────────────────────────────────────────────────────
   Deployment (DEPLOY.md): a VPS running the app behind nginx, Postgres on the
   same box, possibly under pm2 — and pm2 in cluster mode forks one Node process
   PER WORKER. Each worker opens its OWN pool. So the number that matters to
   Postgres is:

       total connections = (pm2 workers) × DB_POOL_MAX  +  short-lived scripts

   Postgres ships with max_connections = 100, of which 3 are reserved for
   superusers. Budget:

       100  max_connections
       − 3  superuser_reserved_connections
       −10  humans + psql + drizzle-kit + pg_dump backups + the purge cron
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

export type Sql = ReturnType<typeof postgres>;
export type Database = ReturnType<typeof drizzle<typeof schema>>;

export type DbHandle = {
  /** False when no URL was supplied. Callers MUST branch on this before using db. */
  ready: boolean;
  sql: Sql | null;
  /** Cast non-null even when !ready — see the note in createDb below. */
  db: Database;
};

export type CreateDbOptions = {
  max?: number;
  prepare?: boolean;
  ssl?: "require" | boolean;
  /** Shows up in pg_stat_activity. Defaults to "Tnajem" to match today exactly. */
  appName?: string;
  /** Skip the globalThis cache. Used by the CLI, which owns its own connection
      and must not install a SIGTERM handler that another owner's end() will race. */
  cache?: boolean;
};

const isProd = (): boolean => process.env.NODE_ENV === "production";

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
  return isProd() && !local ? "require" : false;
}

function createClient(dbUrl: string, opts: CreateDbOptions): Sql {
  const sql = postgres(dbUrl, {
    max: Math.max(1, Number(opts.max ?? process.env.DB_POOL_MAX ?? 10) || 10),
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
    /* Prepared statements. postgres.js prepares by default; server-side plan
       caching is a real win on the hot point-lookups (sessions.token,
       tutors.slug). It is ALSO the one setting that breaks the day you put
       PgBouncer in transaction pooling mode in front of Postgres — a prepared
       statement lives on a server connection the next transaction may not get
       back. Ship it ON now, and set DB_PREPARE=0 in the same change that
       introduces PgBouncer. */
    prepare: opts.prepare ?? process.env.DB_PREPARE !== "0",
    ssl: opts.ssl ?? sslOption(dbUrl),
    // NOTICE spam (e.g. "relation already exists") is noise in prod logs.
    onnotice: isProd() ? () => {} : undefined,
    connection: { application_name: opts.appName ?? "Tnajem" },
  });

  /* Give in-flight queries a moment to finish on a pm2 reload / systemd restart
     instead of severing them mid-transaction. Registered exactly once, inside
     the cache-miss branch, so dev HMR cannot pile up listeners. */
  const close = (): void => {
    void sql.end({ timeout: 5 });
  };
  process.once("SIGTERM", close);
  process.once("SIGINT", close);

  return sql;
}

/* TRUE SINGLETON — not just in dev.

   Next.js dev (HMR) re-evaluates modules on every save, and a bundler can
   legitimately instantiate one twice in a process (separate server/route chunks,
   or a standalone build). Every re-evaluation used to call postgres() again and
   LEAK a whole pool: the old one keeps its sockets open with nothing referencing
   it, so an afternoon of editing walks Postgres up to "sorry, too many clients
   already" — and the same leak in production silently multiplies the connection
   budget above by however many times the module got instantiated. globalThis is
   the only place a value survives both.

   KEYED, unlike the single __tnajemSql slot this replaces. A factory can be
   called with different URLs in one process (the API plus a migration runner, or
   a future read replica); a single slot would silently hand the second caller the
   FIRST caller's pool. The key is a hash, never the URL itself — a
   credential-bearing string must not sit on globalThis where a heap dump or a
   debugger session would show it. */
function pools(): Map<string, Sql> {
  const g = globalThis as unknown as { __tnajemPools?: Map<string, Sql> };
  g.__tnajemPools ??= new Map<string, Sql>();
  return g.__tnajemPools;
}

export function createDb(url?: string | null, opts: CreateDbOptions = {}): DbHandle {
  if (!url) {
    /* Keep the historical shape: db is cast non-null even when it is null, so the
       `if (!dbReady) return { ok: true, demo: true }` branches in the web app stay
       untouched. That tolerance exists for `next build` and the ui-audit harness.
       It has no meaning in Fastify — apps/api asserts DATABASE_URL at boot and
       exits instead. The asymmetry is deliberate; do not "unify" it, or you
       reintroduce the module-load throw that once broke `next build`. */
    return { ready: false, sql: null, db: null as unknown as Database };
  }

  if (opts.cache === false) {
    const sql = createClient(url, opts);
    return { ready: true, sql, db: drizzle(sql, { schema }) };
  }

  const key = createHash("sha1").update(`${url}|${opts.appName ?? ""}`).digest("hex").slice(0, 12);
  const cached = pools().get(key);
  const sql = cached ?? createClient(url, opts);
  if (!cached) pools().set(key, sql);

  return { ready: true, sql, db: drizzle(sql, { schema }) };
}
