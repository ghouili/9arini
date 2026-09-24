import { test, expect, type Page } from "@playwright/test";

/* UI Option A "Clair" — the colour rules that must not drift back.

   Colours are asserted as COMPUTED values, so a token change that silently breaks
   a rule (a gradient creeping back onto <body>, near-black back on a button) fails
   here rather than in a screenshot nobody compares. */

const BG = "rgb(251, 247, 240)"; // --bg (= --cream)

async function bodyBackground(page: Page) {
  return page.evaluate(() => {
    const s = getComputedStyle(document.body);
    return { image: s.backgroundImage, color: s.backgroundColor };
  });
}

test.describe("A1 — one flat page background", () => {
  test("/fr/explore: no gradient on <body>, the flat --bg, and the body covers the whole page", async ({ page }) => {
    await page.goto("/fr/explore");
    const bg = await bodyBackground(page);
    expect(bg.image, "no radial washes on the page background").toBe("none");
    expect(bg.color).toBe(BG);
    /* The old bug: html,body{height:100%} made the body exactly one viewport tall,
       so its background stopped halfway down a long grid. */
    const { bodyH, docH } = await page.evaluate(() => ({
      bodyH: document.body.getBoundingClientRect().height,
      docH: document.documentElement.scrollHeight,
    }));
    expect(bodyH).toBeGreaterThanOrEqual(docH - 1);
  });

  test("/ar: the same flat background in Arabic", async ({ page }) => {
    await page.goto("/ar");
    const bg = await bodyBackground(page);
    expect(bg.image).toBe("none");
    expect(bg.color).toBe(BG);
  });
});
