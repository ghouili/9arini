import { test, expect, type Page } from "@playwright/test";
import { sql } from "./support/db";
import { seedProfile, seedTutor, seedClass, seedBooking } from "./support/seed";
import { mintSession, sessionCookie } from "./support/session";

/* ════════════════════════════════════════════════════════════════════════════
   Every class date on screen is a <time> with the real instant in datetime.

   On 14 Sept the storefront had zero <time> elements: "23 JUIN · 18:00" was
   display text a machine could not read. The datetime of each <time> must be the
   class's own scheduled_at — not a re-parse of the display strings.

   ADDED, never edited into an existing spec. */

async function startsAt(classId: string): Promise<string> {
  const [row] = await sql<{ scheduled_at: Date }[]>`select scheduled_at from classes where id = ${classId}`;
  return new Date(row.scheduled_at).toISOString();
}

async function datetimes(page: Page): Promise<string[]> {
  return page.locator("time").evaluateAll((els) => els.map((e) => e.getAttribute("datetime") ?? ""));
}

test("storefront: one <time> per date and per time shown, each the class's real instant", async ({ page }) => {
  const tutor = await seedTutor({ status: "verified" });
  const a = await seedClass({ tutorId: tutor.id, hoursFromNow: 30 });
  const b = await seedClass({ tutorId: tutor.id, hoursFromNow: 80 });
  const [isoA, isoB] = [await startsAt(a.id), await startsAt(b.id)];

  await page.goto(`/fr/${tutor.slug}`);
  await expect(page.locator(".sf-classes .sf-row")).toHaveCount(2);

  const values = await datetimes(page);
  /* Per row: the date thumb and the start time. Plus the "Prochaine séance"
     panel. No reviews on this tutor, so no review dates. */
  expect(values.length, "2 rows × (date + time) + the next-session panel").toBe(5);
  for (const v of values) expect(Number.isNaN(Date.parse(v)), `"${v}" must be a valid ISO instant`).toBe(false);
  expect(values.filter((v) => v === isoA).length, "the sooner class: thumb, time, and the panel").toBe(3);
  expect(values.filter((v) => v === isoB).length, "the later class: thumb and time").toBe(2);
});

test("class page and checkout mark up the class date", async ({ browser }) => {
  const tutor = await seedTutor({ status: "verified" });
  const klass = await seedClass({ tutorId: tutor.id, hoursFromNow: 50 });
  const iso = await startsAt(klass.id);
  const student = await seedProfile({ role: "student", birthYear: 1990 });
  const ctx = await browser.newContext();
  await ctx.addCookies([sessionCookie(await mintSession(student.id))]);
  const page = await ctx.newPage();

  await page.goto(`/fr/class/${klass.id}`);
  await expect(page.locator(`time[datetime="${iso}"]`).first()).toBeVisible();
  expect((await datetimes(page)).every((v) => v === iso), "every <time> on the class page is this class").toBe(true);

  await page.goto(`/fr/checkout?class=${klass.id}`);
  await expect(page.locator(`time[datetime="${iso}"]`).first()).toBeVisible();
  await ctx.close();
});

test("tutor dashboard and student space mark up their class dates", async ({ browser }) => {
  const tutorProfile = await seedProfile({ role: "tutor", birthYear: 1984 });
  const tutor = await seedTutor({ profileId: tutorProfile.id, status: "verified" });
  const klass = await seedClass({ tutorId: tutor.id, hoursFromNow: 40 });
  const iso = await startsAt(klass.id);
  const student = await seedProfile({ role: "student", birthYear: 1990 });
  await seedBooking({ classId: klass.id, studentId: student.id, status: "reserved" });

  const tutorCtx = await browser.newContext();
  await tutorCtx.addCookies([sessionCookie(await mintSession(tutorProfile.id))]);
  const dash = await tutorCtx.newPage();
  await dash.goto("/fr/dashboard");
  await expect(dash.locator(`time[datetime="${iso}"]`).first(), "the dashboard class list").toBeVisible({ timeout: 15_000 });
  await tutorCtx.close();

  const studentCtx = await browser.newContext();
  await studentCtx.addCookies([sessionCookie(await mintSession(student.id))]);
  const mine = await studentCtx.newPage();
  await mine.goto("/fr/student");
  await expect(mine.locator(`time[datetime="${iso}"]`).first(), "the student's upcoming class").toBeVisible({ timeout: 15_000 });
  await studentCtx.close();
});
