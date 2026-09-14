import { test, expect } from "@playwright/test";
import { sql } from "./support/db";
import { seedTutor, seedClass } from "./support/seed";

/* ════════════════════════════════════════════════════════════════════════════
   User-authored text takes its direction from its own first letter.

   On 14 Sept a French bio on /ar/yassine-math rendered "» … « .ton rythme":
   only <html dir="rtl"> and one link carried a direction, so the bio's neutral
   characters followed the Arabic page. User text now renders through
   components/UserText.tsx (dir="auto"). This pins the behaviour, not the
   attribute alone: the COMPUTED direction of each field, in both directions.

   ADDED, never edited into an existing spec. */

test("a French bio, name and class title read LTR on the Arabic storefront", async ({ page }) => {
  const tutor = await seedTutor({ status: "verified", fullName: "Bidi Latin Tutor" });
  await sql`update tutors set bio = ${"« On révise à ton rythme. Méthodes, annales : tout y passe. »"} where id = ${tutor.id}`;
  await seedClass({ tutorId: tutor.id, hoursFromNow: 72 });

  await page.goto(`/ar/${tutor.slug}`);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  for (const sel of [".sf-bio", ".sf-name-txt", ".sf-subject", ".sf-classes .sf-row-title"]) {
    const el = page.locator(sel).first();
    await expect(el, `${sel} must carry dir="auto"`).toHaveAttribute("dir", "auto");
    expect(await el.evaluate((n) => getComputedStyle(n).direction), `${sel} is French → LTR`).toBe("ltr");
  }
});

test("an Arabic bio reads RTL, on the French storefront too", async ({ page }) => {
  const tutor = await seedTutor({ status: "verified", fullName: "ليلى بن عمر" });
  await sql`update tutors set bio = ${"« القواعد قبل كل شي. بالصبر، بالدارجة. »"} where id = ${tutor.id}`;

  await page.goto(`/fr/${tutor.slug}`);
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

  for (const sel of [".sf-bio", ".sf-name-txt"]) {
    const el = page.locator(sel).first();
    await expect(el).toHaveAttribute("dir", "auto");
    expect(await el.evaluate((n) => getComputedStyle(n).direction), `${sel} is Arabic → RTL`).toBe("rtl");
  }
});
