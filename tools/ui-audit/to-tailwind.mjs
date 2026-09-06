#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════════
   to-tailwind.mjs — one-shot codemod: React inline `style={{…}}` → Tailwind
   utility classes, for the logged-in screens.

   Why this exists. The landing pages (/ and /explore) were rebuilt in the
   Tailwind idiom; the logged-in product was not, so it carried ~370 inline
   style objects using the SAME tokens and the SAME logical properties. Nothing
   about that is visually wrong — it is a maintainability tax: a spacing or
   colour decision has to be made twice, in two idioms, and the second one is
   easy to forget.

   ── The safety rule ────────────────────────────────────────────────────────
   ALL-OR-NOTHING PER OBJECT. If a single property in a style object cannot be
   mapped with certainty, the ENTIRE object is left alone. A half-converted
   object is how a codemod silently drops a declaration; a skipped object is
   just work still to do. Anything dynamic (a ternary, a template literal, an
   identifier) is dynamic and stays inline — that is correct code, not debt.

   Physical properties are a hard bail: this codebase's Arabic layout depends on
   logical properties only, so marginLeft/paddingRight/textAlign:left must never
   be introduced, not even faithfully.

   Verify with:  node tools/ui-audit/shots.mjs --out=shots-baseline
                 node tools/ui-audit/to-tailwind.mjs <file>
                 node tools/ui-audit/shots.mjs && node tools/ui-audit/diff.mjs
   ══════════════════════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync } from "node:fs";

/* Tailwind's default spacing scale, px → suffix. Only exact hits use a scale
   step; everything else becomes an arbitrary value, because `p-[13px]` is
   honest and `p-3` (12px) would be a silent 1px change. */
const SPACE = new Map([
  [0, "0"], [2, "0.5"], [4, "1"], [6, "1.5"], [8, "2"], [10, "2.5"], [12, "3"],
  [14, "3.5"], [16, "4"], [20, "5"], [24, "6"], [28, "7"], [32, "8"], [36, "9"],
  [40, "10"], [44, "11"], [48, "12"], [56, "14"], [64, "16"], [80, "20"], [96, "24"],
]);

const TOKEN_COLORS = new Set([
  "ink", "ink2", "muted", "blue", "cobalt", "blue700", "blue50", "sand", "cream",
  "paper", "ochre", "ochre600", "amber", "green", "green50", "rose", "rose50",
  "line", "lineCool", "ochre-ink", "green-ink", "ochre-btn", "green-btn",
  "ochre-tint", "blue300", "blue100", "blue900", "ink800", "ink900", "ochre300",
  "mint", "mint200", "on-blue", "on-blue-soft", "on-dark", "on-dark-soft",
  "rose700", "rose600", "rose300", "rose200",
]);

const RADIUS = { "var(--r-s)": "brand-sm", "var(--r)": "brand", "var(--r-l)": "brand-lg", "var(--r-xl)": "brand-xl" };
const SHADOW = { "var(--sh-s)": "brand-sm", "var(--sh)": "brand", "var(--sh-l)": "brand-lg" };
const FONT = { "var(--fd)": "font-display", "var(--fb)": "font-body", "var(--fa)": "font-ar" };

const WEIGHT = { 400: "font-normal", 500: "font-medium", 600: "font-semibold", 700: "font-bold", 800: "font-extrabold" };

/** px number → a spacing suffix (scale step or arbitrary). */
function space(v) {
  if (typeof v === "number") {
    if (SPACE.has(v)) return SPACE.get(v);
    return `[${v}px]`;
  }
  return `[${String(v).replace(/\s+/g, "_")}]`;
}
/** any raw value → an arbitrary-value suffix */
const arb = (v) => `[${String(v).replace(/\s+/g, "_")}]`;

/** colour value → tailwind colour suffix, or null if it is not a plain token */
function colour(v) {
  const m = /^var\(--([\w-]+)\)$/.exec(String(v));
  if (m && TOKEN_COLORS.has(m[1])) return m[1];
  if (v === "#fff" || v === "#ffffff" || v === "white") return "white";
  if (v === "transparent") return "transparent";
  return null;
}

/* A size value: number (px), a token, a clamp(), a percentage, "auto", "100%". */
function size(v) {
  if (typeof v === "number") return SPACE.has(v) ? SPACE.get(v) : `[${v}px]`;
  const s = String(v);
  if (s === "auto") return "auto";
  if (s === "100%") return "full";
  if (s === "0") return "0";
  return arb(s);
}

