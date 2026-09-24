import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApp, stopApp, seedProfile, login, call, sql, fxSignupEmail, type App } from "./support/fx";

/* A13 · A CHILD CANNOT QUIETLY REPLACE THEIR PARENT (finding 4).

   Until the guardian withdrew, POST /consent let the minor re-submit the form with
   another guardian address — a second address of their own — which unlinked the
   real parent without telling them. Once a guardian's account is LINKED to the
   consent, the minor can no longer change the guardian e-mail: the attempt is
   refused and logged, and the guardian of record is unchanged. Before a link
   exists (a typo the child is correcting), the change still goes through. */

let app: App;
const minorIds: string[] = [];
const guardianIds: string[] = [];
const consentIds: string[] = [];
const minorYear = () => new Date().getFullYear() - 15;
// fx-tagged, so cleanup() also removes the parent accounts created with them.
const addr = (_label: string) => fxSignupEmail();

const consentBody = (guardianEmail: string) => ({
  guardianName: "Parent Test",
  guardianPhone: "20 000 000",
  guardianEmail,
});

async function consentOf(minorId: string) {
  const [row] = await sql<{ id: string; guardian_email: string | null }[]>`
    select id, guardian_email from consents where minor_id = ${minorId}`;
  if (row && !consentIds.includes(row.id)) consentIds.push(row.id);
  return row ?? null;
}

before(async () => {
  app = await startApp();
});

after(async () => {
  if (consentIds.length) {
    await sql`delete from admin_actions where subject_kind = 'consent' and subject_id in ${sql(consentIds)}`;
  }
  const people = [...minorIds, ...guardianIds];
  if (people.length) {
    await sql`delete from guardian_links where minor_profile_id in ${sql(people)} or guardian_profile_id in ${sql(people)}`;
    await sql`delete from consents where minor_id in ${sql(people)}`;
  }
  await stopApp(app);
});

/** A minor with a consent naming `parentEmail`, and — if `link` — the parent's
    account, signed in once so the link is resolved. */
async function minorWithGuardian(parentEmail: string, link: boolean) {
  const minor = await seedProfile({ role: "student", birthYear: minorYear() });
  minorIds.push(minor.id);
  const minorCookie = await login(minor.id);
  const signed = await call(app, "POST", "/consent", minorCookie, consentBody(parentEmail));
  assert.equal(signed.body.ok, true, signed.raw);

  if (link) {
    const parent = await seedProfile({ role: "guardian", birthYear: 1980, email: parentEmail });
    guardianIds.push(parent.id);
    const kids = await call(app, "GET", "/guardian/children", await login(parent.id));
    assert.deepEqual(kids.body.map((k: { id: string }) => k.id), [minor.id], `the parent is linked: ${kids.raw}`);
  }
  return { minor, minorCookie };
}

describe("A13 · once a guardian is linked, the minor cannot change the guardian e-mail", () => {
  test("the resubmission is refused, the guardian of record is unchanged, and the attempt is logged", async () => {
    const realParent = addr("parent");
    const { minor, minorCookie } = await minorWithGuardian(realParent, true);
    const before = await consentOf(minor.id);

    const res = await call(app, "POST", "/consent", minorCookie, consentBody(addr("second-address")));
    assert.equal(res.body.ok, false, res.raw);
    assert.equal(res.body.error, "guardian-locked", res.raw);

    const after = await consentOf(minor.id);
    assert.equal(after?.guardian_email, realParent, "the guardian of record is unchanged");
    const [link] = await sql<{ n: number }[]>`
      select count(*)::int n from guardian_links where minor_profile_id = ${minor.id} and consent_id = ${before!.id}`;
    assert.equal(link.n, 1, "the real parent is still linked");

    const [audit] = await sql<{ n: number; noted: number }[]>`
      select count(*)::int n, count(note)::int noted from admin_actions
      where action = 'consent.guardian_change_refused' and subject_kind = 'consent' and subject_id = ${before!.id}`;
    assert.equal(audit.n, 1, "the attempt is on the audit log");
    assert.equal(audit.noted, 0, "and carries no personal data (no note, no address)");
  });

  test("re-signing with the SAME guardian is still allowed", async () => {
    const realParent = addr("same");
    const { minorCookie } = await minorWithGuardian(realParent, true);
    const res = await call(app, "POST", "/consent", minorCookie, consentBody(realParent));
    assert.equal(res.body.ok, true, res.raw);
  });
});

describe("A13 · before any guardian is linked, a typo can still be corrected", () => {
  test("the minor changes an unlinked guardian e-mail", async () => {
    const { minor, minorCookie } = await minorWithGuardian(addr("typo"), false);
    const fixed = addr("fixed");
    const res = await call(app, "POST", "/consent", minorCookie, consentBody(fixed));
    assert.equal(res.body.ok, true, res.raw);
    assert.equal((await consentOf(minor.id))?.guardian_email, fixed);
  });
});
