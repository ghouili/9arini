import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { bookings } from "@tnajem/db";
import { startApp, stopApp, seedProfile, seedTutor, seedClass, login, call, sql, type App } from "./support/fx";
import { db } from "../src/db";
import { isUniqueViolation } from "../src/lib/db-errors";
import { BOOKING_CLASS_STUDENT_KEY } from "../src/routes/bookings";

/* phase-a lane L3 (A7) — a failed booking must never read as "Tu avais déjà cette place".

   POST /bookings caught EVERY error from the seat-claim transaction and answered
   { ok: true, already: true }. Only one error means that: Postgres 23505 on the
   bookings (class_id, student_id) unique key — a concurrent double-submit by the
   same student. Anything else (a dropped connection, a failed statement) must come
   back as a real failure, so the student is not told they hold a seat they don't.

   The DB error is forced with a BROKEN FIXTURE rather than a hook in the route: a
   trigger on `bookings`, scoped by its WHEN clause to one seeded class, raises inside
   the transaction. Nothing in production code can reach it. */

const RUN = randomBytes(4).toString("hex");
const FN = `fx_l3_a7_fail_${RUN}`;
const triggers: string[] = [];

/** Make every INSERT into bookings for `classId` raise inside the seat-claim tx. */
async function breakInsertsFor(classId: string, kind: "generic" | "other-unique"): Promise<void> {
  const name = `${FN}_${triggers.length}`;
  await sql.unsafe(
    `create trigger ${name} before insert on bookings for each row
       when (new.class_id = '${classId}'::uuid) execute function ${FN}('${kind}')`,
  );
  triggers.push(name);
}

let app: App;
before(async () => {
  app = await startApp();
  await sql.unsafe(`
    create or replace function ${FN}() returns trigger language plpgsql as $$
    begin
      if tg_argv[0] = 'other-unique' then
        -- A 23505 that is NOT the (class_id, student_id) key.
        raise exception using errcode = 'unique_violation',
          message = 'fx: a unique violation on some other key',
          constraint = 'fx_some_other_unique_key';
      end if;
      raise exception 'fx: forced failure inside the booking transaction';
    end $$`);
});
after(async () => {
  for (const t of triggers) await sql.unsafe(`drop trigger if exists ${t} on bookings`);
  await sql.unsafe(`drop function if exists ${FN}()`);
  await stopApp(app);
});

async function freshBooking() {
  const tutor = await seedTutor();
  const klass = await seedClass({ tutorId: tutor.id, seats: 5 });
  const student = await seedProfile({ role: "student", birthYear: 1990 });
  return { tutor, klass, student, cookie: await login(student.id) };
}

async function seatsTaken(classId: string): Promise<number> {
  const [row] = await sql<{ seats_taken: number }[]>`select seats_taken from classes where id = ${classId}`;
  return row.seats_taken;
}

describe("A7 · only the (class, student) unique key means 'already booked'", () => {
  test("a DB failure inside the transaction is a real failure, not { ok: true, already: true }", async () => {
    const { klass, student, cookie } = await freshBooking();
    await breakInsertsFor(klass.id, "generic");

    const res = await call(app, "POST", "/bookings", cookie, { classId: klass.id });
    assert.notDeepEqual(
      { ok: res.body?.ok, already: res.body?.already },
      { ok: true, already: true },
      `a failed booking answered "already booked": ${res.raw}`,
    );
    assert.equal(res.status, 500, res.raw);

    // The tx rolled back: no seat consumed, no booking row.
    assert.equal(await seatsTaken(klass.id), 0);
    const rows = await sql`select id from bookings where class_id = ${klass.id} and student_id = ${student.id}`;
    assert.equal(rows.length, 0);
  });

  test("a 23505 on a DIFFERENT unique key is not 'already booked' either", async () => {
    const { klass, cookie } = await freshBooking();
    await breakInsertsFor(klass.id, "other-unique");

    const res = await call(app, "POST", "/bookings", cookie, { classId: klass.id });
    assert.notEqual(res.body?.already, true, `answered "already booked": ${res.raw}`);
    assert.equal(res.status, 500, res.raw);
    assert.equal(await seatsTaken(klass.id), 0);
  });

  test("a genuine concurrent double-submit is still idempotent: one seat, every answer ok", async () => {
    const { klass, student, cookie } = await freshBooking();

    const results = await Promise.all(
      Array.from({ length: 6 }, () => call(app, "POST", "/bookings", cookie, { classId: klass.id })),
    );
    for (const r of results) {
      assert.equal(r.status, 200, r.raw);
      assert.equal(r.body.ok, true, r.raw);
    }
    assert.equal(results.filter((r) => r.body.already !== true).length, 1, "exactly one fresh booking");
    assert.equal(await seatsTaken(klass.id), 1);
    const rows = await sql`select id from bookings where class_id = ${klass.id} and student_id = ${student.id}`;
    assert.equal(rows.length, 1);
  });

  test("the constraint name the route keys on is the one Postgres actually reports", async () => {
    // Deterministic proof of the 23505 path the concurrent test can only usually reach:
    // a real duplicate insert through drizzle, the same way the route inserts.
    const { klass, student } = await freshBooking();
    await db.insert(bookings).values({ classId: klass.id, studentId: student.id, status: "reserved" });
    let caught: unknown = null;
    try {
      await db.insert(bookings).values({ classId: klass.id, studentId: student.id, status: "reserved" });
    } catch (e) {
      caught = e;
    }
    assert.ok(caught, "the duplicate insert must fail");
    assert.equal(isUniqueViolation(caught, BOOKING_CLASS_STUDENT_KEY), true);
    assert.equal(isUniqueViolation(caught, "fx_some_other_unique_key"), false);
  });
});
