import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  startApp, stopApp, seedProfile, login, call, sql, type App,
  fxClientIp, fxSignupEmail, otpVerify, tunisMonthsAgo, cleanupIp,
} from "./support/fx";

/* A14 · A MINOR CANNOT BECOME A TUTOR (finding 5).

   /signup/prof asked no age, so only the manual ID review stood between a
   16-year-old and a storefront. Both ways in — sign-up as a prof, and the in-app
   student → tutor upgrade — now use the same fail-safe isAdult(), birth month +
   year, and this holds REGARDLESS of ALLOW_MINORS: minors may one day study here,
   they never teach. */

const IP = fxClientIp();
let app: App;

const _17y11m = () => tunisMonthsAgo(17 * 12 + 11);
const _18y1m = () => tunisMonthsAgo(18 * 12 + 1);

async function profileByEmail(email: string) {
  const [row] = await sql<{ id: string; role: string; birth_year: number | null; birth_month: number | null }[]>`
    select id, role, birth_year, birth_month from profiles where email = ${email}`;
  return row ?? null;
}

before(async () => {
  delete process.env.ALLOW_MINORS;
  app = await startApp();
});

after(async () => {
  await cleanupIp(IP);
  await stopApp(app);
});

describe("A14 · /signup/prof refuses anyone under 18", () => {
  test("a prof sign-up at 17 years 11 months is refused, and no account is created", async () => {
    const identifier = fxSignupEmail();
    const { year, month } = _17y11m();
    const res = await otpVerify(app, IP, { identifier, role: "tutor", birthYear: year, birthMonth: month });
    assert.equal(res.body.ok, false, res.raw);
    assert.equal(res.body.error, "minor-cannot-teach", res.raw);
    assert.equal(await profileByEmail(identifier), null);
  });

  test("…and ALLOW_MINORS=1 changes nothing for a tutor", async () => {
    const prev = process.env.ALLOW_MINORS;
    process.env.ALLOW_MINORS = "1";
    try {
      const identifier = fxSignupEmail();
      const { year, month } = _17y11m();
      const res = await otpVerify(app, IP, { identifier, role: "tutor", birthYear: year, birthMonth: month });
      assert.equal(res.body.error, "minor-cannot-teach", res.raw);
      assert.equal(await profileByEmail(identifier), null);
    } finally {
      if (prev === undefined) delete process.env.ALLOW_MINORS;
      else process.env.ALLOW_MINORS = prev;
    }
  });

  test("a prof sign-up with no birth date is refused", async () => {
    const identifier = fxSignupEmail();
    const res = await otpVerify(app, IP, { identifier, role: "tutor" });
    assert.equal(res.body.ok, false, res.raw);
    assert.equal(res.body.error, "birth-date-required", res.raw);
    assert.equal(await profileByEmail(identifier), null);
  });

  test("an adult (18 years 1 month) signs up as a prof, with the date on file", async () => {
    const identifier = fxSignupEmail();
    const { year, month } = _18y1m();
    const res = await otpVerify(app, IP, { identifier, role: "tutor", birthYear: year, birthMonth: month });
    assert.equal(res.body.ok, true, res.raw);
    assert.equal(res.body.role, "tutor", res.raw);
    const p = await profileByEmail(identifier);
    assert.deepEqual({ role: p?.role, y: p?.birth_year, m: p?.birth_month }, { role: "tutor", y: year, m: month });
  });
});

describe("A14 · the student → tutor upgrade uses the same month-aware rule", () => {
  test("a student at 17 years 11 months cannot become a tutor", async () => {
    const { year, month } = _17y11m();
    const me = await seedProfile({ role: "student", birthYear: year, birthMonth: month });
    const res = await call(app, "POST", "/profile/become-tutor", await login(me.id), { confirm: true });
    assert.equal(res.body.ok, false, res.raw);
    assert.equal(res.body.error, "minor-cannot-teach", res.raw);
    const [p] = await sql<{ role: string }[]>`select role from profiles where id = ${me.id}`;
    assert.equal(p.role, "student");
  });

  test("an unknown birth month is asked for, never assumed", async () => {
    const me = await seedProfile({ role: "student", birthYear: 1990, birthMonth: null });
    const cookie = await login(me.id);
    const asked = await call(app, "POST", "/profile/become-tutor", cookie, { confirm: true });
    assert.equal(asked.body.error, "age-required", asked.raw);

    const done = await call(app, "POST", "/profile/become-tutor", cookie, { confirm: true, birthMonth: 4 });
    assert.equal(done.body.ok, true, done.raw);
    const [p] = await sql<{ role: string; birth_month: number }[]>`select role, birth_month from profiles where id = ${me.id}`;
    assert.deepEqual({ role: p.role, m: p.birth_month }, { role: "tutor", m: 4 });
  });
});
