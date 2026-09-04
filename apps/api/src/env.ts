import { config } from "dotenv";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";

/* Config, loaded from the REPO ROOT rather than cwd.

   Same rule as packages/db/bin/_paths.ts and for the same reason: cwd is
   whichever workspace launched the process, so a cwd-relative .env silently
   loads nothing and every secret comes back undefined. */

const PKG_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

function repoRoot(): string {
  let dir = PKG_ROOT;
  for (let i = 0; i < 6; i++) {
    const pkg = join(dir, "package.json");
    if (existsSync(pkg)) {
      try {
        const j = JSON.parse(readFileSync(pkg, "utf8"));
        if (j.workspaces) return dir;
      } catch {
        /* keep walking */
      }
    }
    const up = resolve(dir, "..");
    if (up === dir) break;
    dir = up;
  }
  return PKG_ROOT;
}

const root = repoRoot();
config({ path: join(root, ".env") });
config({ path: join(root, ".env.local"), override: true });

export const PORT = Number(process.env.API_PORT ?? 4000);
export const HOST = process.env.API_HOST ?? "127.0.0.1";
export const NODE_ENV = process.env.NODE_ENV ?? "development";
export const IS_PROD = NODE_ENV === "production";

/** Read at boot from package.json so /health reports something real. */
export const VERSION = (() => {
  try {
    return JSON.parse(readFileSync(join(PKG_ROOT, "package.json"), "utf8")).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

/* CORS. An EXACT origin allow-list, never "*".

   Credentials are cookies here, and `Access-Control-Allow-Origin: *` is not even
   legal alongside `Allow-Credentials: true` — but the failure mode that matters is
   the one where someone "fixes" a CORS error by reflecting the request's Origin
   header, which is functionally the same as "*" and hands any site on the internet
   the ability to make authenticated requests as the logged-in user. */
export const CORS_ORIGINS: string[] = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

/* Cookie domain. Scoped to .tnajem.tn in production so tnajem.tn and
   api.tnajem.tn share the session cookie. Unset in dev, where both are
   localhost and a domain attribute would break it. */
export const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN?.trim() || undefined;

/* ══════════════════════════════════════════════════════════════════════════════
   TRUST PROXY — the single highest-severity setting in the split.

   clientIp() keys the OTP rate limiter: otp:req:ip (10 per 10 min) and
   otp:vfy:ip (30 per 15 min). Once the browser no longer talks to the process
   that throttles it, that key has to survive one extra hop, and there are exactly
   two ways to get it wrong:

     trustProxy: false  → the API sees the WEB SERVER's address for every user.
       All traffic collapses into ONE bucket: one attacker exhausts the limit for
       the entire internet, and every real user's throttle is spent by strangers.

     trustProxy: true   → X-Forwarded-For becomes attacker-controlled. Anyone can
       rotate the header and bypass the per-IP limiter entirely — strictly worse
       than the monolith, where the header could not be forged past the platform.

   So: trust a SPECIFIC address (the web app, or the reverse proxy in front of
   it), never a boolean true. Fastify accepts a string/array of trusted hops.

   This is wired NOW, in Step 3, before any action moves — a half-ported process
   would otherwise put the same user in two different buckets. */
export const TRUST_PROXY: string[] | boolean = (() => {
  const raw = process.env.TRUSTED_PROXIES?.trim();
  if (raw) return raw.split(",").map((s) => s.trim()).filter(Boolean);
  // Dev: the web app runs on loopback, so trust only loopback.
  if (!IS_PROD) return ["127.0.0.1", "::1"];
  /* Production with nothing configured: trust NOTHING. Every request then keys on
     the socket address — one shared bucket, which degrades the limiter but cannot
     be forged. Failing toward "too strict" is the correct direction here. */
  return false;
})();

export function assertBootConfig(): void {
  const missing: string[] = [];
  if (!process.env.DATABASE_URL?.trim()) missing.push("DATABASE_URL");
  if (IS_PROD && !process.env.AUTH_SECRET?.trim()) missing.push("AUTH_SECRET");
  if (IS_PROD && CORS_ORIGINS.length === 0) missing.push("CORS_ORIGINS");
  if (missing.length) {
    console.error(`[tnajem-api] FATAL CONFIG: missing ${missing.join(", ")}. Refusing to start.`);
    process.exit(1);
  }
}
