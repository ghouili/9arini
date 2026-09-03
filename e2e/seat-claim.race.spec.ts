import { test, expect } from "@playwright/test";
import postgres from "postgres";
import { sql } from "./support/db";
import { DB_URL } from "./support/env";
import { seedTutor, seedClass } from "./support/seed";

/* THE seat-claim invariant, tested at the only layer where a genuine race can be
   manufactured.

   Be honest about what this does and does not prove: it tests the SQL, not the
   endpoint. At the UI layer you cannot create a real race — the claim transaction
   is ~1ms and Promise.all over browser clicks has tens of ms of jitter, so a
   "passing" UI test may simply have serialised. concurrency.spec.ts asserts the
   product-level invariant; this one asserts atomicity.

   It is deliberately transport-independent: it does not care whether the caller
   is Next or Fastify, so it stays valid and unedited through the whole Stage A
   port. After Step 3 an API-level race spec is ADDED alongside it (adding is
   allowed; editing a Stage A spec is the tripwire). */

const CLAIM = `
  UPDATE classes SET seats_taken = coalesce(seats_taken,0) + 1
  WHERE id = $1 AND coalesce(seats_taken,0) < coalesce(seats,0)
  RETURNING id`;

test("the last seat cannot be oversold, under 16 simultaneous claims", async () => {
  const tutor = await seedTutor({ status: "verified" });
  const klass = await seedClass({ tutorId: tutor.id, seats: 1, seatsTaken: 0 });

  /* A dedicated pool: 16 real connections so all 16 statements are in flight in
     the server at once. Reusing the suite's max:1 client would serialise them and
     the test would prove nothing. */
  const racer = postgres(DB_URL, { max: 16, onnotice: () => {} });
  try {
    const results = await Promise.all(
      Array.from({ length: 16 }, () => racer.unsafe(CLAIM, [klass.id]).catch(() => [])),
    );
    const winners = results.filter((r) => r.length > 0).length;
    expect(winners, "exactly one claim may win the last seat").toBe(1);
  } finally {
    await racer.end({ timeout: 5 });
  }

  const [row] = await sql<{ seats_taken: number; seats: number }[]>`
    select seats_taken, seats from classes where id = ${klass.id}`;
  expect(row.seats_taken, "seats_taken must never exceed seats").toBe(1);
  expect(row.seats_taken).toBeLessThanOrEqual(row.seats);
});

test("a class that is already full accepts no further claims", async () => {
  const tutor = await seedTutor({ status: "verified" });
  const klass = await seedClass({ tutorId: tutor.id, seats: 3, seatsTaken: 3 });

  const racer = postgres(DB_URL, { max: 8, onnotice: () => {} });
  try {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => racer.unsafe(CLAIM, [klass.id]).catch(() => [])),
    );
    expect(results.filter((r) => r.length > 0).length).toBe(0);
  } finally {
    await racer.end({ timeout: 5 });
  }

  const [row] = await sql<{ seats_taken: number }[]>`
    select seats_taken from classes where id = ${klass.id}`;
  expect(row.seats_taken).toBe(3);
});
