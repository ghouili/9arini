/* Run the production server the way `output: "standalone"` requires.

   `next start` DOES NOT WORK with output:"standalone" — it prints "Ready" and
   listens, then never answers a request. Next says so itself in a warning that is
   easy to miss because the server looks healthy.

   The standalone bundle is also incomplete by design: `next build` traces server
   code into .next/standalone but does NOT copy .next/static or public/, so a
   server started from it renders HTML with 404s on every chunk and asset. Copy
   them in first. This is exactly the wiring apps/web's Dockerfile will need in
   Step 5, which is why it lives in a script rather than a shell one-liner. */
import { cp, access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");
await access(join(standalone, "server.js")).catch(() => {
  console.error("No .next/standalone/server.js — run `npm run build` first.");
  process.exit(1);
});

await cp(join(root, ".next", "static"), join(standalone, ".next", "static"), { recursive: true });
await cp(join(root, "public"), join(standalone, "public"), { recursive: true }).catch(() => {});

const port = process.env.PORT || "3000";
console.log(`standalone server on :${port}`);
spawn(process.execPath, [join(standalone, "server.js")], {
  stdio: "inherit",
  env: { ...process.env, PORT: port, HOSTNAME: process.env.HOSTNAME || "127.0.0.1" },
}).on("exit", (c) => process.exit(c ?? 0));
