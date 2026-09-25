import { test, expect, type Page } from "@playwright/test";

/* Phase A+ — UI follow-ups to Option A. Colours are asserted as COMPUTED values. */

const BLUE50 = "rgb(233, 241, 250)"; // --blue50
const GREEN50 = "rgb(227, 244, 237)"; // --green50

const bgOf = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => getComputedStyle(el).backgroundColor);

/* ── U1: information is blue; "Bientôt" starts its own line ─────────────────── */
test.describe("U1 — info notes are blue, and the payment sentence starts its own line", () => {
  test("tutor page sidebar: the payment note is blue50, and 'Bientôt' opens its line", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/fr/yassine-math");
    const note = page.locator("[data-sf-aside] .sf-trust");
    await expect(note).toBeVisible();
    expect(await bgOf(page, "[data-sf-aside] .sf-trust")).toBe(BLUE50);
    const story = note.locator("[data-payment-story]");
    expect(await story.evaluate((el) => getComputedStyle(el).display)).toBe("block");
    // The tag is the first thing in the sentence's block — never mid-sentence.
    expect(await story.evaluate((el) => (el.firstElementChild as HTMLElement | null)?.textContent?.trim())).toBe("Bientôt");
  });

  test("/fr/tarifs: the pilot banner is blue50, not green50", async ({ page }) => {
    await page.goto("/fr/tarifs");
    const bg = await page.locator("main .note-info, main .trust").first().evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe(GREEN50);
    expect(bg).toBe(BLUE50);
  });

  test("every rendered payment sentence is a block that starts with its tag", async ({ page }) => {
    for (const path of ["/fr", "/fr/tarifs", "/fr/yassine-math"]) {
      await page.goto(path);
      const stories = page.locator("[data-payment-story=soon]");
      const n = await stories.count();
      expect(n, path).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) {
        expect(await stories.nth(i).evaluate((el) => getComputedStyle(el).display), `${path} #${i}`).toBe("block");
      }
    }
  });
});
