import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApp, stopApp, seedProfile, seedTutor, login, call, type App } from "./support/fx";

/* A17 · THE ROLE CHECK LOST IN THE BACKEND SPLIT.

   The tutor dashboard's data endpoint answered ANY session: a student got the
   "no storefront yet" payload, which the page renders as "Crée ta vitrine" — an
   invitation to the tutor funnel. The web already understands { wrongRole } (it
   renders WrongRoleNotice); the API stopped sending it. The web layouts now also
   redirect server-side (app/[locale]/dashboard/layout.tsx and student/layout.tsx);
   e2e/role-guard.spec.ts covers the pages. */

let app: App;
before(async () => {
  app = await startApp();
});
after(async () => {
  await stopApp(app);
});

describe("A17 · GET /dashboard is for tutors", () => {
  test("a student gets { wrongRole: 'student' }, never the create-your-storefront payload", async () => {
    const student = await seedProfile({ role: "student" });
    const res = await call(app, "GET", "/dashboard", await login(student.id));
    assert.deepEqual(res.body, { wrongRole: "student" }, res.raw);
  });

  test("a guardian gets { wrongRole: 'guardian' }", async () => {
    const parent = await seedProfile({ role: "guardian", birthYear: 1980 });
    const res = await call(app, "GET", "/dashboard", await login(parent.id));
    assert.deepEqual(res.body, { wrongRole: "guardian" }, res.raw);
  });

  test("a tutor still gets their dashboard", async () => {
    const tutor = await seedTutor();
    const res = await call(app, "GET", "/dashboard", await login(tutor.profileId));
    assert.equal(res.body.has_storefront, true, res.raw);
    assert.equal(res.body.slug, tutor.slug, res.raw);
  });

  test("a tutor with no storefront yet is still a tutor (the onboarding prompt is theirs)", async () => {
    const fresh = await seedProfile({ role: "tutor", birthYear: 1985 });
    const res = await call(app, "GET", "/dashboard", await login(fresh.id));
    assert.equal(res.body.has_storefront, false, res.raw);
    assert.equal("wrongRole" in res.body, false, res.raw);
  });
});
