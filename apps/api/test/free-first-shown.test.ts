import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApp, stopApp, seedProfile, seedTutor, seedClass, login, call, sql, type App } from "./support/fx";

/* phase-a/integrate (A6 × D2, found by lane L6). The free first session is given
   once per student per tutor, and POST /bookings enforces it — but GET /classes/:id
   (the class page and checkout) still said "1ʳᵉ séance gratuite" to a student who
   had already had theirs. The page promised what the booking then refused. */

let app: App;
before(async () => {
  app = await startApp();
});
after(async () => {
  await stopApp(app);
});

describe("the class page promises the free first session only to a student who still has it", () => {
  test("after a free booking with a tutor, that tutor's next free-first class is not shown as free to that student", async () => {
    const tutor = await seedTutor({ offersFreeFirstSession: true });
    const first = await seedClass({ tutorId: tutor.id, isFreeFirst: true });
    const second = await seedClass({ tutorId: tutor.id, isFreeFirst: true, hoursFromNow: 96 });
    const student = await seedProfile({ role: "student" });
    const cookie = await login(student.id);

    const booked = await call(app, "POST", "/bookings", cookie, { classId: first.id });
    assert.equal(booked.body.ok, true, booked.raw);
    const [bk] = await sql<{ is_free: boolean }[]>`select is_free from bookings where class_id = ${first.id} and student_id = ${student.id}`;
    assert.equal(bk.is_free, true, "the first booking took the free session");

    const secondAsStudent = await call(app, "GET", `/classes/${second.id}`, cookie);
    assert.equal(secondAsStudent.body.is_free_first, false, `already used with this tutor: ${secondAsStudent.raw}`);

    const firstAsStudent = await call(app, "GET", `/classes/${first.id}`, cookie);
    assert.equal(firstAsStudent.body.is_free_first, true, "their own free seat is still shown as free");

    const anonymous = await call(app, "GET", `/classes/${second.id}`, null);
    assert.equal(anonymous.body.is_free_first, true, "a signed-out visitor sees the class's offer");

    const other = await seedProfile({ role: "student" });
    const otherView = await call(app, "GET", `/classes/${second.id}`, await login(other.id));
    assert.equal(otherView.body.is_free_first, true, "another student still has theirs");

    const tutorView = await call(app, "GET", `/classes/${second.id}`, await login(tutor.profileId));
    assert.equal(tutorView.body.is_free_first, true, "the tutor sees their own offer");
  });
});
