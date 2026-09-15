import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ipBucket, rlSubject } from "../src/lib/rate-limit";

/* security: per-IP budgets key on what one subscriber actually controls. */

describe("security: ipBucket", () => {
  test("IPv4 is its own bucket", () => {
    assert.equal(ipBucket("197.2.14.9"), "197.2.14.9");
  });
  test("every address in one IPv6 /64 shares a bucket", () => {
    const a = ipBucket("2001:db8:85a3:12::1");
    assert.equal(a, "2001:db8:85a3:12::/64");
    assert.equal(ipBucket("2001:0db8:85a3:0012:ffff:ffff:ffff:fffe"), a);
    assert.equal(ipBucket("2001:db8:85a3:12:abcd::42"), a);
  });
  test("a different /64 is a different bucket", () => {
    assert.notEqual(ipBucket("2001:db8:85a3:13::1"), ipBucket("2001:db8:85a3:12::1"));
  });
  test("compressed forms expand before bucketing", () => {
    assert.equal(ipBucket("2001:db8::1"), "2001:db8:0:0::/64");
    assert.equal(ipBucket("::1"), "0:0:0:0::/64");
  });
  test("an IPv4-mapped address is its IPv4 address", () => {
    assert.equal(ipBucket("::ffff:197.2.14.9"), "197.2.14.9");
  });
  test("nothing usable is one explicit bucket", () => {
    assert.equal(ipBucket(undefined), "unknown");
    assert.equal(ipBucket(""), "unknown");
  });
});

describe("security: rlSubject", () => {
  test("an identity in a rate-limit key is a stable keyed hash, never the address", () => {
    const k = rlSubject("amel@example.tn");
    assert.match(k, /^[0-9a-f]{32}$/);
    assert.equal(rlSubject("amel@example.tn"), k);
    assert.notEqual(rlSubject("amel@example.tm"), k);
    assert.ok(!k.includes("amel"));
  });
});
