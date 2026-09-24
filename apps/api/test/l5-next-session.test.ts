import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { nextSessionOf } from "@tnajem/shared";

/* Phase A · A18.11 (lane L5). The storefront's "Prochaine séance" panel showed the
   first class WITH SEATS LEFT, not the next class: a full class on Monday was
   skipped and Thursday's was presented as "the next session". Now `next` is the
   earliest upcoming, non-cancelled class; when it is full the panel says
   "Complet" and offers `bookable` — the next class that still has a seat. */

const NOW = Date.parse("2026-10-01T08:00:00Z");
const at = (h: number) => new Date(NOW + h * 3600_000).toISOString();
const cls = (id: string, h: number, seatsLeft: number, status = "scheduled") => ({
  id, starts_at: at(h), seats_left: seatsLeft, status: status as "scheduled" | "cancelled",
});

describe("A18.11 — the next session is the next session", () => {
  test("the earliest class is full: it is still the next session, and the next one with a seat is offered", () => {
    const monday = cls("monday", 24, 0);
    const thursday = cls("thursday", 96, 5);
    const r = nextSessionOf([thursday, monday], NOW);
    assert.equal(r.next?.id, "monday", "the next session is Monday's, full or not");
    assert.equal(r.bookable?.id, "thursday", "Thursday's is offered because it has a seat");
  });

  test("cancelled and already-started classes are never the next session", () => {
    const started = cls("started", -1, 3);
    const cancelled = cls("cancelled", 10, 3, "cancelled");
    const later = cls("later", 30, 3);
    const r = nextSessionOf([started, cancelled, later], NOW);
    assert.equal(r.next?.id, "later");
    assert.equal(r.bookable?.id, "later");
  });

  test("everything full: a next session, nothing bookable", () => {
    const r = nextSessionOf([cls("a", 5, 0), cls("b", 9, 0)], NOW);
    assert.equal(r.next?.id, "a");
    assert.equal(r.bookable, null);
  });

  test("nothing upcoming: neither", () => {
    const r = nextSessionOf([cls("past", -30, 4)], NOW);
    assert.equal(r.next, null);
    assert.equal(r.bookable, null);
  });
});
