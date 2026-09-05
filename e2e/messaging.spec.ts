import { test, expect } from "@playwright/test";
import { sql } from "./support/db";
import { seedProfile, seedTutor, seedClass, seedBooking } from "./support/seed";
import { mintSession } from "./support/session";

/* MESSAGING (Step 8b) — the channel that replaces what Step 8 closed.

   The rule that carries the whole feature: EVERY THREAD IS A BOOKING. You cannot
   address someone who has not taken a seat in your class, or whose class you have
   not booked. Most of this file exists to prove that rule holds from the outside,
   because it is the one that makes an inbox safe to point minors at.

   ADDED, never edited into an existing spec. */

const API = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";

async function api(path: string, token: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", cookie: `tnajem_session=${token}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return res.json() as Promise<Record<string, unknown>>;
}

/** A tutor, a student, a class and a booking between them. */
async function pair(opts: { studentBirthYear?: number } = {}) {
  const tutorProfile = await seedProfile({ role: "tutor", birthYear: 1985, fullName: "Yassine Belhadj" });
  const tutor = await seedTutor({ profileId: tutorProfile.id, status: "verified" });
  const klass = await seedClass({ tutorId: tutor.id, seats: 10, hoursFromNow: 96 });
  const student = await seedProfile({
    role: "student",
    birthYear: opts.studentBirthYear ?? 1995,
    fullName: "Amine Karoui",
  });
  const booking = await seedBooking({ classId: klass.id, studentId: student.id });
  return {
    klass,
    booking,
    tutorToken: await mintSession(tutorProfile.id),
    studentToken: await mintSession(student.id),
    tutorProfile,
    student,
  };
}

async function openThread(token: string, bookingId: string): Promise<string> {
  const res = await api("/threads", token, { bookingId });
  expect(res.ok, `opening the thread failed: ${JSON.stringify(res)}`).toBe(true);
  return res.threadId as string;
}

test.describe("threads are scoped to a booking", () => {
  test("both sides of a booking open the SAME thread", async () => {
    const p = await pair();
    const fromStudent = await openThread(p.studentToken, p.booking.id);
    const fromTutor = await openThread(p.tutorToken, p.booking.id);
    expect(fromTutor, "one booking is one conversation, not two").toBe(fromStudent);

    const [n] = await sql<{ n: number }[]>`
      select count(*)::int n from message_threads where booking_id = ${p.booking.id}`;
    expect(n.n).toBe(1);
  });

  test("opening twice concurrently still yields ONE thread", async () => {
    const p = await pair();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => api("/threads", p.studentToken, { bookingId: p.booking.id })),
    );
    const ids = new Set(results.map((r) => r.threadId));
    expect(ids.size, "a double-tap on a slow phone must not fork the conversation").toBe(1);
  });

  test("A STRANGER CANNOT OPEN A THREAD ON SOMEONE ELSE'S BOOKING", async () => {
    /* The rule the whole feature rests on. If this ever passes, the product has
       an open inbox that reaches minors. */
    const p = await pair();
    const stranger = await seedProfile({ role: "student", birthYear: 1995 });
    const res = await api("/threads", await mintSession(stranger.id), { bookingId: p.booking.id });
    expect(res.ok).toBe(false);
    expect(res.error, "and it must not reveal whether that booking exists").toBe("not-found");
  });

  test("a stranger cannot read a thread they are not in", async () => {
    const p = await pair();
    const threadId = await openThread(p.studentToken, p.booking.id);
    await api(`/threads/${threadId}/messages`, p.studentToken, { body: "Bonjour" });

    const stranger = await seedProfile({ role: "student", birthYear: 1995 });
    const token = await mintSession(stranger.id);
    const detail = await api(`/threads/${threadId}`, token);
    expect(detail, "a thread id is a bare uuid — it cannot be the only thing protecting a conversation").toBeNull();

    const send = await api(`/threads/${threadId}/messages`, token, { body: "coucou" });
    expect(send.ok).toBe(false);
    expect(send.error).toBe("not-found");
  });

  test("a cancelled booking opens no NEW thread", async () => {
    const p = await pair();
    await sql`update bookings set status = 'cancelled' where id = ${p.booking.id}`;
    const res = await api("/threads", p.studentToken, { bookingId: p.booking.id });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("booking-cancelled");
  });

  test("...but a conversation that already happened stays readable", async () => {
    /* Cancelling a seat does not retroactively make the messages private. Losing
       the history would also lose the evidence behind any report made about it. */
    const p = await pair();
    const threadId = await openThread(p.studentToken, p.booking.id);
    await api(`/threads/${threadId}/messages`, p.studentToken, { body: "À jeudi !" });
    await sql`update bookings set status = 'cancelled' where id = ${p.booking.id}`;

    const again = await api("/threads", p.studentToken, { bookingId: p.booking.id });
    expect(again.ok).toBe(true);
    expect(again.threadId).toBe(threadId);

    const detail = (await api(`/threads/${threadId}`, p.tutorToken)) as { messages: unknown[] };
    expect(detail.messages).toHaveLength(1);
  });
});

