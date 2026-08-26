#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════════
   lighthouse.mjs — Lighthouse mobile, simulated 3G, against a PRODUCTION build.

   Run it against `next dev` and the numbers are fiction: dev ships unminified
   bundles, no ISR, and a webpack HMR client. `scripts/ui-audit/_build.sh` +
   `_restart-prod.sh` put the real thing on :3222.

   Default target is the tutor storefront — the URL a tutor pastes into WhatsApp,
   and the one that has to be fast on a cheap Android. Pass paths as arguments to
   check others.

   Thresholds: Performance >= 80, Accessibility = 100. Exit 1 if either misses.
   ══════════════════════════════════════════════════════════════════════════════ */

import lighthouse from "lighthouse";
import { chromium } from "playwright";

const BASE = process.env.UI_AUDIT_BASE || "http://localhost:3222";
const PATHS = process.argv.slice(2).length ? process.argv.slice(2) : ["/fr/yassine-math"];
const MIN = { performance: 80, accessibility: 100 };

/* Lighthouse's own "mobile" preset: a 4x-slowed CPU and a simulated ~1.6Mbps /
   150ms RTT link — its stand-in for a mid-range Android on 3G, which is the
   stated target condition for this product. */
const CONFIG = {
  extends: "lighthouse:default",
  settings: {
    formFactor: "mobile",
    screenEmulation: { mobile: true, width: 380, height: 800, deviceScaleFactor: 2, disabled: false },
    throttlingMethod: "simulate",
    throttling: { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4, requestLatencyMs: 562.5, downloadThroughputKbps: 1474.5, uploadThroughputKbps: 675 },
    onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
  },
};

const browser = await chromium.launch({ args: ["--remote-debugging-port=9222"] });
const port = 9222;

let failed = 0;
const pct = (c) => Math.round((c?.score ?? 0) * 100);

console.log(`\nLighthouse — mobile, simulated 3G, production build at ${BASE}\n`);

for (const path of PATHS) {
  const url = `${BASE}${path}`;
  const runner = await lighthouse(url, { port, output: "json", logLevel: "error" }, CONFIG);
  const cats = runner.lhr.categories;

  const perf = pct(cats.performance);
  const a11y = pct(cats.accessibility);
  const bp = pct(cats["best-practices"]);
  const seo = pct(cats.seo);

  const bad = [];
  if (perf < MIN.performance) bad.push(`performance ${perf} < ${MIN.performance}`);
  if (a11y < MIN.accessibility) bad.push(`accessibility ${a11y} < ${MIN.accessibility}`);
  if (bad.length) failed++;

  console.log(`  ${bad.length ? "FAIL" : "ok  "}  ${path}`);
  console.log(`        performance ${perf}   accessibility ${a11y}   best-practices ${bp}   seo ${seo}`);

  const a = runner.lhr.audits;
  const ms = (k) => a[k]?.displayValue || "-";
  console.log(`        FCP ${ms("first-contentful-paint")}  LCP ${ms("largest-contentful-paint")}  TBT ${ms("total-blocking-time")}  CLS ${ms("cumulative-layout-shift")}  SI ${ms("speed-index")}`);

  // Anything the score actually lost points to, worst first.
  const misses = Object.values(a)
    .filter((x) => x.score !== null && x.score < 1 && x.scoreDisplayMode !== "informative" && x.scoreDisplayMode !== "notApplicable")
    .filter((x) => (cats.performance.auditRefs.concat(cats.accessibility.auditRefs)).some((r) => r.id === x.id && r.weight > 0))
    .sort((x, y) => x.score - y.score)
    .slice(0, 8);
  for (const m of misses) {
    console.log(`          - ${m.id} (${Math.round(m.score * 100)}) ${m.title}${m.displayValue ? " — " + m.displayValue : ""}`);
  }
  if (bad.length) console.log(`        MISSED: ${bad.join("; ")}`);
}

await browser.close();

console.log(`\n  ${PATHS.length} page(s) — ${failed} below threshold\n`);
if (failed) process.exit(1);
console.log(`  OK — performance >= ${MIN.performance}, accessibility = ${MIN.accessibility}.\n`);
