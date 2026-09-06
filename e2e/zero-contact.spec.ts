import { test, expect } from "@playwright/test";
import { sql } from "./support/db";
import { seedProfile, seedTutor, seedClass, seedBooking } from "./support/seed";
import { mintSession } from "./support/session";
import { contactFieldPaths } from "@tnajem/shared";

/* ══════════════════════════════════════════════════════════════════════════════
   THE ZERO-CONTACT CRAWL.

   The plan calls this "the gate that must never be weakened", and it is the one
   spec in the suite whose job is to fail when somebody adds a field.

   It hits every endpoint a tutor or a student can reach while signed in, with a
   REAL counterparty on the other side whose phone and email are populated, and
   asserts two things about the raw JSON:

     1. the counterparty's actual phone and email string do not appear, anywhere,
        at any depth;
     2. no contact-SHAPED key carries a value — so a field added next month is
        caught even though no test was written for it.

   (2) is what makes this durable. A test that only checked (1) would pass the
   day someone adds `guardianPhone` with a different number in it.

   ADDED, never edited into an existing spec. Stage A's rule still holds.
   ══════════════════════════════════════════════════════════════════════════════ */

const API = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";

/* Distinctive values. If one of these strings survives into a payload, a search
   for it points straight at the field that leaked.

   UNIQUE PER PROFILE: profiles.phone carries a UNIQUE constraint, so a shared
   constant makes the second seedProfile of the run fail with a duplicate-key
   error that looks nothing like the thing being tested. */
let phoneSeq = 0;
const nextPhone = () => `+2165${String(1000000 + phoneSeq++).slice(-7)}`;

async function get(path: string, token?: string): Promise<unknown> {
  const res = await fetch(`${API}${path}`, {
    headers: token ? { cookie: `tnajem_session=${token}` } : {},
  });
  if (!res.ok) return null;
  return res.json();
}

/** Everything a counterparty must never see, as raw strings. */
function forbiddenStrings(studentPhone: string, studentEmail: string): string[] {
  return [studentPhone, studentPhone.replace("+216", ""), studentEmail];
}

/* TWO CHECKS, and they apply to different endpoints.

   assertNoLeak  — "this payload does not contain the OTHER person's details".
                   Safe everywhere, including SELF endpoints like /me, which
                   legitimately return the caller's own phone and email.

   assertClean   — the above PLUS "no contact-shaped key carries anything at
                   all". Only valid for COUNTERPARTY payloads. Running it on /me
                   would demand that a user cannot see the number they typed in
                   themselves, and the fix for that failure would be to break
                   /account. */
function assertNoLeak(label: string, payload: unknown, forbidden: string[]) {
  expect(payload, `${label}: no payload — the request failed, so nothing was checked`).not.toBeNull();
  const raw = JSON.stringify(payload);
  for (const needle of forbidden) {
    expect(raw, `${label}: leaked the counterparty's ${needle.includes("@") ? "email" : "phone"}`)
      .not.toContain(needle);
  }
}

function assertClean(label: string, payload: unknown, forbidden: string[]) {
  /* A NULL PAYLOAD IS A FAILED TEST, not a clean one.

     The first version of this helper accepted null, so when every request came
     back unauthenticated the whole crawl went green while asserting nothing at
     all. A leak test that passes when the endpoint 500s is worse than no leak
     test: it actively reassures. */
  expect(payload, `${label}: no payload — the request failed, so nothing was checked`).not.toBeNull();
  const raw = JSON.stringify(payload);
  for (const needle of forbidden) {
    expect(raw, `${label}: leaked the counterparty's ${needle.includes("@") ? "email" : "phone"}`)
      .not.toContain(needle);
  }
  expect(
    contactFieldPaths(payload),
    `${label}: a contact-shaped field carries a value — a new field slipped through the allow-list`,
  ).toEqual([]);
}

