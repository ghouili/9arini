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

/* -- manual rules axe's WCAG tags do not cover --------------------------------
   Runs in the page. Three real obligations axe-core will not flag under
   wcag2a / wcag2aa / wcag21a / wcag21aa:

     SKIP LINK   2.4.1 Bypass Blocks. Every page here has a sticky header with
                 nav, so a keyboard or screen-reader user tabs through it on
                 every single route. axe cannot know whether a bypass mechanism
                 exists, so it never reports its absence.
     TARGET SIZE 2.5.8 asks for 24px; this is a phone product and the design
                 system already claims 44px in .btn / .iconbtn / .side-nav, so a
                 40px control is a miss against the system's own rule.
     TEXT FLOOR  Not a WCAG number, a legibility one: 11.5-12.5px body copy is
                 not readable in daylight on a cheap LCD, which is the stated
                 target condition. Floor is 13px.

   All measured on the RENDERED page, so a clamp() or an RTL override is
   accounted for rather than guessed at from the source. */
const MANUAL = (opts) => {
  const out = { skip: null, small: [], tiny: [] };

  const first = document.querySelector("a[href^='#']");
  const main = document.querySelector("main");
  if (!first) {
    out.skip = "no in-page anchor link exists at all";
  } else {
    const id = first.getAttribute("href").slice(1);
    const target = id && document.getElementById(id);
    if (!target) out.skip = "first anchor points at #" + id + ", which does not exist";
    else if (main && target !== main && !main.contains(target) && !target.contains(main))
      out.skip = "first anchor (#" + id + ") does not lead to <main>";
  }

  const SEL = "a[href], button, [role='button'], input:not([type='hidden']), select, textarea, [tabindex]:not([tabindex='-1'])";
  const clipped = (cs) => cs.clipPath && cs.clipPath !== "none";
  for (const el of document.querySelectorAll(SEL)) {
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;

    /* The box that actually receives the tap is not always the control's own.
       Two legitimate patterns would otherwise read as false failures:

         • a control wrapped in a <label> (the file inputs behind each dropzone
           on /onboarding/verify) — the LABEL is the hit area, the input is a
           1x1 visually-hidden implementation detail;
         • visually-hidden-until-focused (the skip link) — it is 1x1 at rest by
           design, so measure it FOCUSED, which is the only state it is
           operable in.

       Measuring the wrong box here would push someone to "fix" a control that
       is already fine, so resolve the real target first. */
    let box = el;
    const lab = el.closest("label");
    if (lab && lab !== el && lab.contains(el)) box = lab;

    let r = box.getBoundingClientRect();
    if (clipped(cs) && r.width <= 2 && r.height <= 2) {
      el.focus();
      r = el.getBoundingClientRect();
      el.blur();
    }
    if (r.width === 0 || r.height === 0) continue;

    // Inline links inside running text are explicitly exempt: their box is
    // dictated by the surrounding prose, not by the control.
    if (cs.display.startsWith("inline") && el.closest("p, li, .web-lead, .metaline, .help")) continue;

    if (r.height < opts.target - 0.5 || r.width < opts.target - 0.5) {
      out.small.push({
        tag: el.tagName.toLowerCase(),
        cls: String(box.className || el.className || "").trim().slice(0, 48),
        txt: (el.textContent || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "").trim().slice(0, 24),
        w: Math.round(r.width),
        h: Math.round(r.height),
      });
    }
  }

  const seen = new Set();
  for (const el of document.querySelectorAll("body *")) {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim().length > 2);
    if (!own.length) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const px = parseFloat(cs.fontSize);
    if (px && px < opts.minFont - 0.01) {
      const key = String(el.className) + "|" + Math.round(px * 10);
      if (seen.has(key)) continue;
      seen.add(key);
      out.tiny.push({
        px: +px.toFixed(1),
        cls: String(el.className || "").trim().slice(0, 48),
        txt: own.map((n) => n.textContent.trim()).join(" ").slice(0, 28),
      });
    }
  }
  return out;
};

