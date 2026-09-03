#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════════
   diff.mjs — compare two screenshot directories.

   Playwright's PNG encoding is deterministic for identical pixel data, so equal
   SHA-256 means pixel-identical: a clean run is PROOF that a refactor changed
   nothing on screen, not an assertion that it probably didn't. Unequal means
   "look at these two files", which is the whole point — it names exactly which
   route and width to open.

   Usage:  node scripts/ui-audit/diff.mjs <baselineDir> [<currentDir>]
   Exit 1 if anything differs, so it can gate a conversion commit.
   ══════════════════════════════════════════════════════════════════════════════ */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT } from "./lib-color.mjs";

const dirArg = (i, dflt) => {
  const a = process.argv[i];
  return resolve(ROOT, "scripts/ui-audit", a || dflt);
};
const A = dirArg(2, "shots-baseline");
const B = dirArg(3, "shots");

for (const d of [A, B]) {
  if (!existsSync(d)) {
    console.error(`\n  x ${d} does not exist.\n    Capture one with:  node scripts/ui-audit/shots.mjs --out=${d.split(/[\/]/).pop()}\n`);
    process.exit(1);
  }
}

const hash = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const list = (d) => new Set(readdirSync(d).filter((f) => f.endsWith(".png")));

const a = list(A);
const b = list(B);

const onlyA = [...a].filter((f) => !b.has(f));
const onlyB = [...b].filter((f) => !a.has(f));
const changed = [];
let same = 0;

for (const f of [...a].filter((f) => b.has(f)).sort()) {
  if (hash(resolve(A, f)) === hash(resolve(B, f))) same++;
  else changed.push(f);
}

console.log(`\nScreenshot diff — ${A.split(/[\/]/).pop()} vs ${B.split(/[\/]/).pop()}\n`);
console.log(`  ${same} identical`);
if (onlyA.length) console.log(`  ${onlyA.length} missing from current: ${onlyA.slice(0, 6).join(", ")}`);
if (onlyB.length) console.log(`  ${onlyB.length} new in current: ${onlyB.slice(0, 6).join(", ")}`);
if (changed.length) {
  console.log(`  ${changed.length} CHANGED:`);
  for (const f of changed) console.log(`    ${f}`);
}
console.log();

if (changed.length || onlyA.length || onlyB.length) {
  console.error("  x Rendering differs. Open the named files and confirm every difference is intended.\n");
  process.exit(1);
}
console.log("  OK — pixel-identical.\n");