test.describe("zero contact exchange", () => {
  test("a tutor's whole signed-in surface carries no student contact details", async () => {
    const tutorProfile = await seedProfile({ role: "tutor", birthYear: 1990, phone: nextPhone() });
    const tutor = await seedTutor({ profileId: tutorProfile.id, status: "verified" });
    const klass = await seedClass({ tutorId: tutor.id, seats: 10, hoursFromNow: 96 });

    /* A student with BOTH a phone and an email on file — the leak only exists if
       there is something to leak. */
    const studentPhone = nextPhone();
    const student = await seedProfile({
      role: "student",
      birthYear: 1995,
      fullName: "Amine Karoui",
      phone: studentPhone,
    });
    const [row] = await sql<{ email: string }[]>`
      select email from profiles where id = ${student.id}`;
    const studentEmail = row.email;
    expect(studentEmail).toContain("@");

    await seedBooking({ classId: klass.id, studentId: student.id });

    const token = await mintSession(tutorProfile.id);
    const forbidden = forbiddenStrings(studentPhone, studentEmail);

    /* COUNTERPARTY payloads: the full check, shape included.

       /plans (Step 16) is in the list even though it is a static price catalogue
       with nothing personal in it today. That is the point: the crawl is a
       DURABILITY check, and it fails for fields written after it — the day a plan
       row grows a `contactEmail` or a `salesPhone`, this is what says so. */
    for (const path of ["/dashboard", "/notifications", "/plans"]) {
      assertClean(`tutor GET ${path}`, await get(path, token), forbidden);
    }
    /* SELF payloads: they carry the CALLER's own phone and email by design, so
       only the "does not contain the other person's details" half applies. */
    for (const path of ["/me", "/session"]) {
      assertNoLeak(`tutor GET ${path}`, await get(path, token), forbidden);
    }
    assertClean(`tutor GET /classes/${klass.id}`, await get(`/classes/${klass.id}`, token), forbidden);
  });

  test("the tutor dashboard shows a FIRST NAME, not the full name", async () => {
    const tutorProfile = await seedProfile({ role: "tutor", birthYear: 1990 });
    const tutor = await seedTutor({ profileId: tutorProfile.id, status: "verified" });
    const klass = await seedClass({ tutorId: tutor.id, seats: 10, hoursFromNow: 96 });
    const student = await seedProfile({
      role: "student",
      birthYear: 1995,
      fullName: "Amine Karoui",
      phone: nextPhone(),
    });
    await seedBooking({ classId: klass.id, studentId: student.id });

    const dash = (await get("/dashboard", await mintSession(tutorProfile.id))) as {
      bookings: { studentName: string | null; studentInitials: string }[];
    };
    const mine = dash.bookings.find((b) => b.studentName === "Amine");
    expect(mine, "the booking should be listed under the student's first name").toBeTruthy();
    expect(JSON.stringify(dash), "the surname must not ship").not.toContain("Karoui");
    expect(mine!.studentInitials, "initials come from the first name only").toBe("AM");
  });

  test("a student's whole signed-in surface carries no tutor contact details", async () => {
    const tutorPhone = nextPhone();
    const tutorProfile = await seedProfile({
      role: "tutor",
      birthYear: 1990,
      fullName: "Yassine Belhadj",
      phone: tutorPhone,
    });
    const tutor = await seedTutor({ profileId: tutorProfile.id, status: "verified" });
    const klass = await seedClass({ tutorId: tutor.id, seats: 10, hoursFromNow: 96 });
    const student = await seedProfile({ role: "student", birthYear: 1995 });
    await seedBooking({ classId: klass.id, studentId: student.id });

    const token = await mintSession(student.id);
    const forbidden = [tutorPhone, tutorPhone.replace("+216", "")];

    for (const path of ["/student/dashboard", "/notifications", `/classes/${klass.id}`]) {
      assertClean(`student GET ${path}`, await get(path, token), forbidden);
    }
    assertClean(
      `student GET /tutors/${tutor.slug}/storefront`,
      await get(`/tutors/${tutor.slug}/storefront`),
      forbidden,
    );
  });

  test("SELF is not a counterparty — /me still returns the caller's own identity", async () => {
    /* The rule is about what one user sees of ANOTHER. If this ever starts
       failing, someone has "fixed" the leak by hiding people's own data from
       them, and /account can no longer show you the email you log in with. */
    const myPhone = nextPhone();
    const me = await seedProfile({ role: "student", birthYear: 1995, phone: myPhone });
    const mine = (await get("/me", await mintSession(me.id))) as { phone?: string | null } | null;
    expect(mine, "a signed-in caller must get their own profile").toBeTruthy();
    expect(mine!.phone, "your own number is yours to see").toBe(myPhone);
  });

  test("public storefront reviews carry a first name only", async () => {
    const reviewerPhone = nextPhone();
    const tutorProfile = await seedProfile({ role: "tutor", birthYear: 1990 });
    const tutor = await seedTutor({ profileId: tutorProfile.id, status: "verified" });
    const klass = await seedClass({ tutorId: tutor.id, seats: 10, hoursFromNow: -48 });
    const student = await seedProfile({
      role: "student",
      birthYear: 1995,
      fullName: "Amine Karoui",
      phone: reviewerPhone,
    });
    await seedBooking({ classId: klass.id, studentId: student.id });
    await sql`insert into reviews (id, tutor_id, student_id, class_id, rating, text)
              values (gen_random_uuid(), ${tutor.id}, ${student.id}, ${klass.id}, 5, 'Très clair.')`;

    const payload = await get(`/tutors/${tutor.slug}/reviews`);
    const raw = JSON.stringify(payload);
    expect(raw, "the reviewer's first name is the byline").toContain("Amine");
    expect(raw, "never the surname — not even an initial").not.toContain("Karoui");
    assertClean("public reviews", payload, [reviewerPhone, reviewerPhone.replace("+216", "")]);
  });
});

