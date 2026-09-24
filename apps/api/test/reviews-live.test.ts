import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  startApp, stopApp, seedProfile, seedTutor, seedClass, seedBooking, login, call, sql, type App,
} from "./support/fx";

/* phase-a lane L3 (A16) — reviews open when the class is OVER; a cancelled class
   has no room; a review error is the real error.

   POST /reviews refused only a class that had not STARTED, so a student could
   rate a 90-minute class one minute in. GET /classes/:id/join handed the room to a
   booked student (and the tutor) of a CANCELLED class. And every failure of the
   review insert was reported as "already-reviewed". */

const MIN = 60_000;
const RUN = randomBytes(4).toString("hex");
const FN = `fx_l3_a16_fail_${RUN}`;
const triggers: string[] = [];
const classIds: string[] = [];

let app: App;
before(async () => {
  app = await startApp();
  await sql.unsafe(`
    create or replace function ${FN}() returns trigger language plpgsql as $$
    begin
      raise exception 'fx: forced failure inside the review transaction';
    end $$`);
});
after(async () => {
  for (const t of triggers) await sql.unsafe(`drop trigger if exists ${t} on reviews`);
  await sql.unsafe(`drop function if exists ${FN}()`);
  if (classIds.length) await sql`delete from reviews where class_id in ${sql(classIds)}`;
  await stopApp(app);
});

async function bookedClass(opts: { at: Date; durationMin?: number; status?: string }) {
  const owner = await seedProfile({ role: "tutor", birthYear: 1985 });
  const tutor = await seedTutor({ profileId: owner.id });
  const klass = await seedClass({ tutorId: tutor.id, at: opts.at, durationMin: opts.durationMin ?? 90, status: opts.status });
  classIds.push(klass.id);
  const student = await seedProfile({ role: "student", birthYear: 1990 });
  await seedBooking({ classId: klass.id, studentId: student.id });
  return { owner, klass, student, cookie: await login(student.id) };
}

const review = (cookie: string, classId: string, rating = 5) =>
  call(app, "POST", "/reviews", cookie, { classId, rating, text: "Très clair." });

describe("A16 · reviews open after start + duration", () => {
  test("start + 1 min (a 90-minute class in progress) → refused", async () => {
    const s = await bookedClass({ at: new Date(Date.now() - 1 * MIN) });
    const res = await review(s.cookie, s.klass.id);
    assert.equal(res.body.ok, false, res.raw);
    assert.equal(res.body.error, "class-not-ended", res.raw);
  });

  test("end + 1 min → allowed", async () => {
    const s = await bookedClass({ at: new Date(Date.now() - 91 * MIN) });
    const res = await review(s.cookie, s.klass.id);
    assert.equal(res.body.ok, true, res.raw);
  });

  test("a class that has not started keeps its own answer", async () => {
    const s = await bookedClass({ at: new Date(Date.now() + 48 * 60 * MIN) });
    const res = await review(s.cookie, s.klass.id);
    assert.equal(res.body.error, "class-not-started", res.raw);
  });
});

describe("A16 · a review error is the real error", () => {
  test("a second review of the same class → already-reviewed", async () => {
    const s = await bookedClass({ at: new Date(Date.now() - 200 * MIN) });
    assert.equal((await review(s.cookie, s.klass.id)).body.ok, true);
    const again = await review(s.cookie, s.klass.id, 1);
    assert.equal(again.body.error, "already-reviewed", again.raw);
  });

  test("a DB failure is NOT reported as already-reviewed", async () => {
    const s = await bookedClass({ at: new Date(Date.now() - 200 * MIN) });
    const name = `${FN}_${triggers.length}`;
    await sql.unsafe(
      `create trigger ${name} before insert on reviews for each row
         when (new.class_id = '${s.klass.id}'::uuid) execute function ${FN}()`,
    );
    triggers.push(name);
    const res = await review(s.cookie, s.klass.id);
    assert.notEqual(res.body?.error, "already-reviewed", `a failure was reported as a duplicate: ${res.raw}`);
    assert.equal(res.status, 500, res.raw);
  });
});

describe("A16 · a cancelled class has no room", () => {
  test("a booked student of a CANCELLED class is refused, with no room URL", async () => {
    const s = await bookedClass({ at: new Date(Date.now() + 30 * MIN), status: "cancelled" });
    const res = await call(app, "GET", `/classes/${s.klass.id}/join`, s.cookie);
    assert.equal(res.body.canJoin, false, res.raw);
    assert.equal(res.body.reason, "cancelled", res.raw);
    assert.equal(res.body.meetUrl, undefined);
  });

  test("so is its tutor", async () => {
    const s = await bookedClass({ at: new Date(Date.now() + 30 * MIN), status: "cancelled" });
    const res = await call(app, "GET", `/classes/${s.klass.id}/join`, await login(s.owner.id));
    assert.equal(res.body.canJoin, false, res.raw);
    assert.equal(res.body.meetUrl, undefined);
  });

  test("a scheduled class still opens for its booked student", async () => {
    const s = await bookedClass({ at: new Date(Date.now() + 30 * MIN) });
    const res = await call(app, "GET", `/classes/${s.klass.id}/join`, s.cookie);
    assert.equal(res.body.canJoin, true, res.raw);
  });
});
