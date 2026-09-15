import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { sql } from "./support/db";
import { seedTutor } from "./support/seed";

/* ════════════════════════════════════════════════════════════════════════════
   Arabic on a French page is set in the brand's Arabic face, not the system's.

   The header shows تنجّم on every French page, and French pages show Arabic they
   did not write — a tutor's bio, a name. On 15 Sept the bio came out in the
   system Arial (Plus Jakarta Sans has no Arabic glyph). The check asks Chrome
   which font it ACTUALLY used (CSS.getPlatformFontsForNode) — a computed
   font-family only says what was requested.

   ADDED, never edited into an existing spec. */

async function usedFonts(ctx: BrowserContext, page: Page, selector: string): Promise<string[]> {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
  expect(nodeId, `${selector} exists`).toBeTruthy();
  const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
  return fonts.map((f) => `${f.familyName}${f.isCustomFont ? "" : " (system)"}`);
}

test("the wordmark, an Arabic bio and the French text each use their own face on /fr", async ({ browser }) => {
  const tutor = await seedTutor({ status: "verified", fullName: "Bio Arabe" });
  await sql`update tutors set bio = ${"القواعد قبل كل شي، بالصبر وبالدارجة."} where id = ${tutor.id}`;

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`/fr/${tutor.slug}`);
  await page.evaluate(() => document.fonts.ready);

  expect(await usedFonts(ctx, page, "header .brand-mark .ar"), "the wordmark").toEqual(["IBM Plex Sans Arabic"]);

  const bio = await page.evaluate(() => {
    const el = [...document.querySelectorAll("main [dir=auto]")].find((e) => /القواعد/.test(e.textContent ?? ""));
    el?.setAttribute("data-e2e", "arabic-bio");
    return Boolean(el);
  });
  expect(bio, "the Arabic bio is user text with dir=auto").toBe(true);
  expect(await usedFonts(ctx, page, "[data-e2e=arabic-bio]"), "the Arabic bio").toEqual(["IBM Plex Sans Arabic"]);

  const h1 = await usedFonts(ctx, page, "main h1");
  expect(h1, "French text keeps its Latin face").not.toContain("IBM Plex Sans Arabic");
  expect(h1.some((f) => f.endsWith("(system)")), `no system font in the French heading: ${h1}`).toBe(false);
  await ctx.close();
});
