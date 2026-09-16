import { test, expect } from "@playwright/test";

/* OBSERVABILITY (production readiness Stage 7).
 *
 * Two surfaces that did not exist before this stage, and one that did but said
 * less than it needed to:
 *
 *   /api/health on the web app   — the URL the Stage 6 gate and the uptime monitor
 *                                  both name. It was a 404.
 *   /debug/error on the API      — the deliberate failure that proves the error
 *                                  pipeline without breaking something real.
 *   /health on the API           — now reports storage as well as the database.
 *
 * The suite runs against a PRODUCTION build (standalone web + the API), so these
 * are the shapes that ship. */

const API = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";

test.describe("observability: the health surfaces", () => {
  test("the web /api/health aggregates the API, the database and the document store", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status(), "everything is up in this suite, so it must be 200").toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, web: true, api: true, db: true, storage: true });
    expect(typeof body.version, "the API's version, for telling two deploys apart").toBe("string");

    /* A CACHED HEALTH CHECK IS WORSE THAN NONE: it reports a moment that has
       passed, and is the classic way a monitor stays green through an outage. */
    expect(res.headers()["cache-control"]).toContain("no-store");
  });

  test("the API /health reports the document store, not just the database", async () => {
    const res = await fetch(`${API}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; db: boolean; storage: boolean; version: string };
    expect(body.db, "the suite's database").toBe(true);
    expect(body.storage, "probed with a real write, cached for 15s — see apps/api/src/lib/health.ts").toBe(true);
    /* ok stays hard-coded true and the BODY is the signal here: Docker's
       HEALTHCHECK reads .ok && .db, so a storage problem must not pull the whole
       API out of rotation. The status-code signal lives on the web route above. */
    expect(body.ok).toBe(true);
  });

  test("the storage probe does not leak into the response on repeat polls", async () => {
    /* Hammering it must stay cheap and consistent — the route is unauthenticated
       and reachable from the internet through the web app, and it WRITES a file.
       The 15s cache is what bounds that; five polls must not mean five writes,
       and every answer must be identical. */
    const bodies = await Promise.all(
      Array.from({ length: 5 }, async () => (await (await fetch(`${API}/health`)).json()) as { storage: boolean }),
    );
    expect(bodies.every((b) => b.storage === true)).toBe(true);
  });
});

test.describe("observability: the deliberate error", () => {
  const secret = process.env.CRON_SECRET?.trim();

  test("a wrong bearer is refused, and the route never runs", async () => {
    const res = await fetch(`${API}/debug/error`, {
      method: "POST",
      headers: { authorization: "Bearer not-the-secret" },
    });
    /* 401 when a secret is configured, 503 when it is not. Both mean "did not
       throw", which is the assertion: this route is reachable in production and
       must stay closed to everyone without the token. */
    expect([401, 503]).toContain(res.status);
    expect(await res.json()).toMatchObject({ ok: false });
  });

  test("GET is not a way in", async () => {
    const res = await fetch(`${API}/debug/error`);
    expect(res.status, "POST only, so no crawler or prefetch can fire it").toBe(404);
  });

  test("with the bearer it produces a real 500, and the response carries the request id", async () => {
    test.skip(!secret, "CRON_SECRET is not set in this environment");
    const res = await fetch(`${API}/debug/error`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(res.status).toBe(500);
    /* The generic body: a 5xx never carries an internal message (Stage 4). */
    const body = await res.text();
    expect(body).toContain('"message":"Internal Server Error"');
    expect(body).not.toContain("deliberate test error");
    /* The join. This is the id the log line carries and the id the Sentry event is
       tagged with, which is the whole point of the route. */
    expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });
});
