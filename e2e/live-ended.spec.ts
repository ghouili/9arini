import { test, expect } from "@playwright/test";
import { sql } from "./support/db";
import { seedProfile, seedTutor, seedClass, seedBooking } from "./support/seed";
import { loginAs } from "./support/session";

/* phase-a lane L3 (A16) — the live page reads the class's REAL end, and a cancelled
   class has no room.

   "Live" was `start <= now`, so a class that ended hours ago still said "EN
   DIRECT"; and the join gate handed out the room of a class the tutor had
   cancelled. The API half is apps/api/test/reviews-live.test.ts.

   ADDED, never edited into an existing spec. */

async function bookedStudentOf(opts: { hoursFromNow: number; cancelled?: boolean }) {
  const tutor = await seedTutor({ status: "verified" });
  const klass = await seedClass({ tutorId: tutor.id, hoursFromNow: opts.hoursFromNow }); // 90 minutes
  if (opts.cancelled) await sql`update classes set status = 'cancelled' where id = ${klass.id}`;
  const student = await seedProfile({ role: "student", birthYear: 1990 });
  await seedBooking({ classId: klass.id, studentId: student.id });
  return { klass, student };
}

test("a class that ENDED is not 'EN DIRECT'", async ({ browser }) => {
  const s = await bookedStudentOf({ hoursFromNow: -3 }); // started 3h ago, 90 minutes long
  const ctx = await browser.newContext();
  await loginAs(ctx, s.student.id);
  const page = await ctx.newPage();
  await page.goto(`/fr/live/${s.klass.id}`);
  await expect(page.getByText("TERMINÉE")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("EN DIRECT")).toHaveCount(0);
  await ctx.close();
});

test("a class in progress IS 'EN DIRECT'", async ({ browser }) => {
  const s = await bookedStudentOf({ hoursFromNow: -0.25 }); // started 15 min ago
  const ctx = await browser.newContext();
  await loginAs(ctx, s.student.id);
  const page = await ctx.newPage();
  await page.goto(`/fr/live/${s.klass.id}`);
  await expect(page.getByText("EN DIRECT")).toBeVisible({ timeout: 15_000 });
  await ctx.close();
});

test("a CANCELLED class says so and offers no room", async ({ browser }) => {
  const s = await bookedStudentOf({ hoursFromNow: 1, cancelled: true });
  const ctx = await browser.newContext();
  await loginAs(ctx, s.student.id);
  const page = await ctx.newPage();
  await page.goto(`/fr/live/${s.klass.id}`);
  await expect(page.getByRole("heading", { name: "Cette séance a été annulée" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /Entrer dans la classe/ })).toHaveCount(0);
  await ctx.close();
});