/* property → (value) => class | null.  null anywhere means "bail on this object". */
const MAP = {
  display: (v) => ({ flex: "flex", grid: "grid", block: "block", inline: "inline",
    "inline-flex": "inline-flex", "inline-block": "inline-block", "inline-grid": "inline-grid",
    none: "hidden", contents: "contents" }[v] ?? null),
  placeItems: (v) => (v === "center" ? "place-items-center" : null),
  placeContent: (v) => (v === "center" ? "place-content-center" : null),
  alignItems: (v) => ({ center: "items-center", "flex-start": "items-start", start: "items-start",
    "flex-end": "items-end", end: "items-end", stretch: "items-stretch", baseline: "items-baseline" }[v] ?? null),
  alignSelf: (v) => ({ center: "self-center", "flex-start": "self-start", "flex-end": "self-end",
    stretch: "self-stretch", auto: "self-auto" }[v] ?? null),
  justifyContent: (v) => ({ center: "justify-center", "space-between": "justify-between",
    "flex-end": "justify-end", end: "justify-end", "flex-start": "justify-start", start: "justify-start",
    "space-around": "justify-around", "space-evenly": "justify-evenly" }[v] ?? null),
  justifyItems: (v) => (v === "center" ? "justify-items-center" : null),
  flexDirection: (v) => ({ column: "flex-col", row: "flex-row", "column-reverse": "flex-col-reverse",
    "row-reverse": "flex-row-reverse" }[v] ?? null),
  flexWrap: (v) => ({ wrap: "flex-wrap", nowrap: "flex-nowrap", "wrap-reverse": "flex-wrap-reverse" }[v] ?? null),
  flex: (v) => (v === 1 || v === "1" ? "flex-1" : v === "none" ? "flex-none" : v === "auto" ? "flex-auto" : `flex-${arb(v)}`),
  flexShrink: (v) => (v === 0 ? "shrink-0" : v === 1 ? "shrink" : null),
  flexGrow: (v) => (v === 0 ? "grow-0" : v === 1 ? "grow" : null),
  flexBasis: (v) => `basis-${size(v)}`,
  gap: (v) => `gap-${space(v)}`,
  rowGap: (v) => `gap-y-${space(v)}`,
  columnGap: (v) => `gap-x-${space(v)}`,

  margin: (v) => (v === 0 ? "m-0" : v === "0 auto" ? "mx-auto" : null),
  marginTop: (v) => (v === "auto" ? "mt-auto" : `mt-${space(v)}`),
  marginBottom: (v) => (v === "auto" ? "mb-auto" : `mb-${space(v)}`),
  marginInline: (v) => (v === "auto" ? "mx-auto" : `mx-${space(v)}`),
  marginBlock: (v) => `my-${space(v)}`,
  marginInlineStart: (v) => (v === "auto" ? "ms-auto" : `ms-${space(v)}`),
  marginInlineEnd: (v) => (v === "auto" ? "me-auto" : `me-${space(v)}`),
  marginBlockStart: (v) => (v === "auto" ? "mt-auto" : `mt-${space(v)}`),
  marginBlockEnd: (v) => (v === "auto" ? "mb-auto" : `mb-${space(v)}`),

  padding: (v) => {
    if (typeof v === "number") return `p-${space(v)}`;
    const parts = String(v).trim().split(/\s+/);
    if (parts.length === 2) return `py-${space(px(parts[0]))} px-${space(px(parts[1]))}`;
    return null; // 3- and 4-value shorthands mix block and inline sides — not worth guessing
  },
  paddingTop: (v) => `pt-${space(v)}`,
  paddingBottom: (v) => `pb-${space(v)}`,
  paddingInline: (v) => `px-${space(v)}`,
  paddingBlock: (v) => `py-${space(v)}`,
  paddingInlineStart: (v) => `ps-${space(v)}`,
  paddingInlineEnd: (v) => `pe-${space(v)}`,
  paddingBlockStart: (v) => `pt-${space(v)}`,
  paddingBlockEnd: (v) => `pb-${space(v)}`,

  width: (v) => `w-${size(v)}`,
  height: (v) => `h-${size(v)}`,
  minWidth: (v) => `min-w-${size(v)}`,
  minHeight: (v) => `min-h-${size(v)}`,
  maxWidth: (v) => `max-w-${size(v)}`,
  maxHeight: (v) => `max-h-${size(v)}`,

  fontSize: (v) => (typeof v === "number" ? `text-[${v}px]` : `text-${arb(v)}`),
  fontWeight: (v) => WEIGHT[Number(v)] ?? null,
  fontFamily: (v) => FONT[v] ?? null,
  lineHeight: (v) => `leading-${arb(v)}`,
  /* letterSpacing is NOT a unitless CSS property — React appends "px" to a bare
     number, so `letterSpacing: 0.6` means 0.6px. Emitting `tracking-[0.6]` would
     be invalid CSS and silently dropped, which narrowed a heading by 10px before
     geom.mjs caught it. */
  letterSpacing: (v) => (typeof v === "number" ? `tracking-[${v}px]` : `tracking-${arb(v)}`),
  textTransform: (v) => ({ uppercase: "uppercase", lowercase: "lowercase", capitalize: "capitalize", none: "normal-case" }[v] ?? null),
  textAlign: (v) => ({ center: "text-center", start: "text-start", end: "text-end", justify: "text-justify" }[v] ?? null),
  textDecoration: (v) => ({ underline: "underline", none: "no-underline", "line-through": "line-through" }[v] ?? null),
  whiteSpace: (v) => ({ nowrap: "whitespace-nowrap", normal: "whitespace-normal", pre: "whitespace-pre",
    "pre-wrap": "whitespace-pre-wrap", "pre-line": "whitespace-pre-line" }[v] ?? null),
  overflowWrap: (v) => (v === "anywhere" ? "[overflow-wrap:anywhere]" : v === "break-word" ? "break-words" : null),
  wordBreak: (v) => (v === "break-word" ? "break-words" : v === "break-all" ? "break-all" : null),

  color: (v) => { const c = colour(v); return c ? `text-${c}` : null; },
  background: (v) => { const c = colour(v); return c ? `bg-${c}` : null; },
  backgroundColor: (v) => { const c = colour(v); return c ? `bg-${c}` : null; },
  borderRadius: (v) => (RADIUS[v] ? `rounded-${RADIUS[v]}` : typeof v === "number" ? `rounded-[${v}px]` : v === "50%" ? "rounded-full" : v === "999px" ? "rounded-full" : null),
  boxShadow: (v) => (SHADOW[v] ? `shadow-${SHADOW[v]}` : v === "none" ? "shadow-none" : null),
  border: (v) => (v === 0 || v === "0" || v === "none" ? "border-0" : null),
  opacity: (v) => (typeof v === "number" ? `opacity-${arb(v)}` : null),

  position: (v) => ({ relative: "relative", absolute: "absolute", fixed: "fixed", sticky: "sticky", static: "static" }[v] ?? null),
  top: (v) => `top-${size(v)}`,
  bottom: (v) => `bottom-${size(v)}`,
  insetInlineStart: (v) => `start-${size(v)}`,
  insetInlineEnd: (v) => `end-${size(v)}`,
  inset: (v) => (v === 0 ? "inset-0" : null),
  zIndex: (v) => (typeof v === "number" ? `z-${arb(v)}` : null),
  overflow: (v) => ({ hidden: "overflow-hidden", auto: "overflow-auto", visible: "overflow-visible", scroll: "overflow-scroll" }[v] ?? null),
  overflowX: (v) => ({ hidden: "overflow-x-hidden", auto: "overflow-x-auto" }[v] ?? null),
  overflowY: (v) => ({ hidden: "overflow-y-hidden", auto: "overflow-y-auto" }[v] ?? null),
  cursor: (v) => ({ pointer: "cursor-pointer", default: "cursor-default", "not-allowed": "cursor-not-allowed" }[v] ?? null),
  listStyle: (v) => (v === "none" ? "list-none" : null),
  objectFit: (v) => ({ cover: "object-cover", contain: "object-contain" }[v] ?? null),
  pointerEvents: (v) => ({ none: "pointer-events-none", auto: "pointer-events-auto" }[v] ?? null),
  userSelect: (v) => ({ none: "select-none" }[v] ?? null),
};