const TARGET_MIN = 44;   // px - the design system's own claim (.btn, .iconbtn, .side-nav)
const FONT_MIN = 13;     // px - daylight legibility floor

await assertServer();

const targets = expand();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 380, height: 900 } });
await ctx.addCookies([SESSION_COOKIE]);

const byImpact = { critical: [], serious: [], moderate: [], minor: [] };
const manual = { skip: [], small: new Map(), tiny: new Map() };
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
      /* best-practice is included so heading-order / region / landmark rules
         are VISIBLE. They are reported at moderate impact and do not fail the
         build on their own — only serious/critical do. */
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();

    const m = await page.evaluate(MANUAL, { target: TARGET_MIN, minFont: FONT_MIN });
    if (m.skip) manual.skip.push(label + ": " + m.skip);
    for (const t of m.small) {
      const k = t.tag + "." + t.cls;
      if (!manual.small.has(k)) manual.small.set(k, Object.assign({}, t, { routes: [] }));
      manual.small.get(k).routes.push(label);
    }
    for (const t of m.tiny) {
      const k = t.px + "px ." + t.cls;
      if (!manual.tiny.has(k)) manual.tiny.set(k, Object.assign({}, t, { routes: [] }));
      manual.tiny.get(k).routes.push(label);
    }

    scanned++;
    const hits = violations.filter((v) => v.nodes.length);
    const bad = hits.filter((v) => BLOCKING.has(v.impact));
    blocking += bad.length;

    for (const v of hits) {
      (byImpact[v.impact] ??= []).push({ route: label, v });
    }
    const extra = [];
    if (m.skip) extra.push("no skip-link");
    if (m.small.length) extra.push(m.small.length + " target<" + TARGET_MIN + "px");
    if (m.tiny.length) extra.push(m.tiny.length + " text<" + FONT_MIN + "px");
    const parts = [hits.length ? hits.length + " axe" : null].concat(extra).filter(Boolean);
    console.log(
      "  " + (bad.length || extra.length ? "FAIL" : "ok  ") + "  " + label.padEnd(28) + " " +
      (parts.length ? parts.join(", ") : "clean")
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

/* -- manual-rule report --------------------------------------------------- */
let manualFails = 0;

if (manual.skip.length) {
  manualFails += manual.skip.length;
  console.log("\n  -- SKIP LINK (WCAG 2.4.1 Bypass Blocks) --");
  console.log("  " + manual.skip.length + " route(s) with no working skip-to-content link");
  console.log("    e.g. " + manual.skip.slice(0, 3).join(" | "));
}

if (manual.small.size) {
  manualFails += manual.small.size;
  console.log("\n  -- TOUCH TARGETS < " + TARGET_MIN + "px --");
  for (const [k, v] of manual.small) {
    console.log("  " + v.w + "x" + v.h + "  <" + k + "> \"" + v.txt + "\"");
    console.log("    " + v.routes.length + " route(s): " + v.routes.slice(0, 5).join(", ") + (v.routes.length > 5 ? ", ..." : ""));
  }
}

if (manual.tiny.size) {
  manualFails += manual.tiny.size;
  console.log("\n  -- TEXT BELOW " + FONT_MIN + "px --");
  for (const [k, v] of manual.tiny) {
    console.log("  " + k + "  \"" + v.txt + "\"");
    console.log("    " + v.routes.length + " route(s): " + v.routes.slice(0, 5).join(", ") + (v.routes.length > 5 ? ", ..." : ""));
  }
}

console.log("\n  " + scanned + "/" + targets.length + " routes scanned - " + blocking + " serious/critical axe, " + manualFails + " manual-rule failure(s)\n");
if (blocking || manualFails) {
  console.error("  x Accessibility failures.\n");
  process.exit(1);
}
console.log("  OK - zero serious/critical axe violations, skip link present, all targets >= 44px, no text under 13px.\n");
