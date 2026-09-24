import { test, expect } from "@playwright/test";
import { seedProfile } from "./support/seed";
import { contextAs } from "./support/journey";

/* Phase A · lane L5 — "the misplaced fields" (A18). Written by the lane, run by
   the orchestrator after merge (lanes never run Playwright). Each describe block
   names the A18 item it proves. Wherever an item has logic (limits, levels,
   subjects, next session, material visibility, roles) it ALSO has an API/unit
   test in apps/api/test/l5-*.test.ts; these specs cover what only a browser sees. */

const minorYear = () => new Date().getFullYear() - 15;

test.describe("A18.1 — the child never declares to be the parent", () => {
  test("the consent form has no self-declaration tick, and says the parent confirms", async ({ browser }) => {
    const child = await seedProfile({ role: "student", birthYear: minorYear() });
    const ctx = await contextAs(browser, child.id);
    const page = await ctx.newPage();
    await page.goto("/fr/auth/consent", { waitUntil: "networkidle" });

    const html = await page.content();
    expect(html).not.toContain("Je confirme être le parent");
    await expect(page.getByRole("checkbox")).toHaveCount(0);

    /* playwright.config.ts runs the web server with ALLOW_MINORS=1, so the form
       renders; without it the page says the pilot is 18+ and shows no form. */
    await expect(page.locator("[data-e2e=consent-info]")).toContainText("Ton parent recevra un e-mail pour confirmer.");
    await ctx.close();
  });
});
