import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApp, stopApp, seedTutor, seedClass, call, type App } from "./support/fx";

/* phase-a lane L4 (A9) — the class page found its tutor by SEARCHING Explore for
   the tutor's name. Two tutors called "Mohamed Ben Ali" meant a student on tutor
   B's class could be sent to tutor A's storefront. GET /classes/:id now names the
   tutor by slug, so the page never has to guess. */

let app: App;
before(async () => {
  app = await startApp();
});
after(async () => {
  await stopApp(app);
});

describe("GET /classes/:id — the tutor is identified by slug, not by name", () => {
  test("two tutors named 'Mohamed Ben Ali': B's class links to B's slug", async () => {
    const a = await seedTutor({ fullName: "Mohamed Ben Ali" });
    const b = await seedTutor({ fullName: "Mohamed Ben Ali" });
    const klassA = await seedClass({ tutorId: a.id });
    const klassB = await seedClass({ tutorId: b.id });

    const resB = await call(app, "GET", `/classes/${klassB.id}`, null);
    assert.equal(resB.status, 200, resB.raw);
    assert.equal(resB.body.tutor_slug, b.slug, `B's class must link to B's slug: ${resB.raw}`);
    assert.notEqual(resB.body.tutor_slug, a.slug);
    assert.equal(resB.body.tutor_subject, "Mathématiques", resB.raw);
    assert.equal(resB.body.tutor_level, "Bac", resB.raw);

    const resA = await call(app, "GET", `/classes/${klassA.id}`, null);
    assert.equal(resA.body.tutor_slug, a.slug, `A's class must link to A's slug: ${resA.raw}`);
  });
});
