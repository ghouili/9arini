import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  startApp, stopApp, seedProfile, seedTutor, seedClass, login, call, sql, type App,
  fxClientIp, fxSignupEmail, otpVerify, tunisMonthsAgo, cleanupIp,
} from "./support/fx";

/* A24 · ADULT-ONLY PILOT (decision D6).

   While ALLOW_MINORS !== "1" — the default — the server refuses a minor at every
   sign-up path (the "J'ai déjà un code" link included) and at every booking, and
   an existing minor account can still sign in. The age is birth MONTH + year, in
   Africa/Tunis, and a missing month counts as a minor.

   With ALLOW_MINORS=1 the guardian-consent machinery is exactly what it was, and
   is now month-aware.

   The switch is read per call, so these tests toggle process.env inside the test
   and put it back. */

const IP = fxClientIp();
let app: App;
const minorIds: string[] = [];

const _17y11m = () => tunisMonthsAgo(17 * 12 + 11);
const _18y1m = () => tunisMonthsAgo(18 * 12 + 1);
const _15y = () => tunisMonthsAgo(15 * 12);

async function withMinorsAllowed<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.env.ALLOW_MINORS;
  process.env.ALLOW_MINORS = "1";
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.ALLOW_MINORS;
    else process.env.ALLOW_MINORS = prev;
  }
}

async function profileByEmail(email: string) {
  const [row] = await sql<{ id: string }[]>`select id from profiles where email = ${email}`;
  return row ?? null;
}

async function giveConsent(minorId: string) {
  await sql`insert into consents (minor_id, guardian_name, guardian_phone, guardian_email, consent_text, policy_version)
            values (${minorId}, 'Parent Test', '+21620000000', ${`parent-${minorId}@tnajem.invalid`}, 'test', 'test')`;
}

before(async () => {
  delete process.env.ALLOW_MINORS; // the default posture
  app = await startApp();
});

after(async () => {
  if (minorIds.length) {
    await sql`delete from notifications where profile_id in ${sql(minorIds)}`;
    await sql`delete from consents where minor_id in ${sql(minorIds)}`;
  }
  await cleanupIp(IP);
  await stopApp(app);
});

describe("A24 · sign-up refuses minors while ALLOW_MINORS is off", () => {
  test("a student at 17 years 11 months (birth year = this year − 18, month later) is refused", async () => {
    const identifier = fxSignupEmail();
    const { year, month } = _17y11m();
    const res = await otpVerify(app, IP, { identifier, role: "student", birthYear: year, birthMonth: month });
    assert.equal(res.body.ok, false, res.raw);
    assert.equal(res.body.error, "adults-only", res.raw);
    assert.equal(await profileByEmail(identifier), null, "no account is created for a refused minor");
  });

  test("the \"J'ai déjà un code\" path with no birth date is refused", async () => {
    const identifier = fxSignupEmail();
    const res = await otpVerify(app, IP, { identifier, role: "student" });
    assert.equal(res.body.ok, false, res.raw);
    assert.equal(res.body.error, "birth-date-required", res.raw);
    assert.equal(await profileByEmail(identifier), null);
  });

  test("a birth year without a month is refused (a missing month is never waved through)", async () => {
    const identifier = fxSignupEmail();
    const res = await otpVerify(app, IP, { identifier, role: "student", birthYear: 1990 });
    assert.equal(res.body.ok, false, res.raw);
    assert.equal(res.body.error, "birth-date-required", res.raw);
    assert.equal(await profileByEmail(identifier), null);
  });

  test("an adult (18 years 1 month) signs up, and the month is stored", async () => {
    const identifier = fxSignupEmail();
    const { year, month } = _18y1m();
    const res = await otpVerify(app, IP, { identifier, role: "student", birthYear: year, birthMonth: month });
    assert.equal(res.body.ok, true, res.raw);
    assert.equal(res.body.created, true, res.raw);
    assert.equal(res.body.needsConsent, false, res.raw);
    const [row] = await sql<{ birth_year: number; birth_month: number }[]>`
      select birth_year, birth_month from profiles where email = ${identifier}`;
    assert.deepEqual({ y: row.birth_year, m: row.birth_month }, { y: year, m: month });
  });
});

describe("A24 · an existing minor can sign in, but cannot book", () => {
  test("sign-in works; POST /bookings is refused even WITH a guardian consent on file", async () => {
    const minor = await seedProfile({ role: "student", birthYear: _15y().year });
    minorIds.push(minor.id);
    await giveConsent(minor.id);

    const signIn = await otpVerify(app, IP, { identifier: minor.email });
    assert.equal(signIn.body.ok, true, `an existing minor account still signs in: ${signIn.raw}`);

    const tutor = await seedTutor();
    const klass = await seedClass({ tutorId: tutor.id });
    const res = await call(app, "POST", "/bookings", await login(minor.id), { classId: klass.id });
    assert.equal(res.body.ok, false, res.raw);
    assert.equal(res.body.error, "adults-only", res.raw);
    const [c] = await sql<{ seats_taken: number }[]>`select seats_taken from classes where id = ${klass.id}`;
    assert.equal(c.seats_taken, 0, "no seat was claimed");
  });
});

describe("A24 · with ALLOW_MINORS=1 the guardian gate is intact (and month-aware)", () => {
  test("a 17-year-11-month sign-up is accepted and owes a guardian consent", async () => {
    await withMinorsAllowed(async () => {
      const identifier = fxSignupEmail();
      const { year, month } = _17y11m();
      const res = await otpVerify(app, IP, { identifier, role: "student", birthYear: year, birthMonth: month });
      assert.equal(res.body.ok, true, res.raw);
      assert.equal(res.body.needsConsent, true, `a 17-year-old is a minor, whatever the year says: ${res.raw}`);
      const p = await profileByEmail(identifier);
      if (p) minorIds.push(p.id);
    });
  });

  test("a minor books only with a guardian consent on file", async () => {
    await withMinorsAllowed(async () => {
      const minor = await seedProfile({ role: "student", birthYear: _15y().year });
      minorIds.push(minor.id);
      const cookie = await login(minor.id);
      const tutor = await seedTutor();
      const klass = await seedClass({ tutorId: tutor.id });

      const refused = await call(app, "POST", "/bookings", cookie, { classId: klass.id });
      assert.equal(refused.body.error, "needs-consent", refused.raw);

      await giveConsent(minor.id);
      const booked = await call(app, "POST", "/bookings", cookie, { classId: klass.id });
      assert.equal(booked.body.ok, true, booked.raw);
    });
  });
});
