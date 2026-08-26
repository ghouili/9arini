#!/usr/bin/env node
/* tune.mjs — dev helper (not part of `npm run ui:audit`).

   Given a brand hue, find the LIGHTEST shade of it that still clears a contrast
   target against every surface it must sit on. Keeping the shade as light as the
   spec allows is the point: an over-darkened accent passes the audit but reads as
   brown/bottle-green and loses the brand. Search is in OKLCH-ish terms — we walk
   the L channel of HSL while holding H and S, which keeps the hue recognisable. */

import { contrast, readTokens } from "./lib-color.mjs";

const T = readTokens();
const hex = (n) => n.toString(16).padStart(2, "0");

function toHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function toHex([h, s, l]) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return "#" + [f(0), f(8), f(4)].map(hex).join("").toUpperCase();
}

function parse(v) {
  const s = v.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
}

/** Walk L down from the brand value until every (other, target) constraint holds. */
function tune(brandHex, constraints, { boostSat = 0 } = {}) {
  const [h, s0, l0] = toHsl(parse(brandHex));
  const s = Math.min(1, s0 + boostSat);
  for (let l = l0; l > 0; l -= 0.002) {
    const cand = toHex([h, s, l]);
    if (constraints.every(([other, need]) => contrast(cand, other) >= need)) {
      return { hex: cand, ratios: constraints.map(([o, n]) => [o, +contrast(cand, o).toFixed(2), n]) };
    }
  }
  return null;
}

const W = "#FFFFFF";
const S = { paper: T.paper, cream: T.cream, sand: T.sand, green50: T.green50, tint: "#FFF4DF" };

/* A 0.02 margin above the 4.5 / 3.0 floors so a later token nudge (or a browser's
   own rounding) cannot silently drop a pair below the line. */
const AA = 4.60;

const jobs = [
  ["--ochre-btn        (white label)", T.ochre, [[W, AA]]],
  ["--ochre-btn-hover  (white label)", T.ochre600, [[W, AA + 0.9]]],
  ["--green-btn        (white label)", T.green, [[W, AA]]],
  ["--ochre-ink   (text)", T.ochre, [[S.sand, AA], [S.cream, AA], [S.paper, AA], [S.tint, AA]]],
  ["--green-ink   (text)", T.green, [[S.sand, AA], [S.cream, AA], [S.paper, AA], [S.green50, AA]]],
  ["--trust-ink        (text)", T.green, [[S.green50, AA]]],
];

console.log("\nLightest brand-preserving shade that clears WCAG AA\n");
for (const [name, brand, cons] of jobs) {
  const r = tune(brand, cons);
  if (!r) { console.log(`  ${name}  — no solution`); continue; }
  console.log(`  ${name}\n    brand ${brand}  ->  ${r.hex}`);
  for (const [o, ratio, need] of r.ratios) console.log(`      vs ${o}  ${ratio}  (need ${need})`);
}
console.log();
