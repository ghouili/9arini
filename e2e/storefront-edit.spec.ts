import { test, expect } from "@playwright/test";
import { sql } from "./support/db";
import { seedProfile, seedTutor } from "./support/seed";
import { mintSession } from "./support/session";

/* STOREFRONT EDITING (Step 9).

   The endpoint has always been create-or-update and the form has always opened
   pre-filled — what was missing was a door: /onboarding was linked only from the
   no-storefront state, so a tutor who finished onboarding could not fix a typo on
   their own public page.

   That makes the interesting tests the ones about what an EDIT must NOT do. A
   create-or-update endpoint reached by a new path is exactly where a rule written
   for creation quietly stops holding.

   ADDED, never edited into an existing spec. */

const API = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";

type SaveResult = {
  ok: boolean;
  error?: string;
  slug?: string;
  revalidate?: { tutors?: string[]; publicTutors?: boolean };
};

async function save(
  token: string,
  body: { name: string; subject: string; bio: string; slug: string; phone?: string | null },
): Promise<SaveResult> {
  const res = await fetch(`${API}/tutors`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `tnajem_session=${token}` },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<SaveResult>;
}

async function row(tutorId: string) {
  const [r] = await sql<
    { slug: string; full_name: string; subject: string; bio: string | null; status: string; verified: boolean }[]
  >`select slug, full_name, subject, bio, status, verified from tutors where id = ${tutorId}`;
  return r;
}

test("a verified tutor edits their page and stays verified", async () => {
  /* The failure this guards: an edit endpoint that re-runs creation defaults and
     silently drops a tutor back to `draft`, un-listing them from /explore and
     404-ing every link they have shared. */
  const profile = await seedProfile({ role: "tutor", birthYear: 1985 });
  const tutor = await seedTutor({ profileId: profile.id, status: "verified" });
  const token = await mintSession(profile.id);

  const res = await save(token, {
    name: "Yassine Belhadj",
    subject: "Physique · Bac",
    bio: "Révisions Bac 2025, annales corrigées.",
    slug: tutor.slug,
  });
  expect(res.ok, `edit failed: ${res.error}`).toBe(true);

  const after = await row(tutor.id);
  expect(after.subject).toBe("Physique · Bac");
  expect(after.bio).toContain("annales corrigées");
  expect(after.status, "an edit must never un-verify a tutor").toBe("verified");
  expect(after.verified).toBe(true);
});

test("THE SLUG IS WRITE-ONCE — a submitted slug is ignored, not honoured", async () => {
  /* The most destructive thing this endpoint could do. A rename 404s every link
     already pasted into a WhatsApp group and frees the old slug for someone else
     to claim. The client locks the field; this proves the SERVER does, because a
     client that forgets is the case being defended against. */
  const profile = await seedProfile({ role: "tutor", birthYear: 1985 });
  const tutor = await seedTutor({ profileId: profile.id, status: "verified" });
  const token = await mintSession(profile.id);

  const res = await save(token, {
    name: "Yassine",
    subject: "Maths",
    bio: "Bac 2025.",
    slug: `${tutor.slug}-renamed`,
  });
  expect(res.ok).toBe(true);
  expect(res.slug, "the endpoint must report the slug it kept").toBe(tutor.slug);
  expect((await row(tutor.id)).slug, "the stored slug changed — every shared link is now dead").toBe(tutor.slug);
});

test("editing a VERIFIED tutor busts the /explore cache, not just the storefront", async () => {
  /* Step 9 found this. The envelope said "not publicTutors: a tutor here is still
     draft" — true while the endpoint only ever ran at creation, false the moment
     it became an edit path. /explore renders name and subject, so a verified tutor
     correcting theirs would keep the old one on the catalogue for the whole cache
     window with no way to tell why. */
  const profile = await seedProfile({ role: "tutor", birthYear: 1985 });
  const tutor = await seedTutor({ profileId: profile.id, status: "verified" });
  const res = await save(await mintSession(profile.id), {
    name: "Yassine",
    subject: "Maths · Bac",
    bio: "Bac 2025.",
    slug: tutor.slug,
  });
  expect(res.revalidate?.tutors).toContain(tutor.slug);
  expect(res.revalidate?.publicTutors, "a verified tutor's edit changes what /explore shows").toBe(true);
});

test("a DRAFT tutor's edit does not bust the public list", async () => {
  // The other half: a draft tutor is not on /explore, so busting it is pure cost.
  const profile = await seedProfile({ role: "tutor", birthYear: 1985 });
  const tutor = await seedTutor({ profileId: profile.id, status: "draft" });
  const res = await save(await mintSession(profile.id), {
    name: "Yassine",
    subject: "Maths",
    bio: "Bac 2025.",
    slug: tutor.slug,
  });
  expect(res.ok).toBe(true);
  expect(res.revalidate?.publicTutors ?? false).toBe(false);
});

test("contact details are refused on EDIT, exactly as on create", async () => {
  /* Step 8's filter is on POST /tutors, so it covers both paths by construction.
     Pinned anyway: "the guard runs on the other path too" is the assumption that
     is wrong often enough to be worth one test. */
  const profile = await seedProfile({ role: "tutor", birthYear: 1985 });
  const tutor = await seedTutor({ profileId: profile.id, status: "verified" });
  const res = await save(await mintSession(profile.id), {
    name: "Yassine",
    subject: "Maths",
    bio: "Écris-moi sur WhatsApp au 98123456.",
    slug: tutor.slug,
  });
  expect(res.ok).toBe(false);
  expect(res.error).toBe("contact-info-not-allowed");

  expect((await row(tutor.id)).bio, "a refused edit must not partially apply").not.toContain("98123456");
});

test("one tutor cannot edit another's storefront", async () => {
  const a = await seedProfile({ role: "tutor", birthYear: 1985 });
  const victim = await seedTutor({ profileId: a.id, status: "verified" });
  const b = await seedProfile({ role: "tutor", birthYear: 1985 });

  /* B has no storefront, so this is a CREATE for them — and it must create their
     own, never touch A's. The slug collision check is what stops them taking it. */
  const res = await save(await mintSession(b.id), {
    name: "Intrus",
    subject: "Maths",
    bio: "Bonjour.",
    slug: victim.slug,
  });
  expect(res.ok).toBe(false);
  expect(res.error).toBe("slug-taken");

  const after = await row(victim.id);
  expect(after.full_name, "A's storefront was overwritten").not.toBe("Intrus");
});

test("the tutor's own phone is saved but never published", async () => {
  /* The one contact field the form still has, and it is SELF data: it is what
     lets notify() text the tutor about a booking. The form says so
     ("Il n'apparaît jamais sur ta page publique"), and this checks that claim
     against the public payload rather than trusting the label. */
  const profile = await seedProfile({ role: "tutor", birthYear: 1985 });
  const tutor = await seedTutor({ profileId: profile.id, status: "verified" });
  const phone = "+21652010203";

  const res = await save(await mintSession(profile.id), {
    name: "Yassine",
    subject: "Maths",
    bio: "Bac 2025.",
    slug: tutor.slug,
    phone,
  });
  expect(res.ok).toBe(true);

  const [p] = await sql<{ phone: string | null }[]>`
    select phone from profiles where id = ${profile.id}`;
  expect(p.phone, "the number must reach the tutor's own profile").toBe(phone);

  const storefront = await (await fetch(`${API}/tutors/${tutor.slug}/storefront`)).text();
  expect(storefront, "and must never reach the public page").not.toContain(phone);
  expect(storefront).not.toContain("52010203");
});
