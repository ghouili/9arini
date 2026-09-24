import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApp, stopApp, seedProfile, seedTutor, seedClass, login, call, sql, type App } from "./support/fx";

/* The route-test fixtures work end to end: a seeded adult student, holding a session
   minted by support/fx, books a seeded class through the real handler and the seat
   is claimed in the database. If this fails, every route test built on fx is suspect. */

let app: App;
before(async () => {
  app = await startApp();
});
after(async () => {
  await stopApp(app);
});

describe("support/fx", () => {
  test("a seeded student books a seeded class through POST /bookings", async () => {
    const tutor = await seedTutor();
    const klass = await seedClass({ tutorId: tutor.id });
    const student = await seedProfile({ role: "student", birthYear: 1990 });
    const cookie = await login(student.id);

    const res = await call(app, "POST", "/bookings", cookie, { classId: klass.id });
    assert.equal(res.status, 200, res.raw);
    assert.equal(res.body.ok, true, res.raw);

    const [row] = await sql<{ seats_taken: number }[]>`select seats_taken from classes where id = ${klass.id}`;
    assert.equal(row.seats_taken, 1);
  });

  test("no session → not-authenticated", async () => {
    const tutor = await seedTutor();
    const klass = await seedClass({ tutorId: tutor.id });
    const res = await call(app, "POST", "/bookings", null, { classId: klass.id });
    assert.equal(res.body.error, "not-authenticated");
  });
});
