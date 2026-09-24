import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApp, stopApp, seedProfile, login, call, sql, fxEmail, type App } from "./support/fx";

/* Phase A · A18.2 (lane L5). The guardian's phone was REQUIRED on the consent form,
   stored, and never used for anything. Data minimisation: it is optional on the
   server, not collected by the form, and a consent without it is stored with no
   phone at all (NULL), not an empty placeholder. */

let app: App;
const minors: string[] = [];

before(async () => {
  app = await startApp();
});
after(async () => {
  // consents / guardian_links are not in fx's cleanup list: delete ours first.
  if (minors.length) {
    await sql`delete from guardian_links where consent_id in (select id from consents where minor_id in ${sql(minors)})`;
    await sql`delete from consents where minor_id in ${sql(minors)}`;
  }
  await stopApp(app);
});

const minorYear = () => new Date().getFullYear() - 15;

describe("A18.2 — the guardian phone is not asked for", () => {
  test("a consent with no phone is accepted and stores no phone", async () => {
    const child = await seedProfile({ role: "student", birthYear: minorYear() });
    minors.push(child.id);
    const cookie = await login(child.id);

    const res = await call(app, "POST", "/consent", cookie, {
      guardianName: "Parent L5",
      guardianEmail: fxEmail(`l5-parent-${child.id.slice(0, 8)}`),
    });
    assert.equal(res.status, 200, res.raw);
    assert.equal(res.body.ok, true, res.raw);

    const [row] = await sql<{ guardian_phone: string | null }[]>`
      select guardian_phone from consents where minor_id = ${child.id}`;
    assert.ok(row, "the consent row exists");
    assert.equal(row.guardian_phone, null);
  });

  test("a phone that IS sent must still be a real number", async () => {
    const child = await seedProfile({ role: "student", birthYear: minorYear() });
    minors.push(child.id);
    const cookie = await login(child.id);
    const res = await call(app, "POST", "/consent", cookie, {
      guardianName: "Parent L5",
      guardianPhone: "12",
      guardianEmail: fxEmail(`l5-parent2-${child.id.slice(0, 8)}`),
    });
    assert.equal(res.body.ok, false, res.raw);
    assert.equal(res.body.error, "invalid-phone");
  });
});
