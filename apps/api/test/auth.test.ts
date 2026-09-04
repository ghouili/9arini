import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  hashOtpCode,
  safeEq,
  authSecret,
  __resetAuthSecretCache,
  otpChannel,
  SESSION_COOKIE,
  ROLE_HINT_COOKIE,
  OTP_TTL_SEC,
  OTP_RESEND_COOLDOWN_SEC,
} from "@tnajem/shared/auth-core";

/* These assert the agreements apps/web and apps/api must share exactly. A failure
   here means a code minted by one process cannot be verified by the other, which
   during Step 4 shows up as login working intermittently depending on which
   process happened to serve the request. */

describe("OTP hashing", () => {
  test("binds the code to the identity it was issued for", () => {
    const code = "123456";
    const forAlice = hashOtpCode("alice@tnajem.invalid", code);
    const forBob = hashOtpCode("bob@tnajem.invalid", code);
    assert.notEqual(
      forAlice,
      forBob,
      "the same code for two identities must not produce the same hash — otherwise a " +
        "code mailed to one address is replayable against another",
    );
  });

  test("is deterministic for the same identity and code", () => {
    assert.equal(hashOtpCode("a@b.invalid", "000000"), hashOtpCode("a@b.invalid", "000000"));
  });

  test("a different code for the same identity gives a different hash", () => {
    assert.notEqual(hashOtpCode("a@b.invalid", "000000"), hashOtpCode("a@b.invalid", "000001"));
  });

  test("produces a sha256 hex digest", () => {
    assert.match(hashOtpCode("a@b.invalid", "123456"), /^[0-9a-f]{64}$/);
  });
});

describe("safeEq", () => {
  test("true for identical strings", () => {
    assert.equal(safeEq("abc", "abc"), true);
  });
  test("false for different strings of equal length", () => {
    assert.equal(safeEq("abc", "abd"), false);
  });
  test("false — and does NOT throw — on a length mismatch", () => {
    // timingSafeEqual throws on unequal lengths; the length pre-check is what
    // keeps a malformed hash from crashing the verify path.
    assert.doesNotThrow(() => safeEq("abc", "abcdef"));
    assert.equal(safeEq("abc", "abcdef"), false);
  });
  test("false against an empty string", () => {
    assert.equal(safeEq("", "abc"), false);
  });
});

describe("authSecret", () => {
  test("uses AUTH_SECRET when set", () => {
    const prev = process.env.AUTH_SECRET;
    __resetAuthSecretCache();
    process.env.AUTH_SECRET = "unit-test-secret";
    assert.equal(authSecret(), "unit-test-secret");
    __resetAuthSecretCache();
    if (prev === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = prev;
  });

  test("THROWS in production when AUTH_SECRET is unset", () => {
    const prevSecret = process.env.AUTH_SECRET;
    const prevEnv = process.env.NODE_ENV;
    __resetAuthSecretCache();
    delete process.env.AUTH_SECRET;
    process.env.NODE_ENV = "production";
    // The dev default is public in this repo: serving a production login with it
    // makes all 1,000,000 hashes for an identity computable offline, which is a
    // full auth bypass into the admin queue and every ID scan in it.
    assert.throws(() => authSecret(), /AUTH_SECRET is not set/);
    __resetAuthSecretCache();
    process.env.NODE_ENV = prevEnv;
    if (prevSecret !== undefined) process.env.AUTH_SECRET = prevSecret;
  });

  test("falls back to the dev default OUTSIDE production", () => {
    const prevSecret = process.env.AUTH_SECRET;
    const prevEnv = process.env.NODE_ENV;
    __resetAuthSecretCache();
    delete process.env.AUTH_SECRET;
    process.env.NODE_ENV = "development";
    assert.doesNotThrow(() => authSecret());
    __resetAuthSecretCache();
    process.env.NODE_ENV = prevEnv;
    if (prevSecret !== undefined) process.env.AUTH_SECRET = prevSecret;
  });
});

describe("channel + cookie agreements", () => {
  test("email is the default channel", () => {
    const prev = process.env.OTP_CHANNEL;
    delete process.env.OTP_CHANNEL;
    assert.equal(otpChannel(), "email");
    if (prev !== undefined) process.env.OTP_CHANNEL = prev;
  });

  test("OTP_CHANNEL=sms flips it, and nothing else does", () => {
    const prev = process.env.OTP_CHANNEL;
    process.env.OTP_CHANNEL = "sms";
    assert.equal(otpChannel(), "sms");
    process.env.OTP_CHANNEL = "SMS";
    assert.equal(otpChannel(), "sms", "case-insensitive");
    process.env.OTP_CHANNEL = "whatsapp";
    assert.equal(otpChannel(), "email", "an unknown value must fall back to email, not fail open");
    if (prev === undefined) delete process.env.OTP_CHANNEL;
    else process.env.OTP_CHANNEL = prev;
  });

  test("the cookie names are exactly what the web app and the E2E suite expect", () => {
    // e2e/support/session.ts hardcodes this string on purpose: renaming it IS a
    // behaviour change and the suite should fail.
    assert.equal(SESSION_COOKIE, "tnajem_session");
    assert.equal(ROLE_HINT_COOKIE, "tnajem_role");
  });

  test("the client-facing timings match the server rules", () => {
    assert.equal(OTP_TTL_SEC, 300);
    assert.equal(OTP_RESEND_COOLDOWN_SEC, 60);
  });
});
