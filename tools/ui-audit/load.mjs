#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════════
   load.mjs — throughput and latency under concurrency, against a PRODUCTION build.

   The two URLs that matter are the ones PRODUCTION_READINESS.md Stage 7 names:
   the CATALOGUE (/fr/explore) and a STOREFRONT (/fr/<slug>) — the page a tutor
   pastes into a WhatsApp group, where three thousand phones open the same link
   inside a minute. SCALABILITY.md has been carrying modelled numbers ("1-5ms
   point lookups", "well over 1000 queries/sec/worker") since August with nothing
   measured behind them; this is what replaces the arithmetic with observations.

   Run it against `next dev` and the numbers are fiction: dev ships unminified
   bundles, no ISR, and an HMR client. tools/ui-audit/_build.sh + _restart-prod.sh
   put the real thing on :3222, or point UI_AUDIT_BASE at any production build.

   INFORMATIONAL — no exit code, like weight.mjs. There is no pass/fail number to
   assert yet: one developer laptop running the app, Postgres, and the load
   generator at once is not the VPS, and a threshold measured here would be a
   threshold about this machine. Compare runs before and after a change; record
   the numbers in OBSERVABILITY.md.

     node tools/ui-audit/load.mjs                        # both defaults
     node tools/ui-audit/load.mjs /fr/explore            # one path
     LOAD_CONNECTIONS=100 LOAD_DURATION=20 node tools/ui-audit/load.mjs
   ══════════════════════════════════════════════════════════════════════════════ */

import autocannon from "autocannon";

const BASE = process.env.UI_AUDIT_BASE || "http://localhost:3222";

/* GIT BASH EATS ARGUMENTS THAT LOOK LIKE PATHS. MSYS rewrites a leading "/" into
   the Git installation prefix, so `node load.mjs /fr/explore` arrives as
   "C:/Program Files/Git/fr/explore" and the first run of this script failed with
   an unparseable URL rather than a load test. Either prefix the command with
   MSYS_NO_PATHCONV=1, or pass "fr/explore" — both work now. */
const normalise = (p) => {
  const stripped = p.replace(/^[A-Za-z]:[/\\].*?[/\\]Git[/\\]/, "/");
  return stripped.startsWith("/") ? stripped : `/${stripped}`;
};
const PATHS = process.argv.slice(2).length
  ? process.argv.slice(2).map(normalise)
  : ["/fr/explore", "/fr/yassine-math"];
const CONNECTIONS = Number(process.env.LOAD_CONNECTIONS ?? 50);
const DURATION = Number(process.env.LOAD_DURATION ?? 10);

/* A 404 IS FAST. The catch-all 404 page renders in a fraction of the time a real
   storefront takes, so measuring a mistyped slug produces a beautiful number that
   means nothing — and that is exactly the mistake worth guarding against here,
   because the seeded slug differs between databases. Check every path first and
   refuse to report on anything that is not a 200. */
async function assertServes(path) {
  const url = `${BASE}${path}`;
  let res;
  try {
    res = await fetch(url, { redirect: "manual" });
  } catch (e) {
    console.error(`\n  x Cannot reach ${url}\n    ${e.code ?? e.message}`);
    console.error(`    Start a production build first: tools/ui-audit/_build.sh && tools/ui-audit/_restart-prod.sh`);
    console.error(`    (or set UI_AUDIT_BASE to point somewhere else)\n`);
    process.exit(1);
  }
  if (res.status !== 200) {
    console.error(`\n  x ${path} answered ${res.status}, not 200 — refusing to load-test it.`);
    if (res.status === 404) {
      console.error(`    A 404 renders far faster than the real page, so the numbers would flatter the app.`);
      console.error(`    Pass a slug that exists: node tools/ui-audit/load.mjs /fr/<a-verified-tutor>`);
    }
    console.error("");
    process.exit(1);
  }
}

function ms(n) {
  return `${n.toFixed(1)}ms`.padStart(9);
}

async function run(path) {
  const result = await autocannon({
    url: `${BASE}${path}`,
    connections: CONNECTIONS,
    duration: DURATION,
    /* A real visitor's browser sends these, and they change what the server does:
       Next serves a different (smaller, gzipped) response to a client that accepts
       it, and a request without Accept-Encoding measures a path nobody takes. */
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-encoding": "gzip, br",
      "user-agent": "tnajem-load/1 (tools/ui-audit/load.mjs)",
    },
  });

  const nonOk = result.non2xx + result.errors + result.timeouts;
  console.log(`\n  ${path}`);
  console.log(`    req/s        avg ${result.requests.average.toFixed(1)}   min ${result.requests.min}   max ${result.requests.max}`);
  console.log(`    latency      p50 ${ms(result.latency.p50)}   p95 ${ms(result.latency.p97_5)}   p99 ${ms(result.latency.p99)}   max ${ms(result.latency.max)}`);
  console.log(`    throughput   ${(result.throughput.average / 1024).toFixed(0)} kB/s`);
  console.log(`    requests     ${result.requests.total} in ${result.duration}s`);
  /* Any non-2xx at all is the headline, not a footnote: under load this app fails
     by SHEDDING (a pool that runs out of connections answers 500), and a run that
     reports 900 req/s where a tenth of them were errors is a worse result than a
     slower one that served everything. */
  if (nonOk > 0) {
    console.log(`    ⚠ FAILED      ${result.non2xx} non-2xx, ${result.errors} errors, ${result.timeouts} timeouts`);
  } else {
    console.log(`    ✓ every response was 2xx`);
  }
  return { path, result, nonOk };
}

console.log(`\nLoad test — ${BASE}`);
console.log(`  ${CONNECTIONS} connections, ${DURATION}s per path, ${PATHS.length} path(s)`);
console.log(`  Informational: no exit code. The app, Postgres and the load generator share this machine.`);

for (const path of PATHS) await assertServes(path);

const runs = [];
for (const path of PATHS) runs.push(await run(path));

console.log("");
for (const { path, result, nonOk } of runs) {
  console.log(
    `  ${nonOk ? "⚠" : "·"} ${path.padEnd(24)} ${result.requests.average.toFixed(0).padStart(6)} req/s   p95 ${ms(result.latency.p97_5)}`,
  );
}
console.log("");
