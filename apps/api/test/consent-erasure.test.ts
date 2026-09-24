import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eraseAccount } from "@tnajem/db";
import { db } from "../src/db";
import { startApp, stopApp, seedProfile, sql, type App } from "./support/fx";

/* phase-a lane L4 (A27) — a parent's name and phone survived their own erasure.

   Erasing a guardian's account deleted their guardian links but left their name,
   phone and e-mail on the CHILD's consent record, so "your name and phone are
   erased" was untrue for every parent. The record of consent must stay (that
   consent was given, when, under which policy version); the person must not. */

let app: App;
const erasedProfiles: string[] = [];

before(async () => {
  app = await startApp();
});
after(async () => {
  for (const id of erasedProfiles) {
    await sql`delete from admin_actions where subject_id = ${id}`;
    await sql`delete from sessions where profile_id = ${id}`;
    await sql`delete from profiles where id = ${id}`;
  }
  await stopApp(app); // the minors' consents cascade with their (tagged) profiles
});

const SIGNED_AT = "2026-06-01T10:00:00.000Z";

async function consentFor(minorId: string, guardian: { name: string; phone: string; email: string | null }) {
  const id = randomUUID();
  await sql`insert into consents (id, minor_id, guardian_name, guardian_phone, guardian_email, consent_text,
                                  policy_version, signed_at)
            values (${id}, ${minorId}, ${guardian.name}, ${guardian.phone}, ${guardian.email},
                    'Texte de consentement (test).', 'policy-test-v3', ${SIGNED_AT})`;
  return id;
}

describe("A27 — erasing a guardian anonymises them in their child's consent record", () => {
  test("name, e-mail and phone are gone; the fact of consent, its date and its version stay", async () => {
    const minor = await seedProfile({ role: "student", birthYear: 2012 });
    const guardian = await seedProfile({ role: "guardian", fullName: "Mounir Gardien" });
    erasedProfiles.push(guardian.id);
    const consentId = await consentFor(minor.id, { name: "Mounir Gardien", phone: "+21622123456", email: guardian.email });
    await sql`insert into guardian_links (guardian_profile_id, minor_profile_id, consent_id)
              values (${guardian.id}, ${minor.id}, ${consentId})`;

    /* Someone else's consent, for another child: untouched. */
    const otherMinor = await seedProfile({ role: "student", birthYear: 2011 });
    const otherConsent = await consentFor(otherMinor.id, { name: "Leila Autre", phone: "+21655000111", email: "leila.autre@tnajem.invalid" });

    const res = await eraseAccount(db, guardian.id, { reason: "requested" });
    assert.equal(res.outcome, "erased", JSON.stringify(res));

    const [c] = await sql<Record<string, unknown>[]>`
      select guardian_name, guardian_phone, guardian_email, consent_text, policy_version, signed_at, withdrawn_at
        from consents where id = ${consentId}`;
    assert.ok(c, "the consent record itself is kept");
    assert.ok(!String(c.guardian_name).includes("Mounir"), `the guardian's name is gone: ${String(c.guardian_name)}`);
    assert.ok(!/\d{4}/.test(String(c.guardian_phone)), `the guardian's phone is gone: ${String(c.guardian_phone)}`);
    assert.equal(c.guardian_email, null, "the guardian's e-mail is gone");
    assert.equal(c.policy_version, "policy-test-v3", "the version consent was given under is kept");
    assert.equal(new Date(c.signed_at as string).toISOString(), SIGNED_AT, "when consent was given is kept");
    assert.equal(c.consent_text, "Texte de consentement (test).", "what was consented to is kept");
    assert.equal(c.withdrawn_at, null, "erasing an account is not withdrawing consent");

    const [o] = await sql<{ guardian_name: string; guardian_phone: string; guardian_email: string }[]>`
      select guardian_name, guardian_phone, guardian_email from consents where id = ${otherConsent}`;
    assert.deepEqual(o, { guardian_name: "Leila Autre", guardian_phone: "+21655000111", guardian_email: "leila.autre@tnajem.invalid" });
  });
});
