#!/usr/bin/env node
/* geom.mjs — dump the box of every element on a route, as JSON, so two runs can
   be compared to find EXACTLY which element moved. A pixel diff says "this file
   changed"; this says "this <span> is 12px taller". Dev helper for verifying a
   refactor is visually inert. */
import { chromium } from "playwright";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { expand, assertServer, SESSION_COOKIE } from "./routes.mjs";

const out = process.argv[2];
const cmp = process.argv[3];
const WIDTH = 380;

await assertServer();
const targets = expand((r) => true);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 900 }, reducedMotion: "reduce" });
await ctx.addCookies([SESSION_COOKIE]);

const snap = {};
for (const r of targets) {
  const key = `${r.name}-${r.locale}`;
  const page = await ctx.newPage();
  try {
    await page.goto(r.url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(400);
    snap[key] = await page.evaluate(() => {
      const rows = [];
      let i = 0;
      for (const el of document.querySelectorAll("body *")) {
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        rows.push([
          i++,
          el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : ""),
          Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height),
          cs.fontSize, cs.fontWeight, cs.color, cs.backgroundColor, cs.padding, cs.margin, cs.display,
        ]);
      }
      return rows;
    });
  } catch (e) { snap[key] = [["ERR", e.message]]; }
  await page.close();
}
await browser.close();

if (out) writeFileSync(out, JSON.stringify(snap));
if (cmp && existsSync(cmp)) {
  const before = JSON.parse(readFileSync(cmp, "utf8"));
  let diffs = 0;
  for (const key of Object.keys(snap)) {
    const a = before[key] || [];
    const b = snap[key];
    if (a.length !== b.length) { console.log(`  ${key}: element count ${a.length} -> ${b.length}`); diffs++; continue; }
    let shown = 0;
    for (let i = 0; i < b.length; i++) {
      /* Compare GEOMETRY and computed style only — index 1 is the element's
         class list, which is exactly what a Tailwind conversion is supposed to
         change. Including it would drown the signal in the intended edit. */
      const strip = (row) => row.filter((_, k) => k !== 1);
      const x = JSON.stringify(strip(a[i]));
      const y = JSON.stringify(strip(b[i]));
      if (x !== y && shown < 40) {
        console.log(`  ${key}[${i}] ${b[i][1]}`);
        console.log(`      before ${x}`);
        console.log(`      after  ${y}`);
        shown++; diffs++;
      }
    }
  }
  console.log(`\n  ${diffs} geometry difference(s)\n`);
  process.exit(diffs ? 1 : 0);
}
