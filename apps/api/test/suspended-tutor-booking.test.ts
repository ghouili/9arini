import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApp, stopApp, seedProfile, seedTutor, seedClass, login, call, sql, type App } from "./support/fx";

/* phase-a/verify-fix (D7). §2 must-not-break: "the server refuses bookings for …
   suspended tutors". Until now only an indirect test existed: blocking a tutor
   CANCELS their classes first, so the class status answered, never the suspension
   guard in POST /bookings. This books a still-SCHEDULED class of a verified tutor
   whose storefront is suspended, and must be refused with the seat untouched. */

let app: App;
before(async () => {
  app = await startApp();
});
after(async () => {
  await stopApp(app);
});

describe("§2 — a suspended tutor's scheduled class cannot be booked", () => {
  test("POST /bookings → unavailable, and no seat is claimed", async () => {
    const tutor = await seedTutor({ status: "verified" });
    const klass = await seedClass({ tutorId: tutor.id });
    await sql`update tutors set suspended_at = now() where id = ${tutor.id}`;
    const student = await seedProfile({ role: "student" });

    const res = await call(app, "POST", "/bookings", await login(student.id), { classId: klass.id });
    assert.deepEqual(res.body, { ok: false, error: "unavailable" }, res.raw);

    const [row] = await sql<{ seats_taken: number; status: string }[]>`select seats_taken, status from classes where id = ${klass.id}`;
    assert.equal(row.status, "scheduled", "the class itself is still scheduled — only the suspension can refuse it");
    assert.equal(row.seats_taken, 0);
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int n from bookings where class_id = ${klass.id}`;
    assert.equal(n, 0);
  });
});
