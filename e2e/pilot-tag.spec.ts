import { test, expect } from "@playwright/test";

/* Phase A+ · P4 (D12) — "Pilote · réservé aux 18 ans et +" while minors are off.

   The tag shows ONLY while ALLOW_MINORS !== "1", and the flag is read from the
   running server, never from the build. So the proof needs two servers built from
   the SAME bundle: the suite's own (ALLOW_MINORS=1, for the consent specs) and a
   second web process with the flag unset (playwright.config.ts, :3212). */

const PILOT = process.env.E2E_PILOT_BASE_URL ?? "http://localhost:3212";
const LABEL = { fr: "Pilote · réservé aux 18 ans et +", ar: "تجربة · للّي عمرهم 18 سنة وفوق" } as const;

for (const locale of ["fr", "ar"] as const) {
  test(`/${locale}, ALLOW_MINORS unset: the pilot tag is on the home hero and the Explore header`, async ({ page }) => {
    await page.goto(`${PILOT}/${locale}`);
    await expect(page.locator("[data-e2e=pilot-tag]"), "home").toHaveText(LABEL[locale]);
    await page.goto(`${PILOT}/${locale}/explore`);
    await expect(page.locator("[data-e2e=pilot-tag]"), "explore").toHaveText(LABEL[locale]);
  });
}

test("ALLOW_MINORS=1 (the suite's own server): no pilot tag on either page", async ({ page }) => {
  await page.goto("/fr/explore");
  await expect(page.locator("[data-e2e=pilot-tag]")).toHaveCount(0);
  await page.goto("/fr");
  await page.waitForLoadState("networkidle"); // the home tag asks /api/pilot after hydration
  await expect(page.locator("[data-e2e=pilot-tag]")).toHaveCount(0);
});
