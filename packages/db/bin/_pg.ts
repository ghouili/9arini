/* Shared plumbing for db:backup and db:restore: finding the PostgreSQL client
   tools, and handing them a connection WITHOUT putting a password anywhere it can
   leak.

   pg_dump/pg_restore accept a connection string on argv, and that is exactly what
   these scripts never do: argv is visible to every user on the box (ps, Task
   Manager, /proc/<pid>/cmdline) and ends up in shell history and CI logs. The
   connection goes through the libpq environment (PGHOST, PGPORT, PGUSER,
   PGPASSWORD, PGDATABASE, PGSSLMODE) of the child process only. Nothing here
   prints a host, a user, a database name or a password. */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type PgTarget = {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
  params: Record<string, string>;
};

const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** Parse a postgres:// URL by hand. `new URL()` truncates at a raw "#" or "?" in a
    password, which is a legal thing for a generated password to contain, and the
    result would be a backup of the wrong thing or a confusing auth failure. */
export function parsePgUrl(url: string): PgTarget {
  const m = /^postgres(?:ql)?:\/\/(.*)$/i.exec(url.trim());
  if (!m) throw new Error("not a postgres:// connection URL");
  const rest = m[1];
  const at = rest.lastIndexOf("@");
  const userinfo = at >= 0 ? rest.slice(0, at) : "";
  const hostPart = at >= 0 ? rest.slice(at + 1) : rest;
  const colon = userinfo.indexOf(":");
  const user = safeDecode(colon >= 0 ? userinfo.slice(0, colon) : userinfo);
  const password = safeDecode(colon >= 0 ? userinfo.slice(colon + 1) : "");

  const q = hostPart.indexOf("?");
  const beforeQuery = q >= 0 ? hostPart.slice(0, q) : hostPart;
  const query = q >= 0 ? hostPart.slice(q + 1) : "";
  const slash = beforeQuery.indexOf("/");
  const hostPort = slash >= 0 ? beforeQuery.slice(0, slash) : beforeQuery;
  const database = safeDecode(slash >= 0 ? beforeQuery.slice(slash + 1) : "");
  if (hostPort.includes(",")) throw new Error("multi-host connection URLs are not supported here");

  let host = hostPort;
  let port = "5432";
  const bracket = /^\[(.+)\](?::(\d+))?$/.exec(hostPort);
  if (bracket) {
    host = bracket[1];
    port = bracket[2] ?? port;
  } else if (hostPort.includes(":")) {
    const i = hostPort.lastIndexOf(":");
    host = hostPort.slice(0, i);
    port = hostPort.slice(i + 1);
  }
  const params: Record<string, string> = {};
  for (const pair of query.split("&").filter(Boolean)) {
    const eq = pair.indexOf("=");
    params[safeDecode(eq >= 0 ? pair.slice(0, eq) : pair)] = safeDecode(eq >= 0 ? pair.slice(eq + 1) : "");
  }
  if (!host) throw new Error("the connection URL has no host");
  if (!database) throw new Error("the connection URL names no database");
  return { host: safeDecode(host), port, user, password, database, params };
}

/** The libpq environment for a child process. */
export function pgEnv(t: PgTarget): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  // Never let an unrelated inherited PG* variable redirect the child.
  for (const k of Object.keys(env)) if (/^PG[A-Z]+$/.test(k)) delete env[k];
  env.PGHOST = t.host;
  env.PGPORT = t.port;
  if (t.user) env.PGUSER = t.user;
  if (t.password) env.PGPASSWORD = t.password;
  env.PGDATABASE = t.database;
  const ssl = t.params.sslmode ?? (t.params.ssl === "true" || t.params.ssl === "require" ? "require" : undefined);
  if (ssl) env.PGSSLMODE = ssl;
  env.PGCONNECT_TIMEOUT = "10";
  return env;
}

/** Same server and database? (Used to refuse restoring over the live database.) */
export function sameDatabase(a: PgTarget, b: PgTarget): boolean {
  const h = (s: string) => (s === "127.0.0.1" || s === "::1" ? "localhost" : s.toLowerCase());
  return h(a.host) === h(b.host) && a.port === b.port && a.database === b.database;
}

/** Locate a PostgreSQL client tool: PG_BIN, then PATH, then the standard Windows
    installer location (the newest version installed). */
export function findPgTool(name: "pg_dump" | "pg_restore"): string {
  const exe = process.platform === "win32" ? `${name}.exe` : name;
  if (process.env.PG_BIN) {
    const p = join(process.env.PG_BIN, exe);
    if (existsSync(p)) return p;
    throw new Error(`PG_BIN is set but has no ${exe}`);
  }
  const onPath = spawnSync(exe, ["--version"], { encoding: "utf8" });
  if (onPath.status === 0) return exe;
  if (process.platform === "win32") {
    const root = "C:\\Program Files\\PostgreSQL";
    if (existsSync(root)) {
      const versions = readdirSync(root).filter((v) => /^\d+$/.test(v)).sort((a, b) => Number(b) - Number(a));
      for (const v of versions) {
        const p = join(root, v, "bin", exe);
        if (existsSync(p)) return p;
      }
    }
  }
  throw new Error(`${name} not found. Install the PostgreSQL client tools, or set PG_BIN to their folder.`);
}

/** Major version of a client tool, e.g. 18 for "pg_dump (PostgreSQL) 18.1". */
export function toolVersion(tool: string): { major: number; full: string } {
  const r = spawnSync(tool, ["--version"], { encoding: "utf8" });
  const m = /(\d+)(?:\.(\d+))?/.exec(r.stdout ?? "");
  if (r.status !== 0 || !m) throw new Error(`could not run ${tool} --version`);
  return { major: Number(m[1]), full: m[2] ? `${m[1]}.${m[2]}` : m[1] };
}

/** Run a tool to completion. Its stderr is returned (for a failure summary) but is
    NOT echoed: libpq error text can include the host and user name. */
export function runPgTool(tool: string, args: string[], env: NodeJS.ProcessEnv): Promise<{ code: number; stderr: string }> {
  return new Promise((resolvePromise) => {
    const child = spawn(tool, args, { env, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => {
      if (stderr.length < 64_000) stderr += String(d);
    });
    child.on("error", (e) => resolvePromise({ code: -1, stderr: e.name }));
    child.on("close", (code) => resolvePromise({ code: code ?? -1, stderr }));
  });
}

/** A tool's error reduced to something printable: the libpq/pg_dump message kinds,
    with anything that looks like a host, user or database name removed. */
export function summarizePgError(stderr: string, t: PgTarget): string {
  let s = stderr.split(/\r?\n/).filter((l) => /error|fatal|could not/i.test(l)).slice(0, 3).join(" | ");
  for (const secret of [t.password, t.user, t.host, t.database].filter((x) => x && x.length > 1)) {
    s = s.split(secret).join("…");
  }
  return s.replace(/"[^"]*"/g, '"…"').slice(0, 400) || "no error output";
}

/** Public-schema tables, in a stable order. */
export const TABLES_SQL = `select table_name as t from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`;

/** What db:backup writes next to every dump, and db:restore checks against. */
export type BackupManifest = {
  format: "tnajem-backup/1";
  createdAt: string;
  dumpFile: string;
  bytes: number;
  sha256: string;
  serverVersion: string;
  pgDumpVersion: string;
  latestMigration: string | null;
  tables: Record<string, number>;
};
