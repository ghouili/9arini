import { test, expect } from "@playwright/test";
import { sql } from "./support/db";
import { seedBooking, seedClass, seedProfile, seedTutor } from "./support/seed";
import { mintSession } from "./support/session";
import { api } from "./support/journey";

/* ACCESS RULES found by the Stage 4 security review (15 Sept 2026). Each test is
   the exploit the review described, ending in the request that must now fail. */

async function roomToken(classId: string): Promise<string> {
  const [r] = await sql<{ room_token: string }[]>`select room_token from classes where id = ${classId}`;
  return r.room_token;
}

async function verifiedTutorWithClass(opts: { hoursFromNow?: number; minutesFromNow?: number } = {}) {
  const tutorProfile = await seedProfile({ role: "tutor", birthYear: 1985 });
  const tutor = await seedTutor({ profileId: tutorProfile.id, status: "verified" });
  const at = opts.minutesFromNow !== undefined ? new Date(Date.now() + opts.minutesFromNow * 60_000) : undefined;
  const klass = await seedClass({ tutorId: tutor.id, seats: 10, hoursFromNow: opts.hoursFromNow ?? 96, at });
  return { tutorProfile, tutor, klass };
}

test.describe("security: a room link does not outlive the seat it was given for", () => {
  test("book, fetch the link, cancel: the fetched link is retired", async () => {
    const { tutorProfile, klass } = await verifiedTutorWithClass();
    const student = await seedProfile({ role: "student", birthYear: 1995 });
    const token = await mintSession(student.id);

    const booked = await api("/bookings", token, { classId: klass.id });
    expect(booked.ok, JSON.stringify(booked)).toBe(true);
    const join = (await api(`/classes/${klass.id}/join`, token)) as { canJoin: boolean; meetUrl?: string };
    expect(join.canJoin).toBe(true);
    const before = await roomToken(klass.id);
    expect(join.meetUrl).toContain(before);

    const [bk] = await sql<{ id: string }[]>`select id from bookings where class_id = ${klass.id} and student_id = ${student.id}`;
    expect((await api("/bookings/cancel", token, { bookingId: bk.id })).ok).toBe(true);

    const after = await roomToken(klass.id);
    expect(after, "the room token must change when the seat is given up").not.toBe(before);
    const tutorJoin = (await api(`/classes/${klass.id}/join`, await mintSession(tutorProfile.id))) as { meetUrl?: string };
    expect(tutorJoin.meetUrl).toContain(after);
    expect(tutorJoin.meetUrl, "the link the ex-student kept is not the room anymore").not.toContain(before);
    expect(((await api(`/classes/${klass.id}/join`, token)) as { canJoin: boolean }).canJoin).toBe(false);
  });

  test("inside the last 30 minutes the room is left alone (the tutor may be in it)", async () => {
    const { klass } = await verifiedTutorWithClass({ minutesFromNow: 20 });
    const student = await seedProfile({ role: "student", birthYear: 1995 });
    const token = await mintSession(student.id);
    const booking = await seedBooking({ classId: klass.id, studentId: student.id });
    const before = await roomToken(klass.id);

    expect((await api("/bookings/cancel", token, { bookingId: booking.id })).ok).toBe(true);
    expect(await roomToken(klass.id), "no split class: the token stays").toBe(before);
  });
});

test.describe("security: a guardian's access follows the current consent", () => {
  /* phase-a/integrate (A13). This used to prove the child could move the consent to
     another address and end the first address's access at once — which is exactly
     the hole A13 closes: a second address of the child's own was enough to unlink
     the real parent. Now: before any guardian account is linked the child can still
     fix a typo; once one is linked, the address is locked for the child. */
  test("before a guardian is linked the child can correct the address; after, the change is refused and access stays", async () => {
    const child = await seedProfile({ role: "student", birthYear: new Date().getFullYear() - 15 });
    const typo = await seedProfile({ role: "guardian", birthYear: 1979 });
    const parent = await seedProfile({ role: "guardian", birthYear: 1980 });
    const other = await seedProfile({ role: "guardian", birthYear: 1981 });
    const childToken = await mintSession(child.id);

    const consent = (addr: string) =>
      api("/consent", childToken, { guardianName: "Parent E2E", guardianPhone: "+21620000000", guardianEmail: addr });

    // No guardian account has looked yet: a typo is still the child's to fix.
    expect((await consent(typo.email)).ok).toBe(true);
    expect((await consent(parent.email)).ok, "an unlinked address can still be corrected").toBe(true);

    const parentToken = await mintSession(parent.id);
    const first = (await api("/guardian/children", parentToken)) as unknown as { id: string }[];
    expect(first.map((c) => c.id), "the address on the consent is linked").toContain(child.id);

    expect(await consent(other.email), "a linked guardian cannot be replaced by the child").toEqual({
      ok: false,
      error: "guardian-locked",
    });
    const after = (await api("/guardian/children", parentToken)) as unknown as { id: string }[];
    expect(after.map((c) => c.id), "the linked parent keeps access").toContain(child.id);
    const others = (await api("/guardian/children", await mintSession(other.id))) as unknown as { id: string }[];
    expect(others.map((c) => c.id), "the address the child typed gets nothing").not.toContain(child.id);
    const [links] = await sql<{ n: number }[]>`
      select count(*)::int n from guardian_links where guardian_profile_id = ${parent.id} and minor_profile_id = ${child.id}`;
    expect(links.n, "and the link row is untouched").toBe(1);
  });
});

test.describe("security: a cancelled booking closes the conversation for sending", () => {
  test("after a cancellation neither side can send; the history stays readable", async () => {
    const { tutorProfile, klass } = await verifiedTutorWithClass();
    const student = await seedProfile({ role: "student", birthYear: 1995 });
    const studentToken = await mintSession(student.id);
    const tutorToken = await mintSession(tutorProfile.id);
    const booking = await seedBooking({ classId: klass.id, studentId: student.id });

    const threadId = (await api("/threads", studentToken, { bookingId: booking.id })).threadId as string;
    expect((await api(`/threads/${threadId}/messages`, tutorToken, { body: "Bonjour, à jeudi." })).ok).toBe(true);

    expect((await api("/bookings/cancel", studentToken, { bookingId: booking.id })).ok).toBe(true);
    expect(await api(`/threads/${threadId}/messages`, tutorToken, { body: "Pourquoi tu as annulé ?" }))
      .toEqual({ ok: false, error: "booking-cancelled" });
    expect(await api(`/threads/${threadId}/messages`, studentToken, { body: "…" }))
      .toEqual({ ok: false, error: "booking-cancelled" });

    const read = (await api(`/threads/${threadId}`, studentToken)) as { messages?: unknown[] };
    expect(read.messages?.length, "the conversation so far is still there").toBe(1);
  });
});

test.describe("security: guardian consent is checked for every account that may be a minor", () => {
  test("an account with no age on file needs consent to book, whatever its role", async () => {
    const { klass } = await verifiedTutorWithClass();
    // /signup/prof asks no age: a tutor-role account with an unknown birth year.
    const unknownAge = await seedProfile({ role: "tutor", birthYear: null });
    const res = await api("/bookings", await mintSession(unknownAge.id), { classId: klass.id });
    expect(res).toMatchObject({ ok: false, error: "needs-consent" });
    const [n] = await sql<{ n: number }[]>`select count(*)::int n from bookings where student_id = ${unknownAge.id}`;
    expect(n.n).toBe(0);
  });
});
