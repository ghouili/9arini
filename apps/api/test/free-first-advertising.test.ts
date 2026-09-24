import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { advertisesFreeFirst } from "@tnajem/shared";

/* phase-a lane L3 (A5) — nothing public promises a free first session the product
   does not give.

   /tarifs said "La 1ʳᵉ séance est toujours offerte à l'élève" (AR: "ديما فابور")
   while the free session is an opt-in, OFF by default. And the storefront's link
   preview — the WhatsApp card, the Google snippet — promised "1ère séance offerte"
   on the tutor's toggle alone, even when none of their bookable classes is a free
   first session. The browser-level proof is e2e/free-first-copy.spec.ts; this file
   is the part the API gate can run. */

const web = (p: string) => fileURLToPath(new URL(`../../web/${p}`, import.meta.url));
const H = 3600_000;
const cls = (isFree: boolean, opts: { hours?: number; status?: "scheduled" | "cancelled" | "done" } = {}) => ({
  is_free_first: isFree,
  starts_at: new Date(Date.now() + (opts.hours ?? 72) * H).toISOString(),
  status: opts.status ?? ("scheduled" as const),
});

describe("A5 · the link preview promises a free session only when one can be booked", () => {
  test("toggle OFF → never, whatever the class flags say", () => {
    assert.equal(advertisesFreeFirst(false, [cls(true)]), false);
    assert.equal(advertisesFreeFirst(null, [cls(true)]), false);
  });
  test("toggle ON but no bookable free-first class → no promise", () => {
    assert.equal(advertisesFreeFirst(true, []), false, "no class at all");
    assert.equal(advertisesFreeFirst(true, [cls(false)]), false, "only paid classes");
    assert.equal(advertisesFreeFirst(true, [cls(true, { hours: -2 })]), false, "the free class already started");
    assert.equal(advertisesFreeFirst(true, [cls(true, { status: "cancelled" })]), false, "the free class is cancelled");
  });
  test("toggle ON and a bookable free-first class → the promise is true", () => {
    assert.equal(advertisesFreeFirst(true, [cls(false), cls(true)]), true);
  });
  test("the storefront metadata decides its pitch with this rule", () => {
    const src = readFileSync(web("app/[locale]/[slug]/page.tsx"), "utf8");
    assert.match(src, /advertisesFreeFirst\(/);
    assert.doesNotMatch(src, /const pitch = tutor\.offers_free_first_session/);
  });
});

describe("A5 · /tarifs no longer says the first session is ALWAYS free", () => {
  const src = readFileSync(web("components/tarifs/TarifsInner.tsx"), "utf8");
  test("no « toujours offerte » (FR) and no « ديما فابور » (AR)", () => {
    assert.doesNotMatch(src, /toujours offerte/i);
    assert.doesNotMatch(src, /ديما فابور/);
  });
  test("the conditional sentence is there instead", () => {
    assert.match(src, /Si ton prof l'offre, ta 1ʳᵉ séance avec lui est gratuite\./);
  });
});
