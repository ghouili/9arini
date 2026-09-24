import { test, expect, type Browser } from "@playwright/test";
import { seedProfile } from "./support/seed";
import { mintSession, sessionCookie } from "./support/session";

/* ZERO CONTACT, IN THE COPY (phase-a lane L1: A3, A4, A12).

   The API never hands one party the other's phone or e-mail (zero-contact.spec.ts).
   These are the places where the PRODUCT'S OWN WORDS contradicted that rule — a
   screen promising the tutor could call, a tutor told to send files by WhatsApp —
   and a placeholder support number. Each test reads the rendered page in both
   locales.

   ADDED as its own spec. Written for the orchestrator's run after merge. */

async function pageAs(browser: Browser, profileId: string) {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  await ctx.addCookies([sessionCookie(await mintSession(profileId))]);
  return { ctx, page: await ctx.newPage() };
}

test.describe("A3 — the student welcome screen never promises the tutor can reach them", () => {
  for (const locale of ["fr", "ar"] as const) {
    test(`/${locale}/student/welcome`, async ({ browser }) => {
      const me = await seedProfile({ role: "student", birthYear: 1995 });
      const { ctx, page } = await pageAs(browser, me.id);
      await page.goto(`/${locale}/student/welcome`);
      await expect(page.locator("input[type=tel]")).toBeVisible();

      const html = await page.content();
      expect(html, "the tutor must never be said to be able to call").not.toContain("te joindre");
      expect(html).not.toMatch(/يكلمك|يتصل بيك/);
      // …and it says what the number is actually for.
      await expect(page.locator("main")).toContainText(
        locale === "fr" ? "Ton prof ne le voit jamais" : "أستاذك عمرو ما يشوفها",
      );
      await ctx.close();
    });
  }
});
