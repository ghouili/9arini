import { test, expect } from "@playwright/test";
import { sql } from "./support/db";
import { seedProfile, seedTutor, seedClass, seedBooking } from "./support/seed";
import { mintSession } from "./support/session";

/* PARENT ACCOUNTS (Step 14).

   Step 8b built a private channel between a fifteen-year-old and an adult
   stranger, and said plainly at the time that guardian access was NOT built,
   because guardians had no accounts. This is that gap closed, and these tests are
   about the two ways closing it could go wrong:

     1. IT DOES NOT WORK — the parent signs a form and then sees nothing.
     2. IT WORKS TOO WELL — the "is this my child" check is the only thing
        standing between a parent account and every conversation on the platform,
        and a guardian must never become a route to an adult's phone number.

   ADDED, never edited into an existing spec. */

const API = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";

async function get(path: string, token?: string): Promise<unknown> {
  const res = await fetch(`${API}${path}`, {
    headers: token ? { cookie: `tnajem_session=${token}` } : {},
  });
  if (!res.ok) return null;
  return res.json();
}

async function post(path: string, token: string, body: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `tnajem_session=${token}` },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<Record<string, unknown>>;
}

async function emailOf(profileId: string): Promise<string> {
  const [r] = await sql<{ email: string }[]>`select email from profiles where id = ${profileId}`;
  return r.email;
}

/* A minor with a signed consent naming a parent, a tutor, a booking and a
   conversation. The full shape Step 14 has to work across. */
async function family(opts: { tutorPhone?: string } = {}) {
  const minorYear = new Date().getFullYear() - 15;
  const child = await seedProfile({ role: "student", birthYear: minorYear, fullName: "Amine Karoui" });
  const parent = await seedProfile({ role: "guardian", birthYear: 1980, fullName: "Sonia Karoui" });

  const tutorProfile = await seedProfile({
    role: "tutor",
    birthYear: 1985,
    fullName: "Yassine Belhadj",
    phone: opts.tutorPhone ?? null,
  });
  /* The name that matters is the one on the TUTOR row — that is what every
     counterparty surface reads. Setting it only on the profile left this test
     asserting against "E2E Tutor …", which publicDisplayName correctly reduces
     to "EE". A test bug, but a useful one: it confirms the helper strips the
     digits out of a name rather than passing them through. */
  const tutor = await seedTutor({
    profileId: tutorProfile.id,
    status: "verified",
    fullName: "Yassine Belhadj",
  });
  const klass = await seedClass({ tutorId: tutor.id, seats: 10, hoursFromNow: 96 });
  const booking = await seedBooking({ classId: klass.id, studentId: child.id });

  // The consent the parent signed, carrying their address. This is the link.
  await sql`insert into consents (id, minor_id, guardian_name, guardian_phone, guardian_email, consent_text)
            values (gen_random_uuid(), ${child.id}, 'Sonia Karoui', '+21620000000',
                    ${await emailOf(parent.id)}, 'Seeded by the E2E suite.')`;

  const childToken = await mintSession(child.id);
  const threadId = (await post("/threads", childToken, { bookingId: booking.id })).threadId as string;
  await post(`/threads/${threadId}/messages`, childToken, { body: "Bonjour, à jeudi !" });

  return { child, parent, tutorProfile, tutor, klass, booking, threadId, childToken,
           parentToken: await mintSession(parent.id) };
}

test.describe("the link resolves on sign-in", () => {
  test("a parent sees their child the FIRST time they ask", async () => {
    /* No invitation and no callback: the link resolves from the consent when the
       parent signs in. Telling a parent "check back later" for a safeguarding
       feature is how it stops being used. */
    const f = await family();
    const kids = (await get("/guardian/children", f.parentToken)) as { id: string; name: string }[];
    expect(kids).toHaveLength(1);
    expect(kids[0].id).toBe(f.child.id);
    expect(kids[0].name, "their own child's full name is theirs to see").toBe("Amine Karoui");
  });

  test("asking twice does not accumulate links", async () => {
    /* The resolve runs on every request, so unique(guardian, minor) is what stops
       a parent of two children growing a row per sign-in, forever. */
    const f = await family();
    await get("/guardian/children", f.parentToken);
    await get("/guardian/children", f.parentToken);
    await get("/guardian/children", f.parentToken);
    const [n] = await sql<{ n: number }[]>`
      select count(*)::int n from guardian_links where guardian_profile_id = ${f.parent.id}`;
    expect(n.n).toBe(1);
  });

  test("someone with no consent naming them has no children", async () => {
    const stranger = await seedProfile({ role: "student", birthYear: 1990 });
    const kids = await get("/guardian/children", await mintSession(stranger.id));
    expect(kids).toEqual([]);
  });

  test("a child cannot become their own guardian", async () => {
    /* One typo on the consent form — a minor entering their own address — would
       otherwise hand them oversight of themselves and a second role in the audit
       trail. */
    const minorYear = new Date().getFullYear() - 15;
    const child = await seedProfile({ role: "student", birthYear: minorYear });
    await sql`insert into consents (id, minor_id, guardian_name, guardian_phone, guardian_email, consent_text)
              values (gen_random_uuid(), ${child.id}, 'Self', '+21620000001',
                      ${await emailOf(child.id)}, 'Seeded by the E2E suite.')`;
    const kids = await get("/guardian/children", await mintSession(child.id));
    expect(kids).toEqual([]);
    const [n] = await sql<{ n: number }[]>`
      select count(*)::int n from guardian_links where guardian_profile_id = ${child.id}`;
    expect(n.n).toBe(0);
  });
});

