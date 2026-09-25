import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { seedProfile, seedTutor } from "../support/seed";
import { loginAs } from "../support/session";
import { BASE_URL } from "../support/env";

/* Phase A+ · U3 — the cash-out button, which only exists when PAYMENTS_ENABLED=1.
   The suite never runs with payments on, so this capture (excluded from npm test,
   like option-a.capture.ts) is run against servers started WITH the flag:
     PAYMENTS_ENABLED=1 on both servers, then
     npx playwright test -c e2e/visual/visual.config.ts cashout
   Set E2E_PAYMENTS_ON=1 for the run (it skips otherwise).
   It asserts the button is the ochre primary (no longer green) and saves
   screenshots to ui-a-plus/cashout-*.png. */

const OUT = resolve("ui-a-plus");

test("cash-out (payments on): ochre btn-primary on the dashboard and the payout page", async ({ browser }) => {
  test.skip(process.env.E2E_PAYMENTS_ON !== "1", "needs servers started with PAYMENTS_ENABLED=1 (set E2E_PAYMENTS_ON=1)");
  await mkdir(OUT, { recursive: true });
  const profile = await seedProfile({ role: "tutor", birthYear: 1990, fullName: "Yassine Kallel" });
  await seedTutor({ status: "verified", profileId: profile.id, fullName: "Yassine Kallel" });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  await loginAs(ctx, profile.id);
  await ctx.addCookies([{ name: "tnajem_role", value: "tutor", domain: new URL(BASE_URL).hostname, path: "/" }]);
  const page = await ctx.newPage();

  await page.goto("/fr/dashboard/payout");
  const withdraw = page.locator("main button.btn").first(); // the withdrawal button (always disabled: no fake withdrawal)
  await expect(withdraw).toBeVisible();
  await expect(withdraw).toHaveClass(/btn-primary/);
  expect(await withdraw.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(174, 98, 26)"); // --ochre-btn
  await page.screenshot({ path: resolve(OUT, "cashout-payout-1280.png"), fullPage: true });

  await page.goto("/fr/dashboard");
  const cashout = page.locator("main button.btn").filter({ hasText: "Retirer mes gains" }).first();
  await expect(cashout).toBeVisible({ timeout: 15_000 });
  await expect(cashout).toHaveClass(/btn-primary/);
  expect(await cashout.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(174, 98, 26)"); // --ochre-btn
  await page.screenshot({ path: resolve(OUT, "cashout-dashboard-1280.png"), fullPage: true });
  await ctx.close();
});
