import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { adminAuthIdentities, isAllowlistedAdmin, adminNotifyEmails } from "@tnajem/shared";

/* The allowlist that gates the pending-verification queue and every national ID
   scan in it. Each case below is a regression that actually happened or was one
   edit away from happening. */

const env = (o: Record<string, string | undefined>) => o as NodeJS.ProcessEnv;

describe("adminAuthIdentities — empty means NOBODY", () => {
  test("unset -> []", () => {
    assert.deepEqual(adminAuthIdentities(env({}), "email"), []);
  });
  test('"" -> []', () => {
    assert.deepEqual(adminAuthIdentities(env({ ADMIN_EMAILS: "" }), "email"), []);
  });
  test('"," -> []', () => {
    assert.deepEqual(adminAuthIdentities(env({ ADMIN_EMAILS: "," }), "email"), []);
  });
  test('",," -> []', () => {
    assert.deepEqual(adminAuthIdentities(env({ ADMIN_EMAILS: ",," }), "email"), []);
  });
});

describe("adminAuthIdentities — the +216 regression", () => {
  test('ADMIN_PHONES="" must NOT yield ["+216"]', () => {
    /* normalizePhone("") returns "+216" — it prefixes the country code to an
       empty string. The original code ran .filter(Boolean) AFTER .map(), so it
       never saw the "". Combined with normalizePhone(profile.phone ?? ""), which
       is ALSO "+216" for a null phone, every null-phone user became an admin with
       read access to every ID card in the system. Filter BEFORE normalising. */
    const out: string[] = adminAuthIdentities(env({ ADMIN_PHONES: "" }), "sms");
    // includes() BEFORE deepEqual: node:assert/strict's deepEqual carries an
    // `asserts actual is T` signature, so it narrows `out` to never[] and every
    // later call on it becomes a type error.
    assert.ok(!out.includes("+216"), 'an empty ADMIN_PHONES must not yield ["+216"]');
    assert.deepEqual(out, []);
  });

  test('a trailing comma must not append "+216"', () => {
    const out: string[] = adminAuthIdentities(env({ ADMIN_PHONES: "+21620000000," }), "sms");
    assert.ok(!out.includes("+216"), "a trailing comma must not append the bare country code");
    assert.deepEqual(out, ["+21620000000"]);
  });

  test('ADMIN_PHONES="0" is junk and is discarded', () => {
    assert.deepEqual(adminAuthIdentities(env({ ADMIN_PHONES: "0" }), "sms"), []);
  });
});

describe("adminAuthIdentities — normalisation and validation", () => {
  test("trims and lower-cases e-mail", () => {
    assert.deepEqual(
      adminAuthIdentities(env({ ADMIN_EMAILS: " A@B.COM " }), "email"),
      ["a@b.com"],
    );
  });
  test("a trailing comma yields one entry, not two", () => {
    assert.deepEqual(adminAuthIdentities(env({ ADMIN_EMAILS: "a@b.com," }), "email"), ["a@b.com"]);
  });
  test("an invalid entry is discarded, not trusted", () => {
    assert.deepEqual(adminAuthIdentities(env({ ADMIN_EMAILS: "notanemail" }), "email"), []);
  });
  test("reads ADMIN_EMAILS under email and ADMIN_PHONES under sms", () => {
    const both = env({ ADMIN_EMAILS: "a@b.com", ADMIN_PHONES: "+21620000000" });
    assert.deepEqual(adminAuthIdentities(both, "email"), ["a@b.com"]);
    assert.deepEqual(adminAuthIdentities(both, "sms"), ["+21620000000"]);
  });
});

describe("isAllowlistedAdmin — fails closed on every path", () => {
  const allow = ["a@b.com"];

  test("an allowlisted e-mail passes under the email channel", () => {
    assert.equal(isAllowlistedAdmin({ email: "a@b.com", phone: null }, allow, "email"), true);
  });

  test("an EMPTY allowlist refuses everyone", () => {
    assert.equal(isAllowlistedAdmin({ email: "a@b.com", phone: null }, [], "email"), false);
  });

  test("no identity of the ACTIVE kind is never an admin", () => {
    /* This is the bug that shipped: the doc route checked phone only, login is
       e-mail OTP, so profile.phone was null for every admin and it 403'd the very
       people the queue exists for. It failed CLOSED — a welded-shut door, not a
       hole — but the queue could not be worked at all. */
    assert.equal(
      isAllowlistedAdmin({ email: null, phone: "+21620000000" }, allow, "email"),
      false,
    );
    assert.equal(
      isAllowlistedAdmin({ email: "a@b.com", phone: null }, ["+21620000000"], "sms"),
      false,
    );
  });

  test("a non-allowlisted identity is refused", () => {
    assert.equal(isAllowlistedAdmin({ email: "x@y.com", phone: null }, allow, "email"), false);
  });

  test("case and surrounding space do not smuggle anyone in or lock anyone out", () => {
    assert.equal(isAllowlistedAdmin({ email: " A@B.COM ", phone: null }, allow, "email"), true);
  });
});

describe("adminNotifyEmails — always ADMIN_EMAILS, never phones", () => {
  test("ignores ADMIN_PHONES entirely", () => {
    /* Deliberately NOT merged with the auth list: under OTP_CHANNEL=sms the auth
       list holds PHONE NUMBERS, and you cannot email a phone number. Merging the
       two yields either mailing phone numbers, or authorising on ADMIN_EMAILS
       while login is by phone — the original bug in a mirror. */
    assert.deepEqual(
      adminNotifyEmails(env({ ADMIN_PHONES: "+21620000000", ADMIN_EMAILS: "a@b.com" })),
      ["a@b.com"],
    );
  });
  test("applies the same trim/drop-empty/validate discipline", () => {
    assert.deepEqual(
      adminNotifyEmails(env({ ADMIN_EMAILS: " A@B.COM ,,notanemail," })),
      ["a@b.com"],
    );
  });
  test("unset -> [] (the caller warns; it does not fail open)", () => {
    assert.deepEqual(adminNotifyEmails(env({})), []);
  });
});
