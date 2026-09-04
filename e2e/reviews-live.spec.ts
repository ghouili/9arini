import { test, expect } from "@playwright/test";
import { sql } from "./support/db";
import { seedProfile, seedTutor, seedClass, seedBooking } from "./support/seed";
import { mintSession } from "./support/session";

/* createReview and canJoinClass, ported in the reviews/notif-live domain.

   Both carry guardrails that nothing asserted before: a review must come from
   someone who actually booked and attended, and meet_url is the ONLY thing
   protecting a live room full of minors. */

const API = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";

const post = (path: string, token: string, body: unknown) =>
  fetch(`${API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `tnajem_session=${token}` },
    body: JSON.stringify(body),
  }).then((r) => r.json() as Promise<Record<string, unknown>>);

const get = (path: string, token?: string) =>
  fetch(`${API}${path}`, {
    headers: token ? { cookie: `tnajem_session=${token}` } : {},
  }).then((r) => r.json() as Promise<Record<string, unknown>>);

test("only a student who booked a past class can review it", async () => {
  const tutor = await seedTutor({ status: "verified" });
  const past = await seedClass({ tutorId: tutor.id, seats: 5, hoursFromNow: -48 });
  const booked = await seedProfile({ role: "student", birthYear: 1990 });
  const stranger = await seedProfile({ role: "student", birthYear: 1990 });
  await seedBooking({ classId: past.id, studentId: booked.id });

  const strangerTok = await mintSession(stranger.id);
  const bookedTok = await mintSession(booked.id);

  // Someone who never booked cannot review — this is what stops 5★ spraying.
  const notBooked = await post("/reviews", strangerTok, { classId: past.id, rating: 5 });
  expect(notBooked.error).toBe("not-booked");

  const ok = await post("/reviews", bookedTok, { classId: past.id, rating: 5, text: "Très clair." });
  expect(ok.ok).toBe(true);

  // unique(student_id, class_id) — one review per student per class.
  const again = await post("/reviews", bookedTok, { classId: past.id, rating: 1 });
  expect(again.error).toBe("already-reviewed");

  const [row] = await sql<{ n: number }[]>`
    select count(*)::int n from reviews where class_id = ${past.id}`;
  expect(row.n).toBe(1);

  /* The rating is recomputed from real rows inside the same transaction — never a
     blind average written back, which is how a concurrent second review used to
     be silently dropped. */
  const [t] = await sql<{ rating: string }[]>`select rating from tutors where id = ${tutor.id}`;
  expect(Number(t.rating)).toBe(5);
});

test("a class that has not started yet cannot be reviewed", async () => {
  const tutor = await seedTutor({ status: "verified" });
  const future = await seedClass({ tutorId: tutor.id, seats: 5, hoursFromNow: 96 });
  const student = await seedProfile({ role: "student", birthYear: 1990 });
  await seedBooking({ classId: future.id, studentId: student.id });

  const res = await post("/reviews", await mintSession(student.id), { classId: future.id, rating: 5 });
  expect(res.error, "you could once book last month's class and review it").toBe("class-not-started");
});

test("the live room is closed to anyone without a booking", async () => {
  const owner = await seedProfile({ role: "tutor", birthYear: 1985 });
  const tutor = await seedTutor({ profileId: owner.id, status: "verified" });
  const klass = await seedClass({ tutorId: tutor.id, seats: 5, hoursFromNow: 2 });
  const booked = await seedProfile({ role: "student", birthYear: 1990 });
  const stranger = await seedProfile({ role: "student", birthYear: 1990 });
  await seedBooking({ classId: klass.id, studentId: booked.id });

  const asStranger = await get(`/classes/${klass.id}/join`, await mintSession(stranger.id));
  expect(asStranger.canJoin).toBe(false);
  expect(asStranger.meetUrl, "a refusal must carry NO room URL at all").toBeUndefined();

  const anon = await get(`/classes/${klass.id}/join`);
  expect(anon.canJoin).toBe(false);
  expect(anon.meetUrl).toBeUndefined();

  const asBooked = await get(`/classes/${klass.id}/join`, await mintSession(booked.id));
  expect(asBooked.canJoin).toBe(true);
  expect(asBooked.role).toBe("student");
  expect(typeof asBooked.meetUrl).toBe("string");

  const asOwner = await get(`/classes/${klass.id}/join`, await mintSession(owner.id));
  expect(asOwner.canJoin).toBe(true);
  expect(asOwner.role).toBe("tutor");
});

test("a cancelled booking loses access to the room", async () => {
  const tutor = await seedTutor({ status: "verified" });
  const klass = await seedClass({ tutorId: tutor.id, seats: 5, hoursFromNow: 2 });
  const student = await seedProfile({ role: "student", birthYear: 1990 });
  await seedBooking({ classId: klass.id, studentId: student.id, status: "cancelled" });

  const res = await get(`/classes/${klass.id}/join`, await mintSession(student.id));
  expect(res.canJoin, "cancelling must close the door, not just hide the button").toBe(false);
  expect(res.meetUrl).toBeUndefined();
});

test("notifications are scoped to their owner", async () => {
  const a = await seedProfile({ role: "student", birthYear: 1990 });
  const b = await seedProfile({ role: "student", birthYear: 1990 });
  await sql`insert into notifications (id, profile_id, kind, title, body)
            values (gen_random_uuid(), ${a.id}, 'new_booking', 'For A', 'body')`;

  const mine = await get("/notifications", await mintSession(a.id));
  expect(Array.isArray(mine)).toBe(true);
  expect((mine as unknown as { title: string }[]).some((n) => n.title === "For A")).toBe(true);

  const theirs = await get("/notifications", await mintSession(b.id));
  expect(
    (theirs as unknown as { title: string }[]).some((n) => n.title === "For A"),
    "one user must never see another's notifications",
  ).toBe(false);
});
