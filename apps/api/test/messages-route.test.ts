import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  startApp, stopApp, seedProfile, seedTutor, seedClass, seedBooking, login, call, sql, type App,
} from "./support/fx";

/* phase-a lane L1 — the messaging routes, driven through the real handlers.

   A20: what the READER is sent, not only what the sanitiser returns. The stored
   form is escaped; the API decodes it for the thread view, and apps/web renders it
   as a React text node, so the student reads exactly what the tutor typed. */

let app: App;
const profiles: string[] = [];

before(async () => {
  app = await startApp();
});

after(async () => {
  /* Rows fx.ts does not clean, children first. Threads and messages would cascade
     from the bookings fx deletes, but they are removed explicitly so nothing this
     file wrote depends on a cascade to disappear. */
  if (profiles.length) {
    await sql`delete from reports where subject_kind = 'message' and subject_id in (
                select m.id::text from messages m join message_threads t on t.id = m.thread_id
                where t.tutor_profile_id in ${sql(profiles)} or t.student_profile_id in ${sql(profiles)})`;
    await sql`delete from messages where thread_id in (
                select id from message_threads
                where tutor_profile_id in ${sql(profiles)} or student_profile_id in ${sql(profiles)})`;
    await sql`delete from message_threads
              where tutor_profile_id in ${sql(profiles)} or student_profile_id in ${sql(profiles)}`;
    await sql`delete from contact_leak_flags where profile_id in ${sql(profiles)}`;
    await sql`delete from rate_limits where key in ${sql(profiles.map((p) => `msg:send:${p}`))}`;
  }
  await stopApp(app);
});

/** A tutor, an adult student, a class and a booking between them, both signed in,
    and the thread opened. `classAt` lets a test put the class in the past. */
async function pair(opts: { classAt?: Date; durationMin?: number } = {}) {
  const tutor = await seedTutor();
  const klass = await seedClass({ tutorId: tutor.id, at: opts.classAt, durationMin: opts.durationMin });
  const student = await seedProfile({ role: "student", birthYear: 1995 });
  const booking = await seedBooking({ classId: klass.id, studentId: student.id });
  profiles.push(tutor.profileId, student.id);
  const tutorCookie = await login(tutor.profileId);
  const studentCookie = await login(student.id);
  const opened = await call(app, "POST", "/threads", studentCookie, { bookingId: booking.id });
  assert.equal(opened.body?.ok, true, opened.raw);
  return {
    tutor, klass, student, booking, tutorCookie, studentCookie,
    threadId: opened.body.threadId as string,
  };
}

describe("A20 — the reader sees exactly what was typed", () => {
  test("the report's case, a lone '<': 'si x < 5 alors' reaches the student intact", async () => {
    const p = await pair();
    const sent = await call(app, "POST", `/threads/${p.threadId}/messages`, p.tutorCookie, {
      body: "si x < 5 alors",
    });
    assert.equal(sent.body?.ok, true, sent.raw);
    const read = await call(app, "GET", `/threads/${p.threadId}`, p.studentCookie);
    assert.equal(read.body.messages[0].body, "si x < 5 alors");
  });

  test("'si x < 5 alors y > 2' reaches the student intact", async () => {
    const p = await pair();
    const sent = await call(app, "POST", `/threads/${p.threadId}/messages`, p.tutorCookie, {
      body: "si x < 5 alors y > 2",
    });
    assert.equal(sent.body?.ok, true, sent.raw);

    const read = await call(app, "GET", `/threads/${p.threadId}`, p.studentCookie);
    assert.equal(read.status, 200, read.raw);
    assert.equal(read.body.messages.length, 1, read.raw);
    assert.equal(read.body.messages[0].body, "si x < 5 alors y > 2");

    // …and the row itself holds no live markup: inert for any other consumer.
    const [row] = await sql<{ body: string }[]>`select body from messages where thread_id = ${p.threadId}`;
    assert.ok(!/[<>]/.test(row.body), `stored ${JSON.stringify(row.body)}`);
  });

  test("a script tag is delivered as the literal text, never as markup", async () => {
    const p = await pair();
    const typed = "<script>alert(1)</script> à jeudi";
    const sent = await call(app, "POST", `/threads/${p.threadId}/messages`, p.tutorCookie, { body: typed });
    assert.equal(sent.body?.ok, true, sent.raw);

    const [row] = await sql<{ body: string }[]>`select body from messages where thread_id = ${p.threadId}`;
    assert.ok(!/[<>]/.test(row.body), `a tag was persisted: ${JSON.stringify(row.body)}`);

    /* JSON carries the text; React renders it as a text node (UserText, no
       dangerouslySetInnerHTML anywhere in the thread views), so it shows, inert. */
    const read = await call(app, "GET", `/threads/${p.threadId}`, p.studentCookie);
    assert.equal(read.body.messages[0].body, typed);
  });
});
