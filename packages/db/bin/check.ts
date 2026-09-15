/* npm run db:check — can THIS box run Tnajem, right now?

   One command that answers the questions every "it works on my machine" cycle
   on this project started with: is the database reachable, has every numbered
   migration been applied, can the document store be written, and which config
   keys are present.

     npm run db:check                 development rules (production keys warn)
     npm run db:check -- --production production rules (production keys fail)
                                      — also implied by NODE_ENV=production

   NEVER PRINTS A VALUE. Every key is reported as set / empty / missing, and the
   storage directory is exercised without echoing its path. The server version
   is printed: it is not configuration.

   "Every migration applied" without a ledger: there is no schema_migrations
   table yet (Stage 6 adds one), so this reads packages/db/sql/*.sql and checks
   that every table they CREATE and every column they ADD exists. That catches
   the real failure — a new file nobody ran — and needs no bookkeeping. */
import { loadEnv, SQL_DIR } from "./_paths";
loadEnv();

import postgres from "postgres";
import { verifyMail, closeMail } from "@tnajem/shared/mail";
import { readFile, readdir, mkdir, writeFile, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";

/* The public fallback in packages/shared/src/auth-core.ts (DEV_SECRET). */
const PUBLIC_DEV_SECRET = "dev-insecure-secret-change-me";

const production = process.argv.includes("--production") || process.env.NODE_ENV === "production";
let failures = 0;
let warnings = 0;

const ok = (label: string, detail = "") => console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ""}`);
const warn = (label: string, detail: string) => {
  warnings++;
  console.log(`  ! ${label} — ${detail}`);
};
const fail = (label: string, detail: string) => {
  failures++;
  console.log(`  ✗ ${label} — ${detail}`);
};

type KeyState = "set" | "empty" | "missing";
function keyState(name: string): KeyState {
  const v = process.env[name];
  if (v === undefined) return "missing";
  return v.trim() ? "set" : "empty";
}

/** A key that must be set everywhere, or only in production. */
function requireKey(name: string, when: "always" | "production", why: string) {
  const state = keyState(name);
  if (state === "set") return ok(name, "set");
  if (when === "always" || production) return fail(name, `${state}. ${why}`);
  warn(name, `${state} (required in production). ${why}`);
}

function checkEnv() {
  console.log("\nConfiguration");
  requireKey("DATABASE_URL", "always", "Nothing can start without it.");
  requireKey("API_URL", "always", "The web app has nothing to call without it (demo mode needs TNAJEM_DEMO=1).");
  requireKey("STORAGE_DIR", "always", "Unset, every workspace resolves a different cwd-relative store.");

  const secret = process.env.AUTH_SECRET?.trim() ?? "";
  if (!secret) fail("AUTH_SECRET", `${keyState("AUTH_SECRET")}. Every OTP hash depends on it: openssl rand -hex 32`);
  else if (secret === PUBLIC_DEV_SECRET) fail("AUTH_SECRET", "set, but to the PUBLIC development default. Generate one: openssl rand -hex 32");
  else if (secret.length < 32) (production ? fail : warn)("AUTH_SECRET", "set, but shorter than 32 characters");
  else ok("AUTH_SECRET", "set, not the public default, 32+ characters");

  if (process.env.TNAJEM_DEMO === "1") {
    (production ? fail : warn)("TNAJEM_DEMO", "set to 1 — demo data is development-only");
  }

  requireKey("ADMIN_EMAILS", "production", "Empty means nobody can review verifications.");
  requireKey("CRON_SECRET", "production", "Unset, /cron/purge refuses to run and nothing is ever purged.");
  requireKey("CORS_ORIGINS", "production", "Empty in production, the API refuses to boot.");
  requireKey("NEXT_PUBLIC_SITE_URL", "production", "Canonical links and the sitemap fall back to https://tnajem.tn.");

  const mailKeys = ["MAIL_HOST", "MAIL_USER", "MAIL_PASS", "MAIL_FROM_ADDRESS"];
  const mailMissing = mailKeys.filter((k) => keyState(k) !== "set");
  if (mailMissing.length === 0) ok("MAIL_*", "HOST, USER, PASS, FROM_ADDRESS set (login tested below)");
  else if (production) fail("MAIL_*", `${mailMissing.join(", ")} not set — no login code can be delivered`);
  else warn("MAIL_*", `${mailMissing.join(", ")} not set — login codes are shown on screen (dev only)`);
}

/** Tables created and columns added by the numbered migrations. */
async function expectedSchema() {
  const files = (await readdir(SQL_DIR)).filter((f) => f.endsWith(".sql")).sort();
  const tables = new Set<string>();
  const columns = new Set<string>(); // "table.column"
  for (const file of files) {
    const text = (await readFile(join(SQL_DIR, file), "utf8")).replace(/--[^\n]*/g, "");
    for (const m of text.matchAll(/create\s+table\s+if\s+not\s+exists\s+"?(?:public\.)?"?([a-z_]+)"?/gi)) {
      tables.add(m[1]);
    }
    for (const stmt of text.matchAll(/alter\s+table\s+(?:only\s+)?"?(?:public\.)?"?([a-z_]+)"?([^;]*);/gi)) {
      for (const c of stmt[2].matchAll(/add\s+column\s+if\s+not\s+exists\s+"?([a-z_]+)"?/gi)) {
        columns.add(`${stmt[1]}.${c[1]}`);
      }
    }
  }
  return { files, tables, columns };
}

async function checkDatabase() {
  console.log("\nDatabase");
  const url = process.env.DATABASE_URL;
  if (!url) return fail("connection", "skipped — DATABASE_URL is not set");

  let sql: ReturnType<typeof postgres>;
  try {
    sql = postgres(url, { max: 1, onnotice: () => {}, connect_timeout: 5 });
  } catch {
    return fail("connection", "DATABASE_URL is set but is not a valid connection URL");
  }
  try {
    const [{ version }] = await sql<{ version: string }[]>`select version()`;
    ok("connection", version.split(",")[0]);

    const { files, tables, columns } = await expectedSchema();
    const presentTables = new Set(
      (await sql<{ t: string }[]>`
        select table_name as t from information_schema.tables where table_schema = 'public'`).map((r) => r.t),
    );
    const presentColumns = new Set(
      (await sql<{ c: string }[]>`
        select table_name || '.' || column_name as c from information_schema.columns where table_schema = 'public'`).map((r) => r.c),
    );
    const missingTables = [...tables].filter((t) => !presentTables.has(t));
    const missingColumns = [...columns].filter((c) => !presentColumns.has(c));
    const latest = files[files.length - 1];
    if (missingTables.length === 0 && missingColumns.length === 0) {
      ok("migrations", `${files.length} files through ${latest}: ${tables.size} tables and ${columns.size} added columns present`);
    } else {
      fail(
        "migrations",
        `not fully applied (latest file ${latest}). Missing ` +
          [missingTables.length ? `tables: ${missingTables.join(", ")}` : "", missingColumns.length ? `columns: ${missingColumns.join(", ")}` : ""]
            .filter(Boolean)
            .join("; ") +
          ". Run: npm run db:sql",
      );
    }
  } catch (e) {
    fail("connection", `cannot reach the database (${(e as { code?: string }).code ?? (e as Error).name})`);
  } finally {
    await sql.end({ timeout: 2 }).catch(() => {});
  }
}

async function checkStorage() {
  console.log("\nDocument store");
  const dir = process.env.STORAGE_DIR?.trim();
  if (!dir) return fail("write/read/delete", "skipped — STORAGE_DIR is not set");
  const sentinel = join(resolve(dir), `.tnajem-check-${process.pid}`);
  const body = `db:check ${new Date().toISOString()}`;
  try {
    await mkdir(resolve(dir), { recursive: true });
    await writeFile(sentinel, body, { mode: 0o600 });
    const back = await readFile(sentinel, "utf8");
    await unlink(sentinel);
    if (back !== body) return fail("write/read/delete", "read back different bytes");
    ok("write/read/delete", "sentinel file round-tripped (local filesystem)");
  } catch (e) {
    fail("write/read/delete", `failed (${(e as { code?: string }).code ?? (e as Error).name})`);
    await unlink(sentinel).catch(() => {});
  }
}

/* Presence was never the question that mattered: a set MAIL_PASS that Gmail rejects
   means nobody can log in, and the first to find out is a user. verify() connects and
   authenticates without sending anything. */
async function checkMail() {
  console.log("\nMail");
  const keys = ["MAIL_HOST", "MAIL_USER", "MAIL_PASS", "MAIL_FROM_ADDRESS"];
  if (keys.some((k) => keyState(k) !== "set")) {
    return (production ? fail : warn)("SMTP login", "skipped — MAIL_* incomplete (see Configuration)");
  }
  const res = await verifyMail();
  closeMail();
  if (res.ok) ok("SMTP login", "connected and authenticated (nothing sent)");
  else (production ? fail : warn)("SMTP login", `failed: ${res.error}`);
}

async function main() {
  console.log(`Tnajem db:check — ${production ? "PRODUCTION" : "development"} rules`);
  checkEnv();
  await checkDatabase();
  await checkStorage();
  await checkMail();
  console.log(`\n${failures === 0 ? "✓ OK" : `✗ ${failures} failure(s)`}${warnings ? `, ${warnings} warning(s)` : ""}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  /* Name and the first stack frame (a code location) — not the message, which for
     a driver error can carry connection details. */
  const frame = String((e as Error)?.stack ?? "").split("\n").find((l) => l.trim().startsWith("at ")) ?? "";
  console.error(`✗ db:check crashed: ${(e as Error)?.name ?? typeof e} ${frame.trim()}`);
  process.exit(1);
});
