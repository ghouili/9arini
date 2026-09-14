import { test, expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { sql } from "./support/db";
import { seedTutor, seedClass, seedProfile, seedBooking } from "./support/seed";

/* ════════════════════════════════════════════════════════════════════════════
   One tutor, one history — on /explore and on the storefront.

   On 14 Sept a tutor's /explore card said "4,9 (37 avis) · 1 240", the header of
   their own page said "Nouveau prof · 1 240 élèves", and the reviews panel under
   it said "Pas encore d'avis". Both surfaces now render the same TutorStanding
   through the same component, built from the reviews table.

   Each test reads BOTH surfaces for the SAME seeded tutor and requires them to
   agree. A fresh tutor per test: the storefront read is cached for 60s, so a
   review inserted after the first request would not show (e2e/isr.spec.ts).

   ADDED, never edited into an existing spec. */

async function exploreCard(page: Page, name: string) {
  await page.goto("/fr/explore");
  await page.getByRole("searchbox").fill(name);
  const card = page.locator("a.u-card", { hasText: name });
  await expect(card, `the /explore card for ${name} must appear`).toHaveCount(1, { timeout: 15_000 });
  return card;
}

test("no reviews: 'Nouveau prof' on both surfaces, and no student count anywhere", async ({ page }) => {
  const name = `Standing New ${randomBytes(4).toString("hex")}`;
  const tutor = await seedTutor({ status: "verified", fullName: name });
  // A student-count mirror with no reviews behind it — exactly the 14 Sept shape.
  await sql`update tutors set students_count = 1240, rating = 4.9 where id = ${tutor.id}`;

  await page.goto(`/fr/${tutor.slug}`);
  const hero = page.locator(".sf-hero-meta");
  await expect(hero, "storefront header").toHaveText("Nouveau prof");
  await expect(page.locator("main"), "the reviews panel agrees").toContainText("Pas encore d'avis");
  expect(await page.locator("main").innerText(), "no student count may render for a new tutor").not.toMatch(
    /1[\s ,.]?240/,
  );

  const card = await exploreCard(page, name);
  await expect(card, "the /explore card says the same thing").toContainText("Nouveau prof");
  expect(await card.innerText(), "no rating and no student count on the card").not.toMatch(/4[.,]9|1[\s ,.]?240|avis/);
});

test("with a review: the same rating, review count and student count on both surfaces", async ({ page }) => {
  const name = `Standing Rated ${randomBytes(4).toString("hex")}`;
  const tutor = await seedTutor({ status: "verified", fullName: name });
  const klass = await seedClass({ tutorId: tutor.id, hoursFromNow: -48 });
  const student = await seedProfile({ role: "student", fullName: "Sarra Mejri" });
  await seedBooking({ classId: klass.id, studentId: student.id, status: "attended" });
  await sql`insert into reviews (id, tutor_id, student_id, class_id, rating, text)
            values (gen_random_uuid(), ${tutor.id}, ${student.id}, ${klass.id}, 4, 'Très clair.')`;
  await sql`update tutors set students_count = 3 where id = ${tutor.id}`;

  await page.goto(`/fr/${tutor.slug}`);
  const hero = page.locator(".sf-hero-meta");
  await expect(hero).toContainText("4,0");
  await expect(hero).toContainText("(1 avis)");
  await expect(hero).toContainText("3 élèves");
  await expect(hero, "a rated tutor is not new").not.toContainText("Nouveau");

  const card = await exploreCard(page, name);
  await expect(card).toContainText("4,0");
  await expect(card).toContainText("(1 avis)");
  await expect(card).toContainText("3 élèves");
  await expect(card).not.toContainText("Nouveau");
});
