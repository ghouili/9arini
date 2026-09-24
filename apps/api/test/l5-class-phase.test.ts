import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApp, stopApp, seedTutor, seedClass, login, call, type App } from "./support/fx";

/* Phase A · A18.10 (lane L5). On the tutor dashboard a cancelled class and a
   finished one looked exactly like a live one: no status anywhere. Each class
   now carries its phase — upcoming · live · done · cancelled — computed from the
   real start + duration (Africa/Tunis instants, server clock) and the status, and
   the dashboard renders it as À venir · En direct · Terminée · Annulée. */

let app: App;
before(async () => {
  app = await startApp();
});
after(async () => {
  await stopApp(app);
});

const H = 3600_000;

describe("A18.10 — every dashboard class says where it stands", () => {
  test("upcoming, live, done and cancelled classes are told apart", async () => {
    const tutor = await seedTutor();
    const upcoming = await seedClass({ tutorId: tutor.id, hoursFromNow: 72 });
    const live = await seedClass({ tutorId: tutor.id, at: new Date(Date.now() - 0.5 * H), durationMin: 90 });
    const done = await seedClass({ tutorId: tutor.id, at: new Date(Date.now() - 3 * H), durationMin: 90 });
    const cancelled = await seedClass({ tutorId: tutor.id, hoursFromNow: 48, status: "cancelled" });

    const res = await call(app, "GET", "/dashboard", await login(tutor.profileId));
    assert.equal(res.status, 200, res.raw);
    const phaseOf = (id: string) => res.body.classes.find((c: { id: string }) => c.id === id)?.phase;
    assert.equal(phaseOf(upcoming.id), "upcoming");
    assert.equal(phaseOf(live.id), "live");
    assert.equal(phaseOf(done.id), "done");
    assert.equal(phaseOf(cancelled.id), "cancelled");
  });

  test("the pure rule: end = start + duration, and a cancelled class never reads live", async () => {
    const m = (await import("@tnajem/shared")) as Record<string, unknown>;
    assert.equal(typeof m.classPhase, "function", "classPhase is exported");
    const phase = m.classPhase as (c: { starts_at: string; duration_min?: number; status?: string }, now?: number) => string;
    const start = Date.parse("2026-10-01T16:00:00Z");
    const at = (min: number) => start + min * 60_000;
    const cls = { starts_at: new Date(start).toISOString(), duration_min: 90, status: "scheduled" };
    assert.equal(phase(cls, at(-1)), "upcoming");
    assert.equal(phase(cls, at(0)), "live");
    assert.equal(phase(cls, at(89)), "live");
    assert.equal(phase(cls, at(90)), "done");
    assert.equal(phase({ ...cls, status: "cancelled" }, at(30)), "cancelled");
    assert.equal(phase({ ...cls, status: "done" }, at(-60)), "done");
  });
});
