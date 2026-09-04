import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import "../src/env";
import { rateLimits, eq, like } from "@tnajem/db";
import { db, sql } from "../src/db";
import { checkRateLimit, rateLimitInProcess } from "../src/lib/rate-limit";

/* The limiter has to keep working after the split, and it has to keep working
   DURABLY: under Fastify there is no single process that sees all traffic, so the
   in-process fallback is much weaker than it was in the monolith.

   The load-bearing assertion is that a ROW IS WRITTEN. The bug this replaced —
   a JS Date bound into a raw sql`` template, throwing on every upsert — was
   invisible for exactly as long as nobody asserted persistence: the fail-open
   catch kept throttling in-process, so "the request was refused" passed
   throughout while rate_limits sat permanently empty. */

const KEY_PREFIX = "unit-test:";

async function cleanup(): Promise<void> {
  await db.delete(rateLimits).where(like(rateLimits.key, `${KEY_PREFIX}%`));
}

before(cleanup);
after(async () => {
  await cleanup();
  await sql?.end({ timeout: 5 });
});

describe("durable rate limiter", () => {
  test("writes a row to rate_limits — not just an in-process counter", async () => {
    const key = `${KEY_PREFIX}persist:${Date.now()}`;
    const res = await checkRateLimit(key, 5, 60_000);
    assert.equal(res.ok, true);

    const rows = await db.select().from(rateLimits).where(eq(rateLimits.key, key));
    assert.equal(
      rows.length,
      1,
      "rate_limits is empty — the limiter is silently falling back to in-process again",
    );
    assert.equal(rows[0].count, 1);
  });

  test("counts up across calls and refuses past the limit", async () => {
    const key = `${KEY_PREFIX}count:${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      const r = await checkRateLimit(key, 3, 60_000);
      assert.equal(r.ok, true, `call ${i + 1} of 3 must pass`);
    }
    const over = await checkRateLimit(key, 3, 60_000);
    assert.equal(over.ok, false, "call 4 must be refused: exactly `limit` per window");
    assert.ok(over.retryAfter > 0, "a refusal must tell the caller when to retry");

    const [row] = await db.select().from(rateLimits).where(eq(rateLimits.key, key));
    assert.equal(row.count, 4);
  });

  test("the window comes from the DATABASE clock, in the future", async () => {
    const key = `${KEY_PREFIX}window:${Date.now()}`;
    await checkRateLimit(key, 5, 60_000);
    const [row] = await db.select().from(rateLimits).where(eq(rateLimits.key, key));
    const resetAt = new Date(row.resetAt).getTime();
    assert.ok(resetAt > Date.now() - 5_000, "reset_at must be in the future");
    /* Computed as now() + interval inside Postgres, so instances with skewed
       clocks still agree on when a window ends. A bound JS Date both defeated
       that and threw. */
    assert.ok(resetAt < Date.now() + 120_000, "and roughly one window out, not a bound client value");
  });

  test("an expired window resets the count to 1 rather than accumulating", async () => {
    const key = `${KEY_PREFIX}reset:${Date.now()}`;
    // A window that is already over: the next call must start a fresh one.
    await checkRateLimit(key, 2, 1);
    await new Promise((r) => setTimeout(r, 30));
    const res = await checkRateLimit(key, 2, 60_000);
    assert.equal(res.ok, true);
    const [row] = await db.select().from(rateLimits).where(eq(rateLimits.key, key));
    assert.equal(row.count, 1, "an elapsed window resets to 1, it does not keep climbing");
  });
});

describe("in-process fallback", () => {
  test("allows exactly `limit` per window, then refuses", () => {
    const key = `fallback:${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      assert.equal(rateLimitInProcess(key, 3, 60_000).ok, true);
    }
    const over = rateLimitInProcess(key, 3, 60_000);
    assert.equal(over.ok, false);
    assert.ok(over.retryAfter > 0);
  });

  test("independent keys do not share a bucket", () => {
    const a = `fallback:a:${Math.random()}`;
    const b = `fallback:b:${Math.random()}`;
    assert.equal(rateLimitInProcess(a, 1, 60_000).ok, true);
    assert.equal(rateLimitInProcess(a, 1, 60_000).ok, false);
    assert.equal(rateLimitInProcess(b, 1, 60_000).ok, true, "a different key must have its own window");
  });
});
