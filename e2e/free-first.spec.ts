import { test, expect } from "@playwright/test";
import { sql } from "./support/db";
import { seedProfile, seedTutor, seedClass } from "./support/seed";
import { mintSession } from "./support/session";

/* THE FREE FIRST SESSION IS OPT-IN, AND THE SERVER IS WHAT ENFORCES IT.

   Step 6 turned a platform-wide promise into a per-tutor choice, default off.
   The unit tests in apps/api/test/free-first.test.ts pin the predicate; this spec
   pins the two places the predicate has to actually be WIRED, because a rule that
   is correct in a helper nobody calls is the failure mode this project has hit
   three separate times.

     1. POST /bookings must not write is_free = true against a tutor who never
        opted in — not even when the class row says is_free_first. Every class
        created before packages/db/sql/0008 carries that flag from the old column
        default, so this is not a hypothetical: it is the state of the existing
        data.

     2. The public storefront must not tell a student the session is free when it
        is not. That is the surface a stranger reads off a WhatsApp link.

   ADDED, never edited into an existing spec — the Stage A rule still holds.
   Adding coverage is allowed; changing an existing assertion is the tripwire. */

const API = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";

async function book(token: string, classId: string) {
  const res = await fetch(`${API}/bookings`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `tnajem_session=${token}` },
    body: JSON.stringify({ classId }),
  });
  return res.json() as Promise<{ ok: boolean; already?: boolean; error?: string }>;
}

async function storefront(slug: string) {
  const res = await fetch(`${API}/tutors/${slug}/storefront`);
  return res.json() as Promise<{
    tutor: { offers_free_first_session: boolean };
    classes: { id: string; is_free_first: boolean }[];
  } | null>;
}

/** What the booking row actually says. The DTO can be rewritten; this cannot. */
async function bookingIsFree(classId: string): Promise<boolean | null> {
  const [row] = await sql<{ is_free: boolean | null }[]>`
    select is_free from bookings where class_id = ${classId} limit 1`;
  return row?.is_free ?? null;
}

test("a class flagged free under a tutor who never opted in is NOT booked free", async () => {
  /* The exact shape of every pre-0008 row: class says free, tutor never agreed. */
  const tutor = await seedTutor({ status: "verified", offersFreeFirstSession: false });
  const klass = await seedClass({
    tutorId: tutor.id,
    seats: 5,
    isFreeFirst: true, // the stale flag
    priceTnd: 20,
    hoursFromNow: 96,
  });

  const student = await seedProfile({ role: "student", birthYear: 1995 });
  const token = await mintSession(student.id);

  const res = await book(token, klass.id);
  expect(res.ok, "the booking itself must still succeed — this is about price, not access").toBe(true);

  expect(
    await bookingIsFree(klass.id),
    "is_free was written from the class flag alone, so a tutor who never opted in gave a session away",
  ).toBe(false);
});

test("both halves saying yes IS free", async () => {
  // The rule must still let the feature work, or it is a removal, not an opt-in.
  const tutor = await seedTutor({ status: "verified", offersFreeFirstSession: true });
  const klass = await seedClass({
    tutorId: tutor.id,
    seats: 5,
    isFreeFirst: true,
    priceTnd: 20,
    hoursFromNow: 96,
  });

  const student = await seedProfile({ role: "student", birthYear: 1995 });
  const token = await mintSession(student.id);

  expect((await book(token, klass.id)).ok).toBe(true);
  expect(await bookingIsFree(klass.id)).toBe(true);
});

test("a tutor who opted in can still run a paid class", async () => {
  const tutor = await seedTutor({ status: "verified", offersFreeFirstSession: true });
  const klass = await seedClass({
    tutorId: tutor.id,
    seats: 5,
    isFreeFirst: false,
    priceTnd: 35,
    hoursFromNow: 96,
  });

  const student = await seedProfile({ role: "student", birthYear: 1995 });
  const token = await mintSession(student.id);

  expect((await book(token, klass.id)).ok).toBe(true);
  expect(await bookingIsFree(klass.id)).toBe(false);
});

test("the public storefront does not advertise a free session the tutor never offered", async () => {
  const tutor = await seedTutor({ status: "verified", offersFreeFirstSession: false });
  await seedClass({ tutorId: tutor.id, seats: 5, isFreeFirst: true, priceTnd: 20, hoursFromNow: 96 });

  const data = await storefront(tutor.slug);
  expect(data, "a verified tutor's storefront must be readable").not.toBeNull();
  expect(data!.tutor.offers_free_first_session).toBe(false);
  expect(
    data!.classes.every((c) => c.is_free_first === false),
    "the storefront served the raw class flag instead of the effective one",
  ).toBe(true);
});

test("the storefront does advertise it when the tutor opted in", async () => {
  const tutor = await seedTutor({ status: "verified", offersFreeFirstSession: true });
  await seedClass({ tutorId: tutor.id, seats: 5, isFreeFirst: true, priceTnd: 20, hoursFromNow: 96 });

  const data = await storefront(tutor.slug);
  expect(data!.tutor.offers_free_first_session).toBe(true);
  expect(data!.classes.some((c) => c.is_free_first === true)).toBe(true);
});

test("a tutor turns it off, and the storefront stops saying it", async () => {
  /* The endpoint behind the dashboard toggle. Worth its own case because turning
     it OFF is the direction that matters: a stale "Première séance offerte" is a
     promise the tutor has withdrawn and the page is still making. */
  const profile = await seedProfile({ role: "tutor", birthYear: 1990 });
  const tutor = await seedTutor({
    profileId: profile.id,
    status: "verified",
    offersFreeFirstSession: true,
  });
  await seedClass({ tutorId: tutor.id, seats: 5, isFreeFirst: true, priceTnd: 20, hoursFromNow: 96 });

  const token = await mintSession(profile.id);
  const res = await fetch(`${API}/tutors/free-first-session`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `tnajem_session=${token}` },
    body: JSON.stringify({ enabled: false }),
  });
  const body = (await res.json()) as { ok: boolean; enabled?: boolean; revalidate?: { tutors?: string[] } };
  expect(body.ok).toBe(true);
  expect(body.enabled).toBe(false);
  expect(
    body.revalidate?.tutors,
    "the endpoint must report the slug so the web can bust the ISR cache — otherwise the withdrawn claim stays up",
  ).toContain(tutor.slug);

  const data = await storefront(tutor.slug);
  expect(data!.tutor.offers_free_first_session).toBe(false);
  expect(data!.classes.every((c) => c.is_free_first === false)).toBe(true);
});

test("a student cannot flip another tutor's free-session switch", async () => {
  const student = await seedProfile({ role: "student", birthYear: 1995 });
  const token = await mintSession(student.id);
  const res = await fetch(`${API}/tutors/free-first-session`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `tnajem_session=${token}` },
    body: JSON.stringify({ enabled: true }),
  });
  const body = (await res.json()) as { ok: boolean; error?: string };
  expect(body.ok).toBe(false);
  expect(body.error).toBe("not-a-tutor");
});
