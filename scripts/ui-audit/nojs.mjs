#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════════
   nojs.mjs — every public route must render its h1, its sub-headline and its
   primary CTA with JavaScript DISABLED.

   Why this exists: a reveal-on-scroll animation that ships `opacity:0` in the SSR
   HTML and only adds `is-in` from a useEffect leaves a BLANK hero for the whole
   JS download+parse window — and a permanently blank page if the bundle fails.
   On a 3-year-old Android over 3G in Tunisia that is the common case, not the
   edge case. Same for a Suspense fallback that never resolves without the
   client runtime.

   "Visible" here is stricter than Playwright's own :visible — an element with
   opacity:0 is still "visible" to Playwright. We assert layout AND computed
   opacity AND visibility, walking up the ancestor chain (an opacity:0 PARENT
   hides a child that is itself opacity:1).

   Exit code 1 on any failure.
   ══════════════════════════════════════════════════════════════════════════════ */

import { chromium } from "playwright";
import { expand, assertServer, SESSION_COOKIE } from "./routes.mjs";

/* Runs in the page. A selector may legitimately match several elements — the
   storefront ships BOTH a desktop CTA and a sticky mobile one, and only one of
   them is laid out at any width. So: pass if ANY match is genuinely visible, and
   report the closest miss otherwise. */
const PROBE = (sel) => {
  const els = [...document.querySelectorAll(sel)];
  if (!els.length) return { visible: false, why: "not in the DOM" };
  let why = "";
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) { why ||= "zero-size box"; continue; }
    let hidden = "";
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      const tag = `<${n.tagName.toLowerCase()}${n.className ? "." + String(n.className).trim().split(/\s+/).join(".") : ""}>`;
      if (cs.display === "none") { hidden = `display:none on ${tag}`; break; }
      if (cs.visibility === "hidden") { hidden = `visibility:hidden on ${tag}`; break; }
      if (Number(cs.opacity) < 0.99) { hidden = `opacity:${cs.opacity} on ${tag}`; break; }
      if (n.hasAttribute("hidden")) { hidden = `[hidden] on ${tag}`; break; }
    }
    if (!hidden) return { visible: true, text: (el.textContent || "").trim().slice(0, 48) };
    why ||= hidden;
  }
  return { visible: false, why };
};

await assertServer();

const targets = expand((r) => r.nojs);
const browser = await chromium.launch();
const ctx = await browser.newContext({
  javaScriptEnabled: false,
  viewport: { width: 380, height: 800 },
});
await ctx.addCookies([SESSION_COOKIE]);

let failed = 0;
let checks = 0;

console.log("\nNo-JavaScript render audit — public routes must be readable with the bundle off\n");

for (const r of targets) {
  const page = await ctx.newPage();
  const label = `${r.locale}${r.path === "/" ? "" : r.path}`;
  const problems = [];
  try {
    // `domcontentloaded`, not `load`: with JS off there is nothing to hydrate,
    // and a page that streams a never-resolving Suspense boundary hangs on `load`.
    await page.goto(r.url, { waitUntil: "domcontentloaded", timeout: 20000 });
    // Let pure-CSS entrance animations finish. `.rise` is a 400ms keyframe fade
    // that completes with the bundle off; `.lpp-reveal` needs JS to ever reach
    // opacity:1. Waiting is what tells those two apart honestly.
    await page.waitForTimeout(900);
    for (const [role, sel] of [["h1", r.h1], ["sub", r.sub], ["cta", r.cta]]) {
      if (!sel) continue;
      checks++;
      const res = await page.evaluate(PROBE, sel);
      if (!res.visible) problems.push(`${role} (${sel}) — ${res.why}`);
    }
  } catch (e) {
    problems.push(`navigation: ${e.message.split("\n")[0]}`);
  }
  await page.close();

  if (problems.length) {
    failed++;
    console.log(`  FAIL  /${label}`);
    for (const p of problems) console.log(`          ${p}`);
  } else {
    console.log(`  ok    /${label}`);
  }
}

await browser.close();

console.log(`\n  ${targets.length} routes, ${checks} assertions — ${failed} route(s) failed\n`);
if (failed) {
  console.error("  x Some public routes are blank or incomplete without JavaScript.\n");
  process.exit(1);
}
console.log("  OK — every public route renders h1 + sub + CTA with JS disabled.\n");
