import { test, expect } from "@playwright/test";
import { sql } from "./support/db";
import { seedProfile, seedTutor, seedClass } from "./support/seed";
import { mintSession } from "./support/session";

/* THE PROOF THAT THE PORT DID NOT REINTRODUCE OVERSELLING.

   seat-claim.race.spec.ts races the SQL statement directly and is honest about
   that: it tests the claim, not the endpoint. It was written before reserveSeat
   moved and is transport-independent on purpose, so it stays valid either side of
   the port.

   This spec is the other half, and it only became possible once reserveSeat ran
   behind HTTP: N distinct students, N distinct sessions, all POSTing /bookings at
   the same instant against a class with ONE seat. It exercises everything the SQL
   test cannot — Fastify's concurrency, the connection pool, the transaction
   boundary, and the unique(class_id, student_id) fallback.

   ADDED, never edited into an existing spec. That is the Stage A rule: adding
   coverage is allowed; changing an existing assertion to make something pass is
   the tripwire. */

const API = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";

async function claim(token: string, classId: string) {
  const res = await fetch(`${API}/bookings`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `tnajem_session=${token}` },
    body: JSON.stringify({ classId }),
  });
  return res.json() as Promise<{ ok: boolean; already?: boolean; error?: string }>;
}

test("the API cannot oversell the last seat under 8 concurrent students", async () => {
  const tutor = await seedTutor({ status: "verified" });
  const klass = await seedClass({ tutorId: tutor.id, seats: 1, seatsTaken: 0, hoursFromNow: 96 });

  // Adults, so the minor-consent gate never fires and we are measuring the claim.
  const tokens = await Promise.all(
    Array.from({ length: 8 }, async () => {
      const s = await seedProfile({ role: "student", birthYear: 1990 });
      return mintSession(s.id);
    }),
  );

  const results = await Promise.all(tokens.map((t) => claim(t, klass.id)));

  const won = results.filter((r) => r.ok && !r.already).length;
  const full = results.filter((r) => r.error === "full").length;

  expect(won, "exactly one student may take the last seat").toBe(1);
  expect(full, "every other student must be told the class is full").toBe(7);

  // The database is the real assertion, not the response bodies.
  const [row] = await sql<{ seats_taken: number; seats: number }[]>`
    select seats_taken, seats from classes where id = ${klass.id}`;
  expect(row.seats_taken).toBe(1);
  expect(row.seats_taken).toBeLessThanOrEqual(row.seats);

  const [bk] = await sql<{ n: number }[]>`
    select count(*)::int n from bookings
    where class_id = ${klass.id} and status <> 'cancelled'`;
  expect(bk.n, "one seat, one booking").toBe(1);
});

test("the same student double-submitting takes exactly one seat", async () => {
  const tutor = await seedTutor({ status: "verified" });
  const klass = await seedClass({ tutorId: tutor.id, seats: 5, seatsTaken: 0, hoursFromNow: 96 });
  const student = await seedProfile({ role: "student", birthYear: 1990 });
  const token = await mintSession(student.id);

  // Six simultaneous submits from ONE student — the double-tap case.
  const results = await Promise.all(Array.from({ length: 6 }, () => claim(token, klass.id)));
  expect(
    results.every((r) => r.ok),
    `every response must be a success, not an error — got ${JSON.stringify(results)}`,
  ).toBe(true);

  const [row] = await sql<{ seats_taken: number }[]>`
    select seats_taken from classes where id = ${klass.id}`;
  /* unique(class_id, student_id) turns the losers into rollbacks, and the catch
     maps them to { ok:true, already:true }. A leaked seat here would mean the
     rollback did not include the increment. */
  expect(row.seats_taken, "a double-submit must consume exactly one seat").toBe(1);
});

test("a sold-out class is refused by the API, not just hidden in the UI", async () => {
  const tutor = await seedTutor({ status: "verified" });
  const klass = await seedClass({ tutorId: tutor.id, seats: 2, seatsTaken: 2, hoursFromNow: 96 });
  const student = await seedProfile({ role: "student", birthYear: 1990 });

  const res = await claim(await mintSession(student.id), klass.id);
  expect(res.error).toBe("full");

  const [row] = await sql<{ seats_taken: number }[]>`
    select seats_taken from classes where id = ${klass.id}`;
  expect(row.seats_taken).toBe(2);
});

test("an unverified tutor's class cannot be booked by direct id", async () => {
  /* The discovery surfaces hide non-verified tutors, but the class id is a bookable
     handle: a rejected tutor could hand out /class/<id> and take real bookings from
     minors. The gate has to be on the booking path. */
  const tutor = await seedTutor({ status: "pending" });
  const klass = await seedClass({ tutorId: tutor.id, seats: 5, hoursFromNow: 96 });
  const student = await seedProfile({ role: "student", birthYear: 1990 });

  const res = await claim(await mintSession(student.id), klass.id);
  expect(res.error).toBe("unavailable");

  const [bk] = await sql<{ n: number }[]>`
    select count(*)::int n from bookings where class_id = ${klass.id}`;
  expect(bk.n).toBe(0);
});

test("a tutor cannot book their own class", async () => {
  const me = await seedProfile({ role: "tutor", birthYear: 1985 });
  const tutor = await seedTutor({ profileId: me.id, status: "verified" });
  const klass = await seedClass({ tutorId: tutor.id, seats: 5, hoursFromNow: 96 });

  const res = await claim(await mintSession(me.id), klass.id);
  expect(res.error).toBe("own-class");
});

test("a class in the past cannot be booked", async () => {
  const tutor = await seedTutor({ status: "verified" });
  const klass = await seedClass({ tutorId: tutor.id, seats: 5, hoursFromNow: -48 });
  const student = await seedProfile({ role: "student", birthYear: 1990 });

  const res = await claim(await mintSession(student.id), klass.id);
  expect(res.error, "you could once reserve last month's session and then review it").toBe("unavailable");
});
