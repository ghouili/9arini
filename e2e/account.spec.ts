import { test, expect } from "@playwright/test";
import { seedProfile } from "./support/seed";
import { mintSession, sessionCookie } from "./support/session";

/* /account is the one screen that RENDERS what getMe() returns, so it is the only
   place a broken getMe is visible.

   Added when getMe became the first action proxied to apps/api. The student
   dashboard also calls getMe(), but it swallows failures
   (`getMe().then(setMe).catch(() => setMe(null))`) and renders fine without it —
   so a completely broken proxy would have left the whole suite green. An action
   with no assertion on its RESULT is not really covered.

   This spec is transport-agnostic on purpose: it asserts what the user sees, not
   which process served it, so it stays valid before and after the port. */

test("the account screen shows the signed-in identity", async ({ browser }) => {
  const me = await seedProfile({ role: "student", birthYear: 1990, fullName: "Amine Karoui" });

  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  await ctx.addCookies([sessionCookie(await mintSession(me.id))]);
  const page = await ctx.newPage();

  await page.goto("/fr/account");

  // The name and the login identity both come from getMe().
  await expect(page.locator("main")).toContainText("Amine Karoui");
  await expect(page.locator("main")).toContainText(me.email);

  await ctx.close();
});

test("a signed-out visitor does not reach the account screen", async ({ page }) => {
  await page.goto("/fr/account");
  // middleware.ts bounces guests to /auth?next=<relative path>.
  await expect(page).toHaveURL(/\/auth/);
});
