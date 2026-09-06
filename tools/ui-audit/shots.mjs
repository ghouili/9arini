#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════════
   shots.mjs — full-page screenshots of every route × every locale × 4 widths,
   plus the geometric checks that are objective enough to automate.

   320 / 380 / 768 / 1280. 320px is not a rounding-down of 360 — it is the real
   floor (a 360px Android in Arabic with a large system font effectively renders
   narrower), and it is where flex/grid overflow actually shows up.

   Two things get measured while we are already on the page, because "I looked at
   the screenshot and it seemed fine" is not a result:

     OVERFLOW  document.scrollWidth must not exceed the viewport. Horizontal page
               scroll on a phone is the single most common responsive defect and
               it is invisible in a full-page screenshot (the shot just gets
               wider). Reported with the widest offending element so it is
               actionable.
     CLIPPING  text whose scrollWidth exceeds its clientWidth while overflow is
               hidden and no ellipsis/line-clamp is in play — i.e. a string
               silently cut off mid-word rather than deliberately truncated.

   Screenshots land in tools/ui-audit/shots/ and are meant to be READ, not just
   generated. Pass --only=<substr> to re-shoot one route while iterating.

   Exit code 1 if any route overflows its viewport.
   ══════════════════════════════════════════════════════════════════════════════ */

import { chromium } from "playwright";
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { expand, assertServer, applySession, WIDTHS } from "./routes.mjs";
import { ROOT } from "./lib-color.mjs";

/* --out=<dir> writes somewhere other than shots/, so a BASELINE can be captured
   before a refactor and compared against afterwards with diff.mjs. That is what
   makes "this change is visually neutral" a measurement instead of a claim. */
const outArg = process.argv.find((a) => a.startsWith("--out="))?.slice(6);
const OUT = resolve(ROOT, "tools/ui-audit", outArg || "shots");
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
const keep = process.argv.includes("--keep");

/* Runs in the page. Deliberately conservative: only report a clip when the
   element has no ellipsis and no line-clamp, so intentional truncation
   (.appbar h1, .sf-subject) does not drown out the real defects. */
const MEASURE = () => {
  const de = document.documentElement;
  const vw = de.clientWidth;

  const overflow = [];
  if (de.scrollWidth > vw + 1) {
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const right = r.right;
      const left = r.left;
      if (right > vw + 1 || left < -1) {
        const cs = getComputedStyle(el);
        if (cs.position === "fixed") continue;
        overflow.push({
          tag: el.tagName.toLowerCase(),
          cls: String(el.className || "").trim().slice(0, 60),
          left: Math.round(left),
          right: Math.round(right),
          w: Math.round(r.width),
        });
      }
    }
  }

  const clipped = [];
  for (const el of document.querySelectorAll("h1,h2,h3,h4,p,span,a,button,div,li,label")) {
    if (!el.childNodes.length) continue;
    const text = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(" ")
      .trim();
    if (text.length < 4) continue;
    const cs = getComputedStyle(el);
    // Visually-hidden-until-focus controls (the skip link) are clipped BY DESIGN
    // and always report scrollWidth > clientWidth. Not a defect.
    if (cs.clipPath && cs.clipPath !== "none") continue;
    if (cs.textOverflow === "ellipsis") continue;
    if (cs.webkitLineClamp && cs.webkitLineClamp !== "none") continue;
    if (cs.overflowX !== "hidden" && cs.overflowY !== "hidden" && cs.overflow !== "hidden") continue;
    if (el.scrollWidth > el.clientWidth + 1) {
      clipped.push({ cls: String(el.className || "").trim().slice(0, 50), text: text.slice(0, 40), by: el.scrollWidth - el.clientWidth });
    }
  }

  return {
    scrollWidth: de.scrollWidth,
    vw,
    overflow: overflow.slice(0, 4),
    overflowCount: overflow.length,
    clipped: clipped.slice(0, 4),
  };
};

await assertServer();

if (!keep) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let targets = expand();
if (only) targets = targets.filter((r) => `${r.locale}${r.path}`.includes(only));

const browser = await chromium.launch();
let shots = 0;
let overflows = 0;
let clips = 0;

console.log(`\nScreenshots + layout measurements — ${targets.length} route/locale pairs × ${WIDTHS.length} widths\n`);

for (const width of WIDTHS) {
  const ctx = await browser.newContext({
    viewport: { width, height: 900 },
    deviceScaleFactor: 1,
    // Motion off: entrance animations make screenshots non-deterministic, and a
    // mid-fade element also poisons the geometric measurements above.
    reducedMotion: "reduce",
  });

  for (const r of targets) {
  // Per route, not once: the tutor screens and the student screens need
  // DIFFERENT sessions now that both are role-guarded server-side.
    await applySession(ctx, r);
    const page = await ctx.newPage();
    const name = `${r.name}-${r.locale}-${width}`;
    try {
      await page.goto(r.url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(400);
      await page.screenshot({ path: resolve(OUT, `${name}.png`), fullPage: true });
      shots++;

      const m = await page.evaluate(MEASURE);
      const flags = [];
      if (m.scrollWidth > m.vw + 1) {
        overflows++;
        flags.push(`OVERFLOW ${m.scrollWidth}>${m.vw} (${m.overflowCount} el)`);
        for (const o of m.overflow) flags.push(`    <${o.tag}.${o.cls}> l=${o.left} r=${o.right} w=${o.w}`);
      }
      if (m.clipped.length) {
        clips += m.clipped.length;
        for (const c of m.clipped) flags.push(`    CLIP .${c.cls} "${c.text}" (+${c.by}px)`);
      }
      if (flags.length) {
        console.log(`  !!  ${name}`);
        for (const f of flags) console.log(`      ${f}`);
      }
    } catch (e) {
      console.log(`  ERR ${name} — ${e.message.split("\n")[0]}`);
    }
    await page.close();
  }
  await ctx.close();
  console.log(`  ${width}px done`);
}

await browser.close();

console.log(`\n  ${shots} screenshots -> tools/ui-audit/shots/`);
console.log(`  ${overflows} viewport overflow(s), ${clips} clipped text run(s)\n`);
if (overflows) {
  console.error("  x Horizontal overflow detected — the page scrolls sideways on a phone.\n");
  process.exit(1);
}
console.log("  OK — no route overflows its viewport at any width.\n");
