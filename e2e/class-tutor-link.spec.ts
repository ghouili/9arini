import { test, expect } from "@playwright/test";
import { seedTutor, seedClass } from "./support/seed";

/* ════════════════════════════════════════════════════════════════════════════
   phase-a lane L4 (A9) — the class page links to ITS tutor, by slug.

   The page used to search Explore for the tutor's NAME and take the first exact
   match. Two tutors called "Mohamed Ben Ali" meant a student reading tutor B's
   class could be sent to tutor A's storefront. GET /classes/:id now returns
   tutor_slug, and the page links by it.

   Deliberately does not assert the visible name: how the tutor's name is shown to
   a student (first name + initial, D1) is another spec's business. The link
   target is what this one pins.
   ADDED, never edited into an existing spec. */

for (const locale of ["fr", "ar"] as const) {
  test(`/${locale}: two tutors named "Mohamed Ben Ali" — B's class links to B's storefront`, async ({ page }) => {
    const a = await seedTutor({ status: "verified", fullName: "Mohamed Ben Ali" });
    const b = await seedTutor({ status: "verified", fullName: "Mohamed Ben Ali" });
    await seedClass({ tutorId: a.id });
    const klass = await seedClass({ tutorId: b.id });

    await page.goto(`/${locale}/class/${klass.id}`);

    const tutorLink = page.locator(".cd-tutor-name a");
    await expect(tutorLink, "the tutor card links to a storefront").toHaveCount(1);
    await expect(tutorLink).toHaveAttribute("href", `/${locale}/${b.slug}`);
    await expect(page.locator(".cd-back"), "the back link goes to the same storefront").toHaveAttribute(
      "href",
      `/${locale}/${b.slug}`,
    );
    await expect(page.locator(`a[href="/${locale}/${a.slug}"]`), "never to the namesake").toHaveCount(0);
  });
}
