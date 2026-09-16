/* Run the production server the way `output: "standalone"` requires.

   `next start` DOES NOT WORK with output:"standalone" -- it prints "Ready",
   listens, and then never answers a request. Next says so in a warning that is
   easy to miss because the server looks healthy.

   The standalone bundle is also incomplete by design: `next build` traces server
   code into .next/standalone but does NOT copy .next/static or public/, so a
   server started from it renders HTML with 404s on every chunk and asset.

   MONOREPO: with experimental.outputFileTracingRoot pointed at the repo root, the
   entry point is .next/standalone/<relative path of this app>/server.js -- i.e.
   .next/standalone/apps/web/server.js -- and node_modules lands beside it at
   .next/standalone/node_modules. Every Dockerfile snippet on the internet assumes
   the flat .next/standalone/server.js, which is the usual cause of
   "Cannot find module '/app/server.js'". So locate server.js rather than assume
   it, and copy static/public next to the file we actually found.

   This is the wiring apps/web's Dockerfile needs in Step 5. */
import { cp, access, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { preflight } from "./preflight.mjs";

const appRoot = dirname(dirname(fileURLToPath(import.meta.url))); // apps/web
const standalone = join(appRoot, ".next", "standalone");

/* This is the LOCAL production runner (Docker runs preflight + server.js
   directly), so read the repo-root .env like every other process here — a plain
   `npm run start:standalone` would otherwise have no API_URL and be refused.
   Values already in the environment win, which is how the Playwright config pins
   its own. */
try {
  const { config } = await import("dotenv");
  config({ path: join(appRoot, "../..", ".env.local") });
  config({ path: join(appRoot, "../..", ".env") });
} catch {
  /* no dotenv — rely on the real environment */
}
await preflight("start");

/** Depth-first hunt for the traced server.js (flat or nested). */
async function findServer(dir, depth = 0) {
  if (depth > 4) return null;
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return null; }
  if (entries.some((e) => e.isFile() && e.name === "server.js")) return dir;
  for (const e of entries) {
    if (e.isDirectory() && e.name !== "node_modules") {
      const hit = await findServer(join(dir, e.name), depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

await access(standalone).catch(() => {
  console.error("No .next/standalone — run `npm run build` first.");
  process.exit(1);
});

const serverDir = await findServer(standalone);
if (!serverDir) {
  console.error("No server.js under .next/standalone — the build did not emit a standalone bundle.");
  process.exit(1);
}

await cp(join(appRoot, ".next", "static"), join(serverDir, ".next", "static"), { recursive: true });
await cp(join(appRoot, "public"), join(serverDir, "public"), { recursive: true }).catch(() => {});

const port = process.env.PORT || "3000";
console.log(`standalone server on :${port}  (entry: ${join(serverDir, "server.js")})`);
/* "localhost", NOT "127.0.0.1" — still loopback-only, but the literal breaks every
   middleware rewrite. Next's server builds its own origin from HOSTNAME
   (http://127.0.0.1:3000) while NextURL, inside middleware, rewrites any 127.x
   host to "localhost" — so a rewrite never looks same-origin and Next PROXIES it
   to itself. Behind nginx (X-Forwarded-Proto: https) that proxy speaks TLS to a
   plain-HTTP port: on 15 Sept `GET /` — the site root, rewritten to /fr —
   answered 500 with "EPROTO wrong version number", and every 404 rewrite looped
   until the headers overflowed. preflight.mjs refuses a loopback literal. */
const child = spawn(process.execPath, [join(serverDir, "server.js")], {
  stdio: "inherit",
  env: { ...process.env, PORT: port, HOSTNAME: process.env.HOSTNAME || "localhost" },
});

/* FORWARD SIGNALS. This process is a supervisor, not the server: killing it does
   NOT kill the child, and the child is the one holding the port. pm2 reload sends
   SIGINT to the pm2-managed process (us) and SIGKILLs it after kill_timeout, so
   without this the old Next server keeps :3000 and the replacement dies with
   EADDRINUSE -- a deploy that reports success and serves the previous build. The
   systemd units in DEPLOY.md have the same shape. Exit only when the child does. */
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
