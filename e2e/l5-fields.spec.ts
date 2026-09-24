import { test, expect } from "@playwright/test";
import { seedProfile, seedTutor } from "./support/seed";
import { contextAs } from "./support/journey";
import { sql } from "./support/db";

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

test.describe("A18.2 — the guardian phone is not collected", () => {
  test("the consent form has no phone field", async ({ browser }) => {
    const child = await seedProfile({ role: "student", birthYear: minorYear() });
    const ctx = await contextAs(browser, child.id);
    const page = await ctx.newPage();
    await page.goto("/fr/auth/consent", { waitUntil: "networkidle" });
    await expect(page.locator("[data-e2e=consent-info]")).toBeVisible();
    await expect(page.locator('input[type="tel"]')).toHaveCount(0);
    await expect(page.getByText("Téléphone du parent")).toHaveCount(0);
    await ctx.close();
  });
});

test.describe("A18.6 — the free-first box is disabled while the option is off", () => {
  test("option off: the box is disabled and links to the setting; option on: it can be ticked", async ({ browser }) => {
    const offMe = await seedProfile({ role: "tutor", birthYear: 1985 });
    await seedTutor({ profileId: offMe.id, status: "verified", offersFreeFirstSession: false });
    const ctx = await contextAs(browser, offMe.id);
    const page = await ctx.newPage();
    await page.goto("/fr/dashboard/new-class", { waitUntil: "networkidle" });
    const box = page.locator("[data-e2e=free-first-box]");
    await expect(box).toHaveAttribute("aria-disabled", "true");
    const link = page.locator("[data-e2e=free-first-off] a");
    await expect(link).toHaveText("Active d'abord l'option dans tes réglages");
    await expect(link).toHaveAttribute("href", "/fr/dashboard#free-first");
    await box.click({ force: true });
    await expect(box).toHaveAttribute("aria-checked", "false");
    await ctx.close();

    const onMe = await seedProfile({ role: "tutor", birthYear: 1985 });
    await seedTutor({ profileId: onMe.id, status: "verified", offersFreeFirstSession: true });
    const ctx2 = await contextAs(browser, onMe.id);
    const page2 = await ctx2.newPage();
    await page2.goto("/fr/dashboard/new-class", { waitUntil: "networkidle" });
    const box2 = page2.locator("[data-e2e=free-first-box]");
    await expect(box2).toHaveAttribute("aria-disabled", "false");
    await box2.click();
    await expect(box2).toHaveAttribute("aria-checked", "true");
    await expect(page2.locator("[data-e2e=free-first-off]")).toHaveCount(0);
    await ctx2.close();
  });
});

test.describe("A18.7 — levels, never a default 'Bac'", () => {
  test("a tutor with no levels shows none; chosen levels show on the storefront and filter Explore", async ({ page }) => {
    const name = `L5 Niveaux ${Date.now().toString(36)}`;
    const none = await seedTutor({ fullName: `${name} Zero` }); // tutors.level = 'Bac', the old default
    const some = await seedTutor({ fullName: `${name} Deux` });
    await sql`update tutors set levels = ${sql.array(["college", "bac"])} where id = ${some.id}`;

    await page.goto(`/fr/${none.slug}`, { waitUntil: "networkidle" });
    await expect(page.locator("[data-e2e=sf-levels]")).toHaveCount(0);

    await page.goto(`/fr/${some.slug}`, { waitUntil: "networkidle" });
    await expect(page.locator("[data-e2e=sf-levels] li")).toHaveText(["Collège", "Bac"]);

    await page.goto("/fr/explore", { waitUntil: "networkidle" });
    await page.locator('input[type="search"]').fill(name);
    await page.locator('[data-e2e=level-filter] [data-level="college"]').click();
    await expect(page.locator(`a[href="/fr/${some.slug}"]`)).toBeVisible();
    await expect(page.locator(`a[href="/fr/${none.slug}"]`)).toHaveCount(0);
  });
});