/* Physical properties: never introduce them, never convert them. Hitting one is
   a bail, so the object stays exactly as it was and shows up in the report. */
const PHYSICAL = new Set(["marginLeft", "marginRight", "paddingLeft", "paddingRight",
  "left", "right", "borderLeft", "borderRight", "float", "clear"]);

const px = (s) => (/^-?\d+(\.\d+)?px$/.test(s) ? parseFloat(s) : /^-?\d+(\.\d+)?$/.test(s) ? parseFloat(s) : s);

/* ── a tiny object-literal reader ─────────────────────────────────────────── */
/** Parse `{ a: 1, b: "x" }` into [{key, raw}]. Returns null if anything is not a
    literal (identifier, ternary, call, template, spread, nested object). */
function parseStyleObject(src) {
  const out = [];
  let i = 0;
  const skipWs = () => { while (i < src.length && /\s/.test(src[i])) i++; };
  skipWs();
  while (i < src.length) {
    skipWs();
    if (i >= src.length) break;
    if (src[i] === ",") { i++; continue; }
    if (src[i] === "." || src[i] === "[") return null;           // spread / computed key
    const km = /^([A-Za-z_$][\w$]*|"[^"]+"|'[^']+')\s*:/.exec(src.slice(i));
    if (!km) return null;
    const key = km[1].replace(/^["']|["']$/g, "");
    i += km[0].length;
    skipWs();
    // value: a number or a quoted string, then a comma or end
    const vm = /^(-?\d+(?:\.\d+)?|"[^"]*"|'[^']*')\s*(?=,|$)/.exec(src.slice(i));
    if (!vm) return null;
    const rawV = vm[1];
    const value = /^["']/.test(rawV) ? rawV.slice(1, -1) : Number(rawV);
    out.push({ key, value });
    i += vm[0].length;
  }
  return out;
}

/** Find the matching `}}` for a `style={{` starting at `open`. */
function findClose(src, open) {
  let depth = 0;
  let str = null;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (str) { if (ch === "\\") { i++; continue; } if (ch === str) str = null; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { str = ch; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/* ── run ──────────────────────────────────────────────────────────────────── */
const files = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dry = process.argv.includes("--dry");
if (!files.length) {
  console.error("usage: node tools/ui-audit/to-tailwind.mjs <file...> [--dry]");
  process.exit(1);
}

for (const file of files) {
  let src = readFileSync(file, "utf8");
  let converted = 0;
  let skipped = 0;
  const reasons = new Map();
  const note = (r) => reasons.set(r, (reasons.get(r) ?? 0) + 1);

  let cursor = 0;
  while (true) {
    const at = src.indexOf("style={{", cursor);
    if (at === -1) break;
    const braceOpen = at + "style=".length;              // the outer `{`
    const close = findClose(src, braceOpen);
    if (close === -1) break;
    const whole = src.slice(at, close + 1);
    const inner = src.slice(braceOpen + 2, close - 1);   // between {{ and }}

    const parsed = parseStyleObject(inner);
    if (!parsed || !parsed.length) {
      note(parsed ? "empty" : "dynamic value (ternary / identifier / nested)");
      skipped++;
      cursor = close + 1;
      continue;
    }
    if (parsed.some((p) => PHYSICAL.has(p.key))) {
      note("physical property — left alone deliberately");
      skipped++;
      cursor = close + 1;
      continue;
    }

    const classes = [];
    let ok = true;
    for (const { key, value } of parsed) {
      const fn = MAP[key];
      if (!fn) { ok = false; note(`unmapped property: ${key}`); break; }
      const cls = fn(value);
      if (!cls) { ok = false; note(`unmapped value: ${key}=${JSON.stringify(value)}`); break; }
      classes.push(cls);
    }
    if (!ok) { skipped++; cursor = close + 1; continue; }

    /* Merge into the element's existing className, or add one. Look backwards to
       the tag start so we only ever touch THIS element's attributes. */
    const tagStart = src.lastIndexOf("<", at);
    const head = src.slice(tagStart, at);
    const cm = /className=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(head);

    const newClasses = classes.join(" ");
    if (cm && cm[1] !== undefined) {
      const merged = `${cm[1]} ${newClasses}`.trim().replace(/\s+/g, " ");
      const before = src.slice(0, tagStart + cm.index);
      const after = src.slice(tagStart + cm.index + cm[0].length);
      src = `${before}className="${merged}"${after}`;

      /* Delete the now-empty style attribute AND the whitespace that separated
         it from the previous attribute — but ONLY that span. An earlier version
         normalised whitespace across the whole file after each edit, which
         silently reformatted every element it had deliberately skipped. A
         codemod must touch exactly what it converts. */
      const at2 = src.indexOf("style={{", tagStart);
      const close2 = findClose(src, at2 + "style=".length);
      let start = at2;
      while (start > 0 && /[ \t]/.test(src[start - 1])) start--;
      let end = close2 + 1;
      // If removing it leaves a line with nothing but whitespace, take the line.
      if (src[start - 1] === "\n" && /^[ \t]*(\r?\n)/.test(src.slice(end))) {
        end += /^[ \t]*(\r?\n)/.exec(src.slice(end))[0].length;
        start -= 0;
      }
      src = src.slice(0, start) + src.slice(end);
      cursor = tagStart;
    } else if (cm) {
      note("className is a template literal — left alone");
      skipped++;
      cursor = close + 1;
      continue;
    } else {
      src = src.slice(0, at) + `className="${newClasses}"` + src.slice(close + 1);
      cursor = at;
    }
    converted++;
  }

  console.log(`\n${file}`);
  console.log(`  converted ${converted}, skipped ${skipped}`);
  for (const [r, n] of [...reasons].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(3)}  ${r}`);
  if (!dry) writeFileSync(file, src);
}
