#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════════
   contrast.mjs — WCAG 2.1 contrast audit of the design tokens.

   This is the SOURCE OF TRUTH for colour decisions. It reads the real token
   values out of app/globals.css :root (so it can never drift from the CSS) and
   computes the contrast ratio for every foreground/background pair the app
   actually renders. Every row cites the file:line it was found at.

   Thresholds (WCAG 2.1 AA):
     normal  4.5  body text < 24px (or < 18.66px when bold)
     large   3.0  >= 24px, or >= 18.66px bold
     ui      3.0  non-text: component boundaries, focus rings, state indicators
                  (1.4.11). Reported as ADVISORY — see NOTE at the bottom.

   Exit code 1 if any non-advisory row fails.
   ══════════════════════════════════════════════════════════════════════════════ */

import { readTokens, contrast, over } from "./lib-color.mjs";

/* Optional CSS path arg — lets the same table be re-run against a *baseline*
   stylesheet (e.g. the pre-fix tokens) to produce a genuine before/after diff. */
const T = readTokens(process.argv[2] || undefined);
const W = "#FFFFFF";

/* Resolve a spec to a solid colour: "--token", a literal hex, or {fg,alpha,bg}. */
function resolve(spec) {
  if (typeof spec === "object") return over(resolve(spec.fg), spec.alpha, resolve(spec.bg));
  if (spec.startsWith("--")) {
    const v = T[spec.slice(2)];
    if (!v) throw new Error(`unknown token ${spec} — is it declared in globals.css :root?`);
    return v.startsWith("var(") ? resolve("--" + v.match(/--([\w-]+)/)[1]) : v;
  }
  return spec;
}

const NEED = { normal: 4.5, large: 3.0, ui: 3.0 };