test.describe("what a parent can see", () => {
  test("their child's upcoming bookings", async () => {
    const f = await family();
    const kids = (await get("/guardian/children", f.parentToken)) as {
      upcoming: { title: string; tutorName: string }[];
      threadCount: number;
    }[];
    expect(kids[0].upcoming).toHaveLength(1);
    expect(kids[0].threadCount, "so they know there is something to read").toBe(1);
  });

  test("their child's conversations, in full", async () => {
    const f = await family();
    const threads = (await get(`/guardian/children/${f.child.id}/threads`, f.parentToken)) as {
      id: string;
    }[];
    expect(threads.map((t) => t.id)).toContain(f.threadId);

    const detail = (await get(`/guardian/threads/${f.threadId}`, f.parentToken)) as {
      iAm: string;
      messages: { body: string; mine: boolean; fromChild: boolean }[];
    };
    expect(detail.messages[0].body).toContain("à jeudi");
    expect(detail.messages[0].fromChild, "the parent needs to know who said what").toBe(true);
    expect(detail.messages[0].mine, "none of these are the parent's own words").toBe(false);
    expect(detail.iAm, "a reader, not a participant — the UI hides the composer on this").toBe("guardian");
  });
});

test.describe("A GUARDIAN IS NOT A CONTACT BRIDGE", () => {
  test("the tutor's phone and email are nowhere in the parent's whole surface", async () => {
    /* Step 8 applies to a guardian identically. A parent account that leaked the
       tutor's number would be a contact bridge with a safeguarding label on it,
       which is worse than no feature at all — it would be sold as protection. */
    const tutorPhone = "+21653112233";
    const f = await family({ tutorPhone });
    const tutorEmail = await emailOf(f.tutorProfile.id);

    for (const path of [
      "/guardian/children",
      `/guardian/children/${f.child.id}/threads`,
      `/guardian/threads/${f.threadId}`,
    ]) {
      const raw = JSON.stringify(await get(path, f.parentToken));
      expect(raw, `${path} leaked the tutor's phone`).not.toContain(tutorPhone);
      expect(raw, `${path} leaked the tutor's phone digits`).not.toContain("53112233");
      expect(raw, `${path} leaked the tutor's email`).not.toContain(tutorEmail);
    }
  });

  test("the tutor is shown by FIRST NAME only", async () => {
    const f = await family();
    const raw = JSON.stringify(await get(`/guardian/children/${f.child.id}/threads`, f.parentToken));
    expect(raw).toContain("Yassine");
    expect(raw, "not even the surname").not.toContain("Belhadj");
  });
});

test.describe("IT MUST NOT WORK TOO WELL", () => {
  test("a parent cannot read ANOTHER family's child", async () => {
    const mine = await family();
    const theirs = await family();
    const threads = await get(`/guardian/children/${theirs.child.id}/threads`, mine.parentToken);
    expect(threads, "the 'is this my child' check is the whole boundary").toBeNull();
  });

  test("a parent cannot read another family's THREAD by id", async () => {
    const mine = await family();
    const theirs = await family();
    const detail = await get(`/guardian/threads/${theirs.threadId}`, mine.parentToken);
    expect(detail).toBeNull();
  });

  test("a signed-out request gets nothing", async () => {
    const f = await family();
    expect(await get("/guardian/children")).toBeNull();
    expect(await get(`/guardian/threads/${f.threadId}`)).toBeNull();
  });

  test("READ-ONLY: a parent cannot post into their child's thread", async () => {
    /* Oversight is not impersonation. A message sent from a parent's account
       would carry the child's name in the audit trail, and the tutor would have
       no way to tell who they were actually talking to. */
    const f = await family();
    const res = await post(`/threads/${f.threadId}/messages`, f.parentToken, { body: "Bonjour" });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("not-found");

    const [n] = await sql<{ n: number }[]>`
      select count(*)::int n from messages where thread_id = ${f.threadId}`;
    expect(n.n, "and nothing was written").toBe(1);
  });

  test("a parent cannot cancel their child's booking", async () => {
    const f = await family();
    const res = await post("/bookings/cancel", f.parentToken, { bookingId: f.booking.id });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("forbidden");
  });
});

test.describe("the consent form now demands the parent's address", () => {
  test("a consent with no e-mail is refused", async () => {
    const minorYear = new Date().getFullYear() - 15;
    const child = await seedProfile({ role: "student", birthYear: minorYear });
    const res = await post("/consent", await mintSession(child.id), {
      guardianName: "Sonia Karoui",
      guardianPhone: "+21620000002",
    });
    expect(res.ok, "a consent without it produces a parent who can see nothing").toBe(false);
    expect(res.error).toBe("invalid-guardian-email");
  });

  test("a child cannot name their OWN address as the parent's", async () => {
    const minorYear = new Date().getFullYear() - 15;
    const child = await seedProfile({ role: "student", birthYear: minorYear });
    const res = await post("/consent", await mintSession(child.id), {
      guardianName: "Sonia Karoui",
      guardianPhone: "+21620000003",
      guardianEmail: await emailOf(child.id),
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("guardian-is-self");
  });

  test("a valid consent stores the address and links on the parent's next visit", async () => {
    const minorYear = new Date().getFullYear() - 15;
    const child = await seedProfile({ role: "student", birthYear: minorYear });
    const parent = await seedProfile({ role: "guardian", birthYear: 1980 });
    const parentEmail = await emailOf(parent.id);

    const res = await post("/consent", await mintSession(child.id), {
      guardianName: "Sonia Karoui",
      guardianPhone: "+21620000004",
      guardianEmail: parentEmail,
    });
    expect(res.ok, JSON.stringify(res)).toBe(true);

    const kids = (await get("/guardian/children", await mintSession(parent.id))) as { id: string }[];
    expect(kids.map((k) => k.id)).toContain(child.id);
  });
});
