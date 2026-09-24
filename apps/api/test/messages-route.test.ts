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
    await sql`delete from guardian_links
              where guardian_profile_id in ${sql(profiles)} or minor_profile_id in ${sql(profiles)}`;
    await sql`delete from consents where minor_id in ${sql(profiles)}`;
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

/* ══════════════════════════════════════════════════════════════════════════════
   A2 — CONVERSATIONS CLOSE (CEO report, finding 2).

   Sending used to be refused only when the booking was cancelled, so a tutor could
   keep writing to a minor through a past class's thread indefinitely — after the
   parent withdrew consent, after either account was blocked. Each test below sends
   into a thread that should be closed and expects a refusal; the history must stay
   readable and reportable.
   ══════════════════════════════════════════════════════════════════════════════ */

const DAY = 86_400_000;
const CLOSE_DAYS = 7; // THREAD_CLOSE_DAYS, FOUNDER default — pinned here on purpose.

const send = (p: { threadId: string }, cookie: string, body = "Bonjour, une question ?") =>
  call(app, "POST", `/threads/${p.threadId}/messages`, cookie, { body });

/** The server's own verdict, with its reason (loaded lazily: it is the fix). */
async function reasonOf(threadId: string): Promise<string> {
  const { threadState } = await import("../src/lib/thread-state");
  return threadState(threadId);
}

async function messageCount(threadId: string): Promise<number> {
  const [r] = await sql<{ n: number }[]>`select count(*)::int as n from messages where thread_id = ${threadId}`;
  return r.n;
}

/** A minor, their guardian (consent names the guardian's e-mail), a tutor and a
    class that ENDED two days ago — inside the 7-day window, so only the consent
    can close it. A past class also means withdrawal releases no booking, which is
    exactly the gap: an upcoming seat was already released and closed its thread. */
async function minorFamily() {
  const tutor = await seedTutor();
  const klass = await seedClass({ tutorId: tutor.id, at: new Date(Date.now() - 2 * DAY) });
  const child = await seedProfile({ role: "student", birthYear: new Date().getFullYear() - 15 });
  const parent = await seedProfile({ role: "guardian", birthYear: 1980 });
  profiles.push(tutor.profileId, child.id, parent.id);
  await sql`insert into consents (minor_id, guardian_name, guardian_phone, guardian_email, consent_text, policy_version)
            values (${child.id}, 'FX Parent', '+21620000000', ${parent.email}, 'Seeded by an API test.', 'fx')`;
  const booking = await seedBooking({ classId: klass.id, studentId: child.id });
  const tutorCookie = await login(tutor.profileId);
  const childCookie = await login(child.id);
  const parentCookie = await login(parent.id);
  const opened = await call(app, "POST", "/threads", childCookie, { bookingId: booking.id });
  assert.equal(opened.body?.ok, true, opened.raw);
  return { tutor, klass, child, parent, booking, tutorCookie, childCookie, parentCookie, threadId: opened.body.threadId as string };
}

describe("A2 — a closed conversation refuses new messages", () => {
  test("(a) the class ended more than THREAD_CLOSE_DAYS ago: both sides are refused", async () => {
    const p = await pair({ classAt: new Date(Date.now() - 3 * DAY) });
    assert.equal((await send(p, p.tutorCookie)).body?.ok, true, "open while inside the window");

    // Time passes: the class now ended CLOSE_DAYS + 1 days ago.
    await sql`update classes set scheduled_at = ${new Date(Date.now() - (CLOSE_DAYS + 1) * DAY).toISOString()} where id = ${p.klass.id}`;

    const fromTutor = await send(p, p.tutorCookie, "Tu es libre ce soir ?");
    assert.deepEqual(fromTutor.body, { ok: false, error: "thread-closed" }, fromTutor.raw);
    const fromStudent = await send(p, p.studentCookie, "Oui");
    assert.deepEqual(fromStudent.body, { ok: false, error: "thread-closed" }, fromStudent.raw);
    assert.equal(await messageCount(p.threadId), 1, "nothing was written after closing");
    assert.equal(await reasonOf(p.threadId), "closed:class-ended");
  });

  test("(a) the window is counted from the END of the class, not its start", async () => {
    // Started CLOSE_DAYS days ago minus 30 min, lasts 90 min: ended < CLOSE_DAYS days ago.
    const p = await pair({ classAt: new Date(Date.now() - CLOSE_DAYS * DAY + 30 * 60_000), durationMin: 90 });
    const res = await send(p, p.studentCookie);
    assert.equal(res.body?.ok, true, res.raw);
    assert.equal(await reasonOf(p.threadId), "open");
  });

  test("(b) the guardian withdrew consent: closed immediately", async () => {
    const f = await minorFamily();
    assert.equal((await send(f, f.tutorCookie)).body?.ok, true, "open while consent stands");

    const withdrawn = await call(app, "POST", `/guardian/children/${f.child.id}/consent/withdraw`, f.parentCookie, {});
    assert.equal(withdrawn.body?.ok, true, withdrawn.raw);
    // The class is past, so withdrawal released no seat: the booking is still live.
    const [bk] = await sql<{ status: string }[]>`select status from bookings where id = ${f.booking.id}`;
    assert.notEqual(bk.status, "cancelled");

    const res = await send(f, f.tutorCookie, "Tu peux quand même m'écrire ?");
    assert.deepEqual(res.body, { ok: false, error: "thread-closed" }, res.raw);
    const fromChild = await send(f, f.childCookie, "…");
    assert.deepEqual(fromChild.body, { ok: false, error: "thread-closed" }, fromChild.raw);
    assert.equal(await messageCount(f.threadId), 1);
    assert.equal(await reasonOf(f.threadId), "closed:consent-withdrawn");
  });

  test("(c) the tutor's account is blocked: the student cannot send", async () => {
    const p = await pair();
    assert.equal((await send(p, p.studentCookie)).body?.ok, true);
    await sql`update profiles set blocked_at = now() where id = ${p.tutor.profileId}`;
    const res = await send(p, p.studentCookie, "Allô ?");
    assert.deepEqual(res.body, { ok: false, error: "thread-closed" }, res.raw);
    assert.equal(await reasonOf(p.threadId), "closed:blocked");
  });

  test("(c) the student's account is blocked: the tutor cannot send", async () => {
    const p = await pair();
    assert.equal((await send(p, p.tutorCookie)).body?.ok, true);
    await sql`update profiles set blocked_at = now() where id = ${p.student.id}`;
    const res = await send(p, p.tutorCookie, "Tu es là ?");
    assert.deepEqual(res.body, { ok: false, error: "thread-closed" }, res.raw);
    assert.equal(await reasonOf(p.threadId), "closed:blocked");
  });

  test("(c) a suspended storefront closes the tutor's threads too", async () => {
    const p = await pair();
    await sql`update tutors set suspended_at = now() where id = ${p.tutor.id}`;
    const res = await send(p, p.studentCookie);
    assert.deepEqual(res.body, { ok: false, error: "thread-closed" }, res.raw);
    assert.equal(await reasonOf(p.threadId), "closed:blocked");
  });

  test("a cancelled booking still answers booking-cancelled (the existing contract)", async () => {
    const p = await pair();
    await sql`update bookings set status = 'cancelled' where id = ${p.booking.id}`;
    const res = await send(p, p.tutorCookie);
    assert.deepEqual(res.body, { ok: false, error: "booking-cancelled" }, res.raw);
    assert.equal(await reasonOf(p.threadId), "closed:booking-cancelled");
  });
});

