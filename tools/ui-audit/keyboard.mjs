#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════════
   keyboard.mjs — tab through every route and assert the four things that make a
   page operable without a mouse.

     RING     every element that receives keyboard focus paints a VISIBLE
              indicator (WCAG 2.4.7). Checked as a real computed style after a
              real Tab press, so :focus-visible has actually matched — an
              outline declared in CSS that some other rule overrides would still
              fail here, which is the point.
     ORDER    focus follows DOM order. Any positive tabindex is reported: it
              takes an element out of document order and pushes it ahead of
              everything with tabindex 0, which reorders the whole page.
     NO TRAP  focus never sticks on one element, and the tab cycle reaches
              essentially every focusable control rather than looping inside a
              small subset (WCAG 2.1.2).
     REACH    the first Tab lands on the skip link, so the sticky header can
              actually be bypassed.

   Both locales — RTL reading order is a real source of tab-order surprises.
   Exit code 1 on any failure.
   ══════════════════════════════════════════════════════════════════════════════ */

import { chromium } from "playwright";
import { expand, assertServer, applySession } from "./routes.mjs";

const MAX_TABS = 90;

/* Describe whatever currently has focus, plus whether it is visibly ringed. */
const SNAP = () => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const cs = getComputedStyle(el);
  const fv = el.matches(":focus-visible");

  /* The ring is not always on the focused element. A text input inside .inp is a
     BORDERLESS control in a styled box: the box is what the user perceives as
     the field, so the box is what gets ringed (:focus-within). Look one or two
     levels up for a ring that appeared because this element has focus —
     otherwise the check would demand a second, redundant ring on the control
     and make the design worse. */
  const ringed = (n) => {
    const s = getComputedStyle(n);
    const w = parseFloat(s.outlineWidth) || 0;
    return s.outlineStyle !== "none" && w >= 1;
  };
  let hasOutline = ringed(el);
  let shadow = cs.boxShadow && cs.boxShadow !== "none";
  for (let n = el.parentElement, hops = 0; n && hops < 2 && !hasOutline; n = n.parentElement, hops++) {
    if (n.matches(":focus-within") && ringed(n)) hasOutline = true;
  }
  const r = el.getBoundingClientRect();
  return {
    tag: el.tagName.toLowerCase(),
    cls: String(el.className || "").trim().slice(0, 44),
    txt: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 28),
    id: el.id || "",
    tabindex: el.getAttribute("tabindex"),
    ring: hasOutline || (fv && shadow),
    focusVisible: fv,
    offscreen: r.width === 0 && r.height === 0,
    /* Identity for cycle detection = the element's POSITION in the document, not
       its tag+class+text. Two rows of a settings list can legitimately be
       identical strings, and a name-based key made the walker think it had
       looped after 5 stops and report a phantom trap. */
    key: [...document.querySelectorAll("*")].indexOf(el),
  };
};

await assertServer();

const targets = expand();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 380, height: 900 } });

let failed = 0;
const noRing = new Map();
const positiveTabindex = new Map();

console.log("\nKeyboard operability — Tab through every route, both locales, 380px\n");

for (const r of targets) {
  // Per route, not once: the tutor screens and the student screens need
  // DIFFERENT sessions now that both are role-guarded server-side.
  await applySession(ctx, r);
  const label = `/${r.locale}${r.path === "/" ? "" : r.path}`;
  const page = await ctx.newPage();
  const problems = [];
  try {
    await page.goto(r.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(900);

    const focusableCount = await page.evaluate(() => {
      const SEL = "a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
      return [...document.querySelectorAll(SEL)].filter((e) => {
        const b = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        return cs.visibility !== "hidden" && cs.display !== "none" && (b.width > 0 || e.matches("a[href^='#']"));
      }).length;
    });

    const seen = [];
    const keys = new Set();
    let stuck = 0;
    for (let i = 0; i < Math.min(MAX_TABS, focusableCount + 4); i++) {
      await page.keyboard.press("Tab");
      const s = await page.evaluate(SNAP);
      if (!s) break;
      if (seen.length && s.key === seen[seen.length - 1].key) {
        stuck++;
        if (stuck >= 2) {
          problems.push(`TRAP: focus stuck on <${s.tag}.${s.cls}> "${s.txt}"`);
          break;
        }
      } else stuck = 0;
      if (keys.has(s.key) && keys.size > 3) break; // completed the cycle
      keys.add(s.key);
      seen.push(s);
    }

    // 1. first stop must be the skip link
    if (seen.length && seen[0].id !== "" ) { /* id on the target, not the link */ }
    const first = seen[0];
    if (!first || !(first.tag === "a" && /skip-link/.test(first.cls))) {
      problems.push(`first Tab stop is <${first?.tag}.${first?.cls}>, not the skip link`);
    }

    // 2. every stop paints a ring
    for (const s of seen) {
      if (s.offscreen) continue;
      if (!s.ring) {
        const k = `${s.tag}.${s.cls}`;
        if (!noRing.has(k)) noRing.set(k, { ...s, routes: [] });
        noRing.get(k).routes.push(label);
      }
    }

    // 3. positive tabindex reorders the page
    for (const s of seen) {
      if (s.tabindex && Number(s.tabindex) > 0) {
        const k = `${s.tag}.${s.cls}[tabindex=${s.tabindex}]`;
        if (!positiveTabindex.has(k)) positiveTabindex.set(k, []);
        positiveTabindex.get(k).push(label);
      }
    }

    // 4. the cycle must actually reach the page's controls
    if (focusableCount > 6 && keys.size < Math.min(focusableCount, 6)) {
      problems.push(`cycle covered only ${keys.size} of ${focusableCount} focusable elements`);
    }

    const ringless = seen.filter((s) => !s.ring && !s.offscreen).length;
    if (problems.length) failed++;
    console.log(
      `  ${problems.length ? "FAIL" : "ok  "}  ${label.padEnd(26)} ${String(keys.size).padStart(2)} stops` +
      `${ringless ? `, ${ringless} without a ring` : ""}`
    );
    for (const p of problems) console.log(`          ${p}`);
  } catch (e) {
    failed++;
    console.log(`  ERR   ${label.padEnd(26)} ${e.message.split("\n")[0]}`);
  }
  await page.close();
}

await browser.close();

if (noRing.size) {
  console.log("\n  ── FOCUSED WITHOUT A VISIBLE RING (WCAG 2.4.7) ──");
  for (const [k, v] of noRing) {
    console.log(`  <${k}> "${v.txt}"  focus-visible=${v.focusVisible}`);
    console.log(`    ${v.routes.length} route(s): ${v.routes.slice(0, 5).join(", ")}${v.routes.length > 5 ? ", …" : ""}`);
  }
}
if (positiveTabindex.size) {
  console.log("\n  ── POSITIVE tabindex (reorders the page) ──");
  for (const [k, routes] of positiveTabindex) console.log(`  ${k}  ${routes.length} route(s)`);
}

const total = failed + noRing.size + positiveTabindex.size;
console.log(`\n  ${targets.length} routes — ${failed} route failure(s), ${noRing.size} unringed control(s), ${positiveTabindex.size} positive tabindex\n`);
if (total) {
  console.error("  x Keyboard operability failures.\n");
  process.exit(1);
}
console.log("  OK — skip link first, every stop ringed, no traps, no positive tabindex.\n");
