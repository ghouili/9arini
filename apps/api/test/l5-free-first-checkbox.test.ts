import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApp, stopApp, seedTutor, login, call, sql, type App } from "./support/fx";

/* Phase A · A18.6 (lane L5). "Offrir la 1ère séance gratuitement" on the new-class
   form did NOTHING while the tutor's own free-first option was off (the default):
   the flag was stored, and the storefront ignored it. The form now disables the
   box and links to the setting; the server refuses the flag too, so a crafted
   POST cannot store a promise the tutor has not switched on. */

let app: App;
before(async () => {
  app = await startApp();
});
after(async () => {
  await stopApp(app);
});

const inThreeDays = () => new Date(Date.now() + 3 * 86_400_000).toISOString();
const body = (isFreeFirst: boolean) => ({
  title: "Révision L5 free-first",
  scheduledAt: inThreeDays(),
  durationMin: 90,
  priceTnd: 20,
  seats: 10,
  isFreeFirst,
});

describe("A18.6 — the free-first box only means something when the option is on", () => {
  test("option OFF: a class cannot be marked free-first", async () => {
    const tutor = await seedTutor({ offersFreeFirstSession: false });
    const cookie = await login(tutor.profileId);
    const res = await call(app, "POST", "/classes", cookie, body(true));
    assert.equal(res.body.ok, false, res.raw);
    assert.equal(res.body.error, "free-first-off");
    const [row] = await sql<{ n: number }[]>`select count(*)::int n from classes where tutor_id = ${tutor.id}`;
    assert.equal(row.n, 0, "nothing was stored");
  });

  test("option OFF: an ordinary class is still published", async () => {
    const tutor = await seedTutor({ offersFreeFirstSession: false });
    const cookie = await login(tutor.profileId);
    const res = await call(app, "POST", "/classes", cookie, body(false));
    assert.equal(res.body.ok, true, res.raw);
  });

  test("option ON: the class is stored free-first", async () => {
    const tutor = await seedTutor({ offersFreeFirstSession: true });
    const cookie = await login(tutor.profileId);
    const res = await call(app, "POST", "/classes", cookie, body(true));
    assert.equal(res.body.ok, true, res.raw);
    const [row] = await sql<{ is_free_first: boolean }[]>`select is_free_first from classes where tutor_id = ${tutor.id}`;
    assert.equal(row.is_free_first, true);
  });
});
