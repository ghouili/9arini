#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════════
   a11y.mjs — axe-core over every route, in BOTH locales.

   Runs at 380px (the width most of this audience actually browses at) so the
   mobile layout is what gets tested, not a desktop layout nobody sees. Arabic is
   audited as a first-class pass, not an afterthought — RTL regressions show up
   here as reading-order and label failures.

   Exit code 1 on any serious/critical violation. moderate/minor are printed so
   they are visible, but do not fail the build on their own.
   ══════════════════════════════════════════════════════════════════════════════ */

import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { expand, assertServer, SESSION_COOKIE } from "./routes.mjs";

const BLOCKING = new Set(["serious", "critical"]);

await assertServer();

const targets = expand();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 380, height: 900 } });
await ctx.addCookies([SESSION_COOKIE]);

const byImpact = { critical: [], serious: [], moderate: [], minor: [] };
let blocking = 0;
let scanned = 0;

console.log("\naxe-core accessibility audit — WCAG 2.0/2.1 A + AA, both locales, 380px\n");

for (const r of targets) {
  const label = `/${r.locale}${r.path === "/" ? "" : r.path}`;
  const page = await ctx.newPage();
  try {
    await page.goto(r.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    // Let hydration + entrance animations settle: axe reads computed styles, and
    // a mid-fade element reports a bogus colour-contrast result against whatever
    // is behind it.
    await page.waitForTimeout(1200);

    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    scanned++;
    const hits = violations.filter((v) => v.nodes.length);
    const bad = hits.filter((v) => BLOCKING.has(v.impact));
    blocking += bad.length;

    for (const v of hits) {
      (byImpact[v.impact] ??= []).push({ route: label, v });
    }
    console.log(
      `  ${bad.length ? "FAIL" : "ok  "}  ${label.padEnd(28)} ` +
        `${hits.length ? `${hits.length} violation(s)` : "clean"}`
    );
  } catch (e) {
    blocking++;
    console.log(`  ERR   ${label.padEnd(28)} ${e.message.split("\n")[0]}`);
  }
  await page.close();
}

await browser.close();

for (const impact of ["critical", "serious", "moderate", "minor"]) {
  const rows = byImpact[impact] ?? [];
  if (!rows.length) continue;
  console.log(`\n  ── ${impact.toUpperCase()} ──`);
  // Group identical rules so one shared-component defect reads as one finding
  // with a route list, not as 34 separate ones.
  const byRule = new Map();
  for (const { route, v } of rows) {
    if (!byRule.has(v.id)) byRule.set(v.id, { help: v.help, routes: [], sample: v.nodes[0] });
    byRule.get(v.id).routes.push(route);
  }
  for (const [id, g] of byRule) {
    console.log(`  ${id} — ${g.help}`);
    console.log(`    ${g.routes.length} route(s): ${g.routes.slice(0, 6).join(", ")}${g.routes.length > 6 ? ", …" : ""}`);
    if (g.sample) {
      console.log(`    e.g. ${String(g.sample.html).replace(/\s+/g, " ").slice(0, 130)}`);
      const msg = g.sample.any?.[0]?.message || g.sample.all?.[0]?.message;
      if (msg) console.log(`         ${msg.replace(/\s+/g, " ").slice(0, 130)}`);
    }
  }
}

console.log(`\n  ${scanned}/${targets.length} routes scanned — ${blocking} serious/critical violation(s)\n`);
if (blocking) {
  console.error("  x Accessibility failures at serious/critical impact.\n");
  process.exit(1);
}
console.log("  OK — zero serious/critical axe violations.\n");