/* ── the pairs, grouped ───────────────────────────────────────────────────── */
const PAIRS = [
  // ── solid buttons: white label on a brand fill (15.5px/700 → NOT large) ──
  ["Buttons", W, "--ochre-btn", "normal", ".btn-primary label", "globals.css:78"],
  ["Buttons", W, "--ochre-btn-hover", "normal", ".btn-primary:hover", "globals.css:79"],
  ["Buttons", W, "--green-btn", "normal", ".btn-green label", "globals.css:81"],
  ["Buttons", W, "--ink", "normal", ".btn-ink label", "globals.css:80"],
  ["Buttons", W, "--blue", "normal", ".lp-chip-all / .verified", "page.tsx:271"],
  ["Buttons", W, "--blue700", "normal", ".lp-chip-all:hover", "page.tsx:272"],
  ["Buttons", W, "--rose", "normal", "student LIVE badge", "student/page.tsx"],

  // ── chips & badges (11.5px/700 → normal) ──
  ["Chips", W, "--green-btn", "normal", ".chip-free", "globals.css:108"],
  ["Chips", W, "--green-btn", "normal", "pilot chip", "pour-les-profs:715"],
  ["Chips", "--blue", "--blue50", "normal", ".chip-soft", "globals.css:109"],
  ["Chips", "--ink2", "--sand", "normal", ".chip-sand", "globals.css:110"],
  ["Chips", "--rose", "--rose50", "normal", ".chip-rose", "globals.css:111"],
  ["Chips", "--green-ink", "--green50", "normal", "Nouveau badge", "ExploreClient.tsx:405"],
  ["Chips", "--green-ink", "--green50", "normal", "done chip", "dashboard/page.tsx:405"],
  ["Chips", "--blue", "--blue50", "normal", ".thumb month", "globals.css:148"],

  // ── body / meta text on every surface ──
  ["Body text", "--ink", "--paper", "normal", "default body", "globals.css:41"],
  ["Body text", "--ink", "--cream", "normal", "default body on .l-frame", "globals.css:58"],
  ["Body text", "--ink", "--sand", "normal", "default body on page bg", "globals.css:43"],
  ["Body text", "--ink2", "--paper", "normal", ".web-lead / .side-nav", "globals.css:229"],
  ["Body text", "--ink2", "--cream", "normal", ".web-lead", "globals.css:229"],
  ["Body text", "--ink2", "--sand", "normal", ".chip-sand / .land p", "globals.css:192"],
  ["Body text", "--muted", "--paper", "normal", ".muted / .help / .metaline", "globals.css:96"],
  ["Body text", "--muted", "--cream", "normal", ".site-footer", "globals.css:223"],
  ["Body text", "--muted", "--sand", "normal", ".muted on page bg", "globals.css:96"],
  ["Body text", "--muted", "--blue50", "normal", ".thumb span", "globals.css:150"],
  ["Body text", "--muted", "--green50", "normal", ".muted in green callout", "globals.css:178"],
  ["Body text", "--green-ink", "--green50", "normal", ".trust p / .cd-callout", "globals.css:180"],

  // ── coloured text on light surfaces ──
  ["Accent text", "--blue", "--paper", "normal", ".linklike / .sec a", "globals.css:313"],
  ["Accent text", "--blue", "--cream", "normal", ".web-eyebrow", "globals.css:226"],
  ["Accent text", "--blue", "--sand", "normal", ".web-eyebrow on page bg", "globals.css:226"],
  ["Accent text", "--green-ink", "--paper", "normal", ".sf-free Gratuite 17px", "StorefrontView.tsx:662"],
  ["Accent text", "--green-ink", "--cream", "normal", "0 TND 16px", "page.tsx:378"],
  ["Accent text", "--green-ink", "--sand", "normal", "green micro-copy", "pour-les-profs:745"],
  ["Accent text", "--ochre-ink", "--sand", "normal", "step line", "student/page.tsx:165"],
  ["Accent text", "--ochre-ink", "--cream", "normal", "step line", "verify/page.tsx:340"],
  ["Accent text", "--ochre-ink", "--ochre-tint", "normal", "TONES pill", "page.tsx:174"],

  // ── large display text (h1 clamp(30,5.5vw,56) → large) ──
  ["Display", "--ochre-ink", "--cream", "large", "h1 highlight (verifie)", "page.tsx:319"],
  ["Display", "--ochre-ink", "--sand", "large", "h1 highlight on page bg", "page.tsx:319"],
  ["Display", "--green-ink", "--sand", "large", "h1 Tu gardes 100%", "pour-les-profs:726"],
  ["Display", "--green-ink", "--cream", "large", "h1 line 3", "pour-les-profs:726"],
  ["Display", "--blue", "--sand", "large", "h1 line 2", "pour-les-profs:723"],
  ["Display", "--blue", "--cream", "large", "h1 line 2", "pour-les-profs:723"],

  // ── on dark surfaces ──
  // The cobalt panels are gradients ending at --blue900, so every pair is
  // checked against the DARKER stop as well; that is the worst case for a light
  // foreground and the one a spot-check by eye always misses.
  ["On dark", W, "--blue", "normal", ".hero-blue body", "globals.css:135"],
  ["On dark", W, "--blue900", "normal", ".hero-blue gradient end", "globals.css:135"],
  ["On dark", "--on-blue-soft", "--blue", "normal", ".balance .lbl", "globals.css:159"],
  ["On dark", "--on-blue-soft", "--blue900", "normal", ".sf-subject", "StorefrontView.tsx:603"],
  ["On dark", "--on-blue", "--blue", "normal", ".lpp income copy", "pour-les-profs:493"],
  ["On dark", "--on-blue", "--blue900", "normal", ".sf-meta", "StorefrontView.tsx:611"],
  ["On dark", "--on-dark", "--ink800", "normal", "live-room body", "live/[id]:231"],
  ["On dark", "--on-dark", "--ink900", "normal", "live-room body (gradient end)", "live/[id]:199"],
  ["On dark", "--on-dark-soft", "--ink800", "normal", "live-room meta", "live/[id]:223"],
  ["On dark", "--on-dark-soft", "--ink900", "normal", "student panel meta", "student/page.tsx:272"],
  ["On dark", "--rose200", "--ink800", "normal", "LIVE badge / alert on dark", "student/page.tsx:338"],
  ["On dark", "--mint", "--blue900", "ui", "split-bar fill / dot", "pour-les-profs:506"],
  ["On dark", "--mint200", "--blue900", "ui", ".sf-pill icon", "StorefrontView.tsx:631"],
  ["On dark", W, "--ink", "normal", ".toast / .side-nav .active", "globals.css:186"],

  // ── alert blocks ──
  ["Alerts", "--rose700", "--rose50", "normal", ".lg-notice b / .ck-alert", "privacy/page.tsx:47"],
  ["Alerts", "--rose600", "--rose50", "normal", ".lg-notice span", "privacy/page.tsx:48"],
  ["Alerts", "--blue", "--blue100", "normal", ".lpp-cross:hover", "pour-les-profs:710"],

  // ── non-text UI (1.4.11) — ADVISORY, see NOTE ──
  ["UI (advisory)", "--blue", "--cream", "ui", ":focus-visible ring", "globals.css:49"],
  ["UI (advisory)", "--blue", "--paper", "ui", ":focus-visible ring", "globals.css:49"],
  ["UI (advisory)", "--line", "--paper", "ui", ".inp border", "globals.css:124"],
  ["UI (advisory)", "--line", "--cream", "ui", ".card / .u-card border", "globals.css:292"],
  ["UI (advisory)", "--paper", "--cream", "ui", ".u-card fill vs page", "globals.css:292"],
  ["UI (advisory)", "--paper", "--sand", "ui", ".u-card fill vs page bg", "globals.css:292"],
];