describe("A2 — a closed conversation stays readable and reportable", () => {
  test("both parties read it, see it is closed, and can still report", async () => {
    const p = await pair({ classAt: new Date(Date.now() - 2 * DAY) });
    const sent = await send(p, p.tutorCookie, "Message douteux.");
    assert.equal(sent.body?.ok, true, sent.raw);
    const open = await call(app, "GET", `/threads/${p.threadId}`, p.studentCookie);
    assert.equal(open.body.state, "open", open.raw);

    await sql`update classes set scheduled_at = ${new Date(Date.now() - (CLOSE_DAYS + 2) * DAY).toISOString()} where id = ${p.klass.id}`;

    for (const cookie of [p.studentCookie, p.tutorCookie]) {
      const read = await call(app, "GET", `/threads/${p.threadId}`, cookie);
      assert.equal(read.status, 200, read.raw);
      assert.equal(read.body.messages.length, 1, read.raw);
      assert.equal(read.body.state, "closed:class-ended", read.raw);
    }

    const reported = await call(app, "POST", `/messages/${sent.body.id}/report`, p.studentCookie, { reason: "inapproprié" });
    assert.equal(reported.body?.ok, true, reported.raw);
    const [n] = await sql<{ n: number }[]>`select count(*)::int as n from message_reports where message_id = ${sent.body.id}`;
    assert.equal(n.n, 1);
  });

  test("the tutor can report the student's message after closing, too", async () => {
    const p = await pair();
    const sent = await send(p, p.studentCookie, "Réponds-moi ailleurs.");
    await sql`update profiles set blocked_at = now() where id = ${p.student.id}`;
    const reported = await call(app, "POST", `/messages/${sent.body.id}/report`, p.tutorCookie, {});
    assert.equal(reported.body?.ok, true, reported.raw);
    const read = await call(app, "GET", `/threads/${p.threadId}`, p.tutorCookie);
    assert.equal(read.body.messages.length, 1);
    // A block is never named to the other side.
    assert.equal(read.body.state, "closed", read.raw);
  });

  test("after withdrawing consent the guardian still reads the thread, the child still reports", async () => {
    const f = await minorFamily();
    const sent = await send(f, f.tutorCookie, "On se parle sur WhatsApp ?");
    assert.equal(sent.body?.ok, true, sent.raw);
    await call(app, "POST", `/guardian/children/${f.child.id}/consent/withdraw`, f.parentCookie, {});

    const asParent = await call(app, "GET", `/guardian/threads/${f.threadId}`, f.parentCookie);
    assert.equal(asParent.status, 200, asParent.raw);
    assert.equal(asParent.body?.messages?.length, 1, asParent.raw);
    assert.equal(asParent.body.state, "closed", asParent.raw);

    const asTutor = await call(app, "GET", `/threads/${f.threadId}`, f.tutorCookie);
    assert.equal(asTutor.body.messages.length, 1);
    assert.equal(asTutor.body.state, "closed", "the tutor is never told consent was withdrawn");
    assert.ok(!asTutor.raw.includes("consent"), asTutor.raw);

    const reported = await call(app, "POST", `/messages/${sent.body.id}/report`, f.childCookie, {});
    assert.equal(reported.body?.ok, true, reported.raw);
  });
});
