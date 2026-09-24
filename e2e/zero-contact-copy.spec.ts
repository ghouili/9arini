import { test, expect, type Browser } from "@playwright/test";
import { seedProfile, seedTutor } from "./support/seed";
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

test.describe("A4 — the new-pack page never tells a tutor to send files by WhatsApp or e-mail", () => {
  for (const locale of ["fr", "ar"] as const) {
    test(`/${locale}/dashboard/new-pack`, async ({ browser }) => {
      const tutorProfile = await seedProfile({ role: "tutor", birthYear: 1985 });
      await seedTutor({ profileId: tutorProfile.id, status: "verified" });
      const { ctx, page } = await pageAs(browser, tutorProfile.id);
      await page.goto(`/${locale}/dashboard/new-pack`);
      await expect(page.locator("form")).toBeVisible();

      // The page's own content (the site footer carries Tnajem's contact address).
      const text = await page.locator("main").innerText();
      expect(text).not.toMatch(/whatsapp|e-?mail/i);
      expect(text).not.toMatch(/واتساب|إيميل|ايميل/);
      // No "upload isn't connected yet": Mes documents uploads, and the page says where.
      expect(text).not.toContain("pas encore branché");
      await expect(page.locator('main a[href$="/dashboard/materials"]')).toBeVisible();
      await ctx.close();
    });
  }
});