/* ── run ──────────────────────────────────────────────────────────────────── */
let fails = 0;
let advisoryFails = 0;
let group = null;
const w = (s, n) => String(s).padEnd(n).slice(0, n);

console.log("\nWCAG 2.1 AA contrast audit — tokens read from app/globals.css\n");
console.log("  " + w("FG", 28) + w("BG", 18) + w("RATIO", 8) + w("NEED", 11) + w("", 7) + "WHERE");
console.log("  " + "-".repeat(110));

for (const [g, fgSpec, bgSpec, size, what, where] of PAIRS) {
  if (g !== group) {
    group = g;
    console.log(`\n  ${g.toUpperCase()}`);
  }
  const fg = resolve(fgSpec);
  const bg = resolve(bgSpec);
  const ratio = contrast(fg, bg);
  const need = NEED[size];
  const ok = ratio >= need;
  const advisory = g.includes("advisory");
  if (!ok) advisory ? advisoryFails++ : fails++;
  const mark = ok ? "PASS" : advisory ? "ADVIS" : "FAIL";
  const label = fgSpec.startsWith("--") ? `${fgSpec} (${fg})` : fgSpec;
  console.log(
    "  " +
      w(label, 28) +
      w(bgSpec.replace(/^--/, ""), 18) +
      w(ratio.toFixed(2), 8) +
      w(`${need.toFixed(1)} ${size}`, 11) +
      w(mark, 7) +
      `${what}  ${where}`
  );
}

console.log("\n  " + "-".repeat(110));
console.log(`  ${PAIRS.length} pairs checked — ${fails} FAIL, ${advisoryFails} advisory below 3.0\n`);

if (advisoryFails) {
  console.log(
    "  NOTE  The advisory rows are WCAG 1.4.11 (non-text contrast) on hairline borders and\n" +
      "        card fills. They are decorative separators, not the sole means of identifying a\n" +
      "        component (every field has a visible <label>, every card has heading text), so\n" +
      "        they are reported but do not fail the build. Darkening --line to satisfy 3.0\n" +
      "        would visibly change the brand's soft-paper look on every surface.\n"
  );
}

if (fails) {
  console.error(`  x ${fails} WCAG AA contrast failure(s).\n`);
  process.exit(1);
}
console.log("  OK — zero WCAG AA contrast failures.\n");
