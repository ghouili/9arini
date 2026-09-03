import { test, expect } from "@playwright/test";
import { sql } from "./support/db";
import { resetRateLimits } from "./support/otp";
import { seedProfile, seedTutor, seedClass } from "./support/seed";
import { mintSession, sessionCookie } from "./support/session";

/* The durable, cross-instance rate limiter.

   This spec exists because the limiter was silently broken: rateLimitDb()
   interpolated a JS Date into a raw sql`` template, postgres.js threw
   ERR_INVALID_ARG_TYPE on every upsert, and the catch fell back to the
   in-process limiter. Fail-open by design, so nothing surfaced -- the
   rate_limits table simply stayed empty while everyone believed the limiter was
   durable. It only showed up when this suite started reading the server log.

   Asserting that ROWS ARE WRITTEN is the only thing that catches that class of
   bug. Asserting "the request was throttled" would have passed the whole time,
   served by the in-process fallback.

   It matters for Step 3: the limiter has to survive the move to Fastify, where
   there is no shared process memory to fall back to. */

test("a booking writes a durable rate_limits row", async ({ browser }) => {
  await resetRateLimits();

  const tutor = await seedTutor({ status: "verified" });
  const klass = await seedClass({ tutorId: tutor.id, seats: 5, hoursFromNow: 96 });
  const student = await seedProfile({ role: "student", birthYear: 1990 });

  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  await ctx.addCookies([sessionCookie(await mintSession(student.id))]);
  const page = await ctx.newPage();

  await page.goto(`/fr/checkout?class=${klass.id}`);
  await page.locator("button.ck-cta").click();

  // The booking lands...
  await expect.poll(async () => {
    const [b] = await sql<{ n: number }[]>`
      select count(*)::int n from bookings where class_id = ${klass.id}`;
    return b.n;
  }, { timeout: 15_000 }).toBe(1);

  // ...and reserveSeat's checkRateLimit("book:<uid>") persisted a row.
  const rows = await sql<{ key: string; count: number; reset_at: Date }[]>`
    select key, count, reset_at from rate_limits where key like ${"book:%"}`;

  expect(rows.length,
    "rate_limits is empty — rateLimitDb() is silently falling back to in-process again"
  ).toBeGreaterThan(0);

  const row = rows[0];
  expect(row.count).toBeGreaterThanOrEqual(1);
  expect(row.reset_at.getTime(),
    "the window must be in the future, computed from the database clock"
  ).toBeGreaterThan(Date.now() - 5_000);

  await ctx.close();
});
