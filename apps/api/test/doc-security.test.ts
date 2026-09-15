import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { sealDoc, openDoc, isSealedDoc, DocCryptoError, __resetDocKeyCache } from "@tnajem/db";
import { checkDocLink, docLink, DOC_LINK_TTL_SEC } from "../src/lib/doc-links";

/* security: identity documents at rest, and the links that open them. */

const KEY_A = randomBytes(32).toString("hex");
const KEY_B = randomBytes(32).toString("base64");
const PATH = "verification/7b0c/id_front-1-0-scan.png";
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), randomBytes(2048)]);

const saved = { key: process.env.DOC_ENCRYPTION_KEY, prev: process.env.DOC_ENCRYPTION_KEY_PREVIOUS, env: process.env.NODE_ENV };
function keys(current?: string, previous?: string) {
  if (current === undefined) delete process.env.DOC_ENCRYPTION_KEY;
  else process.env.DOC_ENCRYPTION_KEY = current;
  if (previous === undefined) delete process.env.DOC_ENCRYPTION_KEY_PREVIOUS;
  else process.env.DOC_ENCRYPTION_KEY_PREVIOUS = previous;
  __resetDocKeyCache();
}
beforeEach(() => keys(KEY_A));
afterEach(() => {
  keys(saved.key, saved.prev);
  process.env.NODE_ENV = saved.env;
});

describe("security: identity documents are encrypted at rest", () => {
  test("a sealed document does not contain the scan and opens back to it exactly", () => {
    const sealed = sealDoc(PATH, PNG);
    assert.ok(isSealedDoc(sealed));
    assert.equal(sealed.indexOf(PNG.subarray(0, 16)), -1, "no plaintext run may survive in the object");
    const opened = openDoc(PATH, sealed);
    assert.ok(opened.plaintext.equals(PNG));
    assert.equal(opened.sealedWith, "current");
  });

  test("two seals of the same scan differ (fresh IV per document)", () => {
    assert.ok(!sealDoc(PATH, PNG).equals(sealDoc(PATH, PNG)));
  });

  test("a single flipped byte is detected, not silently decrypted", () => {
    const sealed = sealDoc(PATH, PNG);
    sealed[sealed.length - 10] ^= 0x01;
    assert.throws(() => openDoc(PATH, sealed), (e: DocCryptoError) => e.code === "tampered");
  });

  test("a document copied onto another document's path fails authentication", () => {
    const sealed = sealDoc(PATH, PNG);
    assert.throws(() => openDoc("verification/other-tutor/id_front-1-0-scan.png", sealed), (e: DocCryptoError) => e.code === "tampered");
  });

  test("rotation: the previous key still opens, and says so", () => {
    const sealedWithA = sealDoc(PATH, PNG);
    keys(KEY_B, KEY_A);
    const opened = openDoc(PATH, sealedWithA);
    assert.ok(opened.plaintext.equals(PNG));
    assert.equal(opened.sealedWith, "previous");
  });

  test("a document sealed with a key that is no longer configured is refused", () => {
    const sealedWithA = sealDoc(PATH, PNG);
    keys(KEY_B);
    assert.throws(() => openDoc(PATH, sealedWithA), (e: DocCryptoError) => e.code === "unknown-key");
  });

  test("no key: sealing refuses instead of writing plaintext", () => {
    keys(undefined);
    assert.throws(() => sealDoc(PATH, PNG), (e: DocCryptoError) => e.code === "no-key");
  });

  test("a malformed key is refused", () => {
    keys("too-short");
    assert.throws(() => sealDoc(PATH, PNG), (e: DocCryptoError) => e.code === "bad-key");
  });

  test("an unencrypted document is refused in production, read outside it", () => {
    process.env.NODE_ENV = "production";
    assert.throws(() => openDoc(PATH, PNG), (e: DocCryptoError) => e.code === "plaintext-refused");
    process.env.NODE_ENV = "development";
    assert.equal(openDoc(PATH, PNG).sealedWith, "plaintext");
  });
});

describe("security: document links are short-lived and bound to one admin", () => {
  const DOC = "5a1d6b0e-8f1c-4d3e-9a7b-2c4e6f8a0b1c";
  const ADMIN = "11111111-2222-3333-4444-555555555555";
  const OTHER_ADMIN = "66666666-7777-8888-9999-000000000000";
  const now = Date.UTC(2026, 8, 15, 12, 0, 0);
  const query = (url: string) => Object.fromEntries(new URL(url, "http://x").searchParams);

  test("a fresh link opens for the admin it was issued to", () => {
    const url = docLink(DOC, ADMIN, now);
    assert.match(url, new RegExp(`^/api/admin/doc/${DOC}\\?exp=\\d+&sig=[0-9a-f]{64}$`));
    assert.equal(checkDocLink(DOC, ADMIN, query(url), now), "ok");
  });

  test("another admin cannot use it", () => {
    assert.equal(checkDocLink(DOC, OTHER_ADMIN, query(docLink(DOC, ADMIN, now)), now), "invalid");
  });

  test("it opens no other document", () => {
    assert.equal(checkDocLink("0e0e0e0e-0000-4000-8000-000000000000", ADMIN, query(docLink(DOC, ADMIN, now)), now), "invalid");
  });

  test("it expires after the TTL", () => {
    const q = query(docLink(DOC, ADMIN, now));
    assert.equal(checkDocLink(DOC, ADMIN, q, now + (DOC_LINK_TTL_SEC - 1) * 1000), "ok");
    assert.equal(checkDocLink(DOC, ADMIN, q, now + (DOC_LINK_TTL_SEC + 1) * 1000), "expired");
  });

  test("moving the expiry forward breaks the signature", () => {
    const q = query(docLink(DOC, ADMIN, now));
    assert.equal(checkDocLink(DOC, ADMIN, { ...q, exp: String(Number(q.exp) + 3600) }, now), "invalid");
  });

  test("no link, or a malformed one, is refused", () => {
    assert.equal(checkDocLink(DOC, ADMIN, {}, now), "missing");
    assert.equal(checkDocLink(DOC, ADMIN, { exp: "abc", sig: "zz" }, now), "invalid");
  });
});