test.describe("what happens to a message", () => {
  test("markup never reaches the database", async () => {
    /* The stored-XSS surface. Sanitising happens on the way IN so that a future
       consumer which forgets to escape has nothing to execute. */
    const p = await pair();
    const threadId = await openThread(p.studentToken, p.booking.id);
    await api(`/threads/${threadId}/messages`, p.studentToken, {
      body: "<img src=x onerror=alert(1)> à jeudi",
    });

    const [row] = await sql<{ body: string }[]>`
      select m.body from messages m where m.thread_id = ${threadId} limit 1`;
    expect(row.body, "a tag was persisted").not.toMatch(/[<>]/);
    expect(row.body, "the actual message survived").toContain("à jeudi");
  });

  test("contact details are MASKED, not refused", async () => {
    /* Rejecting a message loses the conversation and teaches people to route
       around the filter. Masking keeps the point and removes the details. */
    const p = await pair();
    const threadId = await openThread(p.studentToken, p.booking.id);
    const res = await api(`/threads/${threadId}/messages`, p.studentToken, {
      body: "Super séance ! Mon numéro c'est 98123456 si besoin.",
    });
    expect(res.ok, "a message is never refused for this").toBe(true);
    expect(res.masked, "and the sender is told their words were edited").toBe(true);

    const [row] = await sql<{ body: string }[]>`
      select body from messages where thread_id = ${threadId} limit 1`;
    expect(row.body).not.toContain("98123456");
    expect(row.body).toContain("Super séance");
  });

  test("an ordinary message is not touched", async () => {
    const p = await pair();
    const threadId = await openThread(p.studentToken, p.booking.id);
    const res = await api(`/threads/${threadId}/messages`, p.studentToken, {
      body: "Merci pour la séance, on révise les annales 2024 jeudi à 18h ?",
    });
    expect(res.ok).toBe(true);
    expect(res.masked, "a normal sentence must not be flagged").toBe(false);
  });

  test("an empty or markup-only message is refused", async () => {
    const p = await pair();
    const threadId = await openThread(p.studentToken, p.booking.id);
    for (const body of ["", "   ", "<script>alert(1)</script>"]) {
      const res = await api(`/threads/${threadId}/messages`, p.studentToken, { body });
      expect(res.ok, JSON.stringify(body)).toBe(false);
      expect(res.error).toBe("message-empty");
    }
  });

  test("the counterparty sees a FIRST NAME, never the full one", async () => {
    const p = await pair();
    const threadId = await openThread(p.studentToken, p.booking.id);
    const detail = await api(`/threads/${threadId}`, p.tutorToken);
    expect(detail.withName).toBe("Amine");
    expect(JSON.stringify(detail), "Step 8's allow-list applies to new features too")
      .not.toContain("Karoui");
  });

  test("a minor's thread is marked as one, for both sides", async () => {
    const minorYear = new Date().getFullYear() - 15;
    const p = await pair({ studentBirthYear: minorYear });
    const threadId = await openThread(p.studentToken, p.booking.id);
    for (const [who, token] of [["tutor", p.tutorToken], ["student", p.studentToken]] as const) {
      const detail = await api(`/threads/${threadId}`, token);
      expect(detail.studentIsMinor, `${who} was not told this is a minor's thread`).toBe(true);
    }
  });
});

test.describe("reporting", () => {
  test("a participant can report the other side's message, once", async () => {
    const p = await pair();
    const threadId = await openThread(p.studentToken, p.booking.id);
    const sent = await api(`/threads/${threadId}/messages`, p.tutorToken, { body: "Message douteux." });

    const first = await api(`/messages/${sent.id}/report`, p.studentToken, { reason: "inapproprié" });
    expect(first.ok).toBe(true);
    const second = await api(`/messages/${sent.id}/report`, p.studentToken, { reason: "inapproprié" });
    expect(second.ok, "pressing twice confirms, it does not error").toBe(true);

    const [n] = await sql<{ n: number }[]>`
      select count(*)::int n from message_reports where message_id = ${sent.id as string}`;
    expect(n.n, "a queue that double-counts is one nobody trusts").toBe(1);
  });

  test("you cannot report your own message", async () => {
    const p = await pair();
    const threadId = await openThread(p.studentToken, p.booking.id);
    const sent = await api(`/threads/${threadId}/messages`, p.studentToken, { body: "Bonjour" });
    const res = await api(`/messages/${sent.id}/report`, p.studentToken, {});
    expect(res.ok).toBe(false);
    expect(res.error).toBe("own-message");
  });

  test("an outsider cannot report a message in a thread they are not in", async () => {
    const p = await pair();
    const threadId = await openThread(p.studentToken, p.booking.id);
    const sent = await api(`/threads/${threadId}/messages`, p.studentToken, { body: "Bonjour" });
    const stranger = await seedProfile({ role: "student", birthYear: 1995 });
    const res = await api(`/messages/${sent.id}/report`, await mintSession(stranger.id), {});
    expect(res.ok).toBe(false);
    expect(res.error).toBe("not-found");
  });
});

test.describe("the thread list", () => {
  test("shows my conversations and nobody else's", async () => {
    const mine = await pair();
    const theirs = await pair();
    const myThread = await openThread(mine.studentToken, mine.booking.id);
    const theirThread = await openThread(theirs.studentToken, theirs.booking.id);

    const list = (await api("/threads", mine.studentToken)) as unknown as { id: string }[];
    const ids = list.map((t) => t.id);
    expect(ids).toContain(myThread);
    expect(ids, "somebody else's conversation appeared in my inbox").not.toContain(theirThread);
  });

  test("the other person's contact details are nowhere in the list", async () => {
    const p = await pair();
    await openThread(p.studentToken, p.booking.id);
    const list = await api("/threads", p.tutorToken);
    const [row] = await sql<{ email: string; phone: string | null }[]>`
      select email, phone from profiles where id = ${p.student.id}`;
    const raw = JSON.stringify(list);
    expect(raw).not.toContain(row.email);
    if (row.phone) expect(raw).not.toContain(row.phone);
  });
});