test.describe("contact details are refused where the author can re-edit", () => {
  async function post(path: string, token: string, body: unknown) {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `tnajem_session=${token}` },
      body: JSON.stringify(body),
    });
    return res.json() as Promise<{ ok: boolean; error?: string; masked?: boolean }>;
  }

  test("a storefront bio carrying a phone number is rejected", async () => {
    const profile = await seedProfile({ role: "tutor", birthYear: 1990 });
    const token = await mintSession(profile.id);
    const res = await post("/tutors", token, {
      name: "Yassine",
      subject: "Maths",
      bio: "Appelle-moi au 98123456 pour les horaires.",
      slug: `e2e-zc-${Date.now().toString(36)}`,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("contact-info-not-allowed");
  });

  test("the same bio without the number is accepted", async () => {
    /* The other half of the claim: the filter must not be so eager that a normal
       tutor cannot publish. */
    const profile = await seedProfile({ role: "tutor", birthYear: 1990 });
    const token = await mintSession(profile.id);
    const res = await post("/tutors", token, {
      name: "Yassine",
      subject: "Maths",
      bio: "Révisions Bac 2025. Séances de 90 minutes, 25 TND, exercices des annales 2024.",
      slug: `e2e-zc-${Date.now().toString(36)}-ok`,
    });
    expect(res.ok, `a perfectly ordinary bio was refused: ${res.error}`).toBe(true);
  });

  test("a review keeps its text and loses only the contact details", async () => {
    const tutorProfile = await seedProfile({ role: "tutor", birthYear: 1990 });
    const tutor = await seedTutor({ profileId: tutorProfile.id, status: "verified" });
    const klass = await seedClass({ tutorId: tutor.id, seats: 10, hoursFromNow: -48 });
    const student = await seedProfile({ role: "student", birthYear: 1995 });
    await seedBooking({ classId: klass.id, studentId: student.id });

    const res = await post("/reviews", await mintSession(student.id), {
      classId: klass.id,
      rating: 5,
      text: "Excellent prof, très patient. Mon numéro est 98123456 si tu veux des infos.",
    });
    expect(res.ok, "a review is never refused for this — that would lose the review").toBe(true);
    expect(res.masked, "and the student must be told it was edited").toBe(true);

    const [stored] = await sql<{ text: string }[]>`
      select text from reviews where class_id = ${klass.id} limit 1`;
    expect(stored.text, "the number must not reach the database").not.toContain("98123456");
    expect(stored.text, "but the student's actual point survives").toContain("Excellent prof");
  });

  test("the flag records the pattern class and NEVER the matched text", async () => {
    const profile = await seedProfile({ role: "tutor", birthYear: 1990 });
    await post("/tutors", await mintSession(profile.id), {
      name: "Yassine",
      subject: "Maths",
      bio: "ecris moi sur amine@example.com",
      slug: `e2e-zc-${Date.now().toString(36)}-flag`,
    });

    const flags = await sql<{ kind: string; surface: string; action: string }[]>`
      select kind, surface, action from contact_leak_flags where profile_id = ${profile.id}`;
    expect(flags.length, "the attempt must be recorded").toBeGreaterThan(0);
    expect(flags[0].kind).toBe("email");
    expect(flags[0].surface).toBe("tutor_bio");
    expect(flags[0].action).toBe("rejected");

    /* The whole point of Step 8 is that contact details stop moving around. A
       moderation table holding the address it caught has copied it somewhere new. */
    const everything = await sql<Record<string, unknown>[]>`
      select * from contact_leak_flags where profile_id = ${profile.id}`;
    expect(
      JSON.stringify(everything),
      "the flag table stored the matched text — it must only ever store the pattern class",
    ).not.toContain("amine@example.com");
  });
});
