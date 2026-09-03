#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════════
   weight.mjs — what a first-time visitor actually downloads, per route, per
   locale, split by resource type.

   Exists because the two biggest performance claims in this codebase are
   locale-shaped and invisible in a bundle report: a French visitor was
   downloading four weights of IBM Plex Sans Arabic they will never see, and an
   Arabic visitor was downloading five weights of Plus Jakarta Sans plus three of
   Space Grotesk. A bundle analyser shows JS. This shows fonts, which on 3G are
   the bytes that sit in front of first paint.

   Cold cache, one fresh context per route so nothing is reused. Reports every
   font file by name so a regression is attributable, not just a bigger number.

   Informational — no exit code. Compare runs before/after a change.
   ══════════════════════════════════════════════════════════════════════════════ */

import { chromium } from "playwright";
import { expand, assertServer, applySession } from "./routes.mjs";

const KB = (n) => `${(n / 1024).toFixed(1)}kB`;

const kind = (url, type) => {
  if (/\.(woff2?|ttf|otf)(\?|$)/i.test(url) || type === "font") return "font";
  if (/\.css(\?|$)/i.test(url) || type === "stylesheet") return "css";
  if (/\.js(\?|$)/i.test(url) || type === "script") return "js";
  if (type === "image") return "img";
  return "other";
};

await assertServer();

// The public routes a first-time visitor lands on. Logged-in screens are behind
// a session and are not the 3G first-paint problem.
const targets = expand((r) => r.nojs);
const browser = await chromium.launch();

const rows = [];
const fontsSeen = new Map();

for (const r of targets) {
  const ctx = await browser.newContext({ viewport: { width: 380, height: 800 } });
  await applySession(ctx, r);
  const page = await ctx.newPage();

  const totals = { font: 0, js: 0, css: 0, img: 0, other: 0 };
  const fonts = [];

  page.on("response", async (res) => {
    try {
      const url = res.url();
      const k = kind(url, res.request().resourceType());
      const len = Number(res.headers()["content-length"] || 0) || (await res.body().then((b) => b.length).catch(() => 0));
      totals[k] += len;
      if (k === "font") {
        const name = url.split("/").pop().split("?")[0];
        fonts.push(name);
        fontsSeen.set(name, len);
      }
    } catch {
      /* response body already gone (redirect / aborted) — not worth failing on */
    }
  });

  try {
    await page.goto(r.url, { waitUntil: "networkidle", timeout: 40000 });
  } catch {
    /* keep whatever was measured */
  }
  await page.close();
  await ctx.close();

  const label = `/${r.locale}${r.path === "/" ? "" : r.path}`;
  rows.push({ label, ...totals, fontCount: fonts.length, total: Object.values(totals).reduce((a, b) => a + b, 0) });
}

await browser.close();

const w = (s, n) => String(s).padEnd(n);
console.log("\nFirst-visit transfer weight (cold cache, 380px)\n");
console.log("  " + w("ROUTE", 26) + w("FONTS", 10) + w("#", 4) + w("JS", 11) + w("CSS", 10) + w("TOTAL", 10));
console.log("  " + "-".repeat(72));
for (const r of rows) {
  console.log(
    "  " + w(r.label, 26) + w(KB(r.font), 10) + w(r.fontCount, 4) +
    w(KB(r.js), 11) + w(KB(r.css), 10) + w(KB(r.total), 10)
  );
}

const fr = rows.filter((r) => r.label.startsWith("/fr"));
const ar = rows.filter((r) => r.label.startsWith("/ar"));
const avg = (a, k) => a.reduce((s, r) => s + r[k], 0) / (a.length || 1);
console.log("  " + "-".repeat(72));
console.log(`  ${w("avg /fr", 26)}${w(KB(avg(fr, "font")), 10)}${w("", 4)}${w(KB(avg(fr, "js")), 11)}${w(KB(avg(fr, "css")), 10)}${KB(avg(fr, "total"))}`);
console.log(`  ${w("avg /ar", 26)}${w(KB(avg(ar, "font")), 10)}${w("", 4)}${w(KB(avg(ar, "js")), 11)}${w(KB(avg(ar, "css")), 10)}${KB(avg(ar, "total"))}`);

console.log(`\n  ${fontsSeen.size} distinct font file(s) fetched across all routes:`);
for (const [name, len] of [...fontsSeen].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${w(KB(len), 10)}${name}`);
}
console.log();
