import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

/* phase-a/verify-fix (D8). §2 must-not-break: "three independent locks keep demo
   data out of production". Only one was exercised — `npm run verify` guardrail 6
   (the production build swaps lib/demo-fixtures.ts for an empty stub). These prove
   the other two, each on its own:

     • the START lock — apps/web/scripts/preflight.mjs refuses to start a production
       web process with TNAJEM_DEMO=1, or with no API_URL;
     • the RUNTIME gate — lib/demo.ts `demoEnabled` is false under NODE_ENV=production
       even if the demo switch is on, so every fixture export is inert.

   Child processes, so each case gets exactly the environment it names (the parent's
   .env is irrelevant: a production preflight never reads it). */

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const PREFLIGHT = fileURLToPath(new URL("../../web/scripts/preflight.mjs", import.meta.url));
const DEMO = fileURLToPath(new URL("../../web/lib/demo.ts", import.meta.url));

function preflightStart(env: Record<string, string>) {
  const base = { PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "", NODE_ENV: "production", HOSTNAME: "localhost" };
  return spawnSync(process.execPath, [PREFLIGHT, "start"], { env: { ...base, ...env }, encoding: "utf8", cwd: REPO });
}

describe("§2 — demo data cannot reach production (start lock + runtime gate)", () => {
  test("preflight refuses a production start with TNAJEM_DEMO=1, even with an API", () => {
    const r = preflightStart({ TNAJEM_DEMO: "1", API_URL: "http://127.0.0.1:4000" });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /TNAJEM_DEMO=1 is set in production/);
  });

  test("preflight refuses a production start with no API_URL (no fallback to fixtures)", () => {
    const r = preflightStart({});
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /API_URL is missing/);
  });

  test("control: a correct production environment starts", () => {
    const r = preflightStart({ API_URL: "http://127.0.0.1:4000" });
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });

  test("demoEnabled is false under NODE_ENV=production even with the demo switch on", () => {
    const demoUrl = pathToFileURL(DEMO).href;
    const probe = "import(" + JSON.stringify(demoUrl) + ").then((ns) => { const m = ns.demoClasses ? ns : ns.default; console.log(JSON.stringify({ on: m.demoEnabled, classes: m.demoClasses().length })); })";
    const run = (env: Record<string, string>) =>
      spawnSync(process.execPath, ["--import", "tsx", "-e", probe], {
        env: { PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "", ...env },
        encoding: "utf8",
        cwd: REPO,
      });
    const prod = run({ NODE_ENV: "production", TNAJEM_DEMO_ACTIVE: "1" });
    assert.equal(prod.status, 0, prod.stderr);
    assert.deepEqual(JSON.parse(prod.stdout.trim()), { on: false, classes: 0 });
    // Control: the same probe in development with the switch on does see the fixtures,
    // so a false above is the gate working, not a probe that cannot see anything.
    const dev = run({ NODE_ENV: "development", TNAJEM_DEMO_ACTIVE: "1" });
    assert.equal(dev.status, 0, dev.stderr);
    const seen = JSON.parse(dev.stdout.trim());
    assert.equal(seen.on, true);
    assert.ok(seen.classes > 0);
  });
});
