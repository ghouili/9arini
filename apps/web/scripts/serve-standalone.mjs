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

const appRoot = dirname(dirname(fileURLToPath(import.meta.url))); // apps/web
const standalone = join(appRoot, ".next", "standalone");

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
spawn(process.execPath, [join(serverDir, "server.js")], {
  stdio: "inherit",
  env: { ...process.env, PORT: port, HOSTNAME: process.env.HOSTNAME || "127.0.0.1" },
}).on("exit", (c) => process.exit(c ?? 0));
