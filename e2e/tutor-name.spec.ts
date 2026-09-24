import { test, expect } from "@playwright/test";
import { seedProfile, seedTutor, seedClass } from "./support/seed";
import { mintSession, sessionCookie } from "./support/session";

/* phase-a lane L2 · A23 — students see a tutor as FIRST NAME + INITIAL (D1).

   "Mohamed Ben Ali" is "Mohamed B." on the storefront, in the WhatsApp link
   preview (og:title), in the JSON-LD Person, on Explore, on the class page and
   at checkout. The API never sends the last name to those surfaces
   (apps/api/test/a23-tutor-name.test.ts); this pins what the pages render.
   ADDED, never edited into an existing spec. */

const FULL = "Mohamed Ben Ali";
const SURNAME = "Ben Ali";
const SHOWN = "Mohamed B.";

function metaContent(html: string, attr: "property" | "name", key: string): string | null {
  return html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`))?.[1] ?? null;
}

test.describe("A23 · the tutor's last name never reaches a student-facing page", () => {
  test("storefront HTML, OG tags and JSON-LD say « Mohamed B. »", async ({ request }) => {
    const tutor = await seedTutor({ status: "verified", fullName: FULL });
    await seedClass({ tutorId: tutor.id, hoursFromNow: 72 });

    for (const locale of ["fr", "ar"] as const) {
      const res = await request.get(`/${locale}/${tutor.slug}`);
      expect(res.status()).toBe(200);
      const html = await res.text();

      expect(html, `/${locale} storefront HTML`).not.toContain(SURNAME);
      expect(html).toContain(SHOWN);

      const ogTitle = metaContent(html, "property", "og:title");
      expect(ogTitle, "the WhatsApp preview title").toContain(SHOWN);
      expect(ogTitle).not.toContain(SURNAME);
      expect(metaContent(html, "name", "twitter:title")).toContain(SHOWN);
      expect(metaContent(html, "property", "profile:last_name"), "no og last name at all").toBeNull();

      const ld = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
      expect(ld, "JSON-LD is present").toContain('"Person"');
      expect(ld).toContain(`"name":"${SHOWN}"`);
      expect(ld).not.toContain(SURNAME);
    }
  });

  test("Explore, the class page and checkout show « Mohamed B. »", async ({ browser }) => {
    const tutor = await seedTutor({ status: "verified", fullName: FULL });
    const klass = await seedClass({ tutorId: tutor.id, hoursFromNow: 72 });
    const student = await seedProfile({ role: "student", birthYear: 1995 });
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    await ctx.addCookies([sessionCookie(await mintSession(student.id))]);
    const page = await ctx.newPage();

    await page.goto("/fr/explore");
    await page.locator('input[type="search"]').fill("Mohamed");
    const card = page.locator(`a[href="/fr/${tutor.slug}"]`).first();
    await expect(card).toContainText(SHOWN, { timeout: 15_000 });
    await expect(page.locator("main")).not.toContainText(SURNAME);

    await page.goto(`/fr/class/${klass.id}`);
    await expect(page.locator("main")).toContainText(SHOWN, { timeout: 15_000 });
    await expect(page.locator("main")).not.toContainText(SURNAME);

    await page.goto(`/fr/checkout?class=${klass.id}`);
    await expect(page.locator("main")).toContainText(SHOWN, { timeout: 15_000 });
    await expect(page.locator("main")).not.toContainText(SURNAME);
    await ctx.close();
  });
});
