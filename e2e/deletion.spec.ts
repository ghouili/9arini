import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { sql } from "./support/db";
import { seedAdmin, seedBooking, seedClass, seedProfile, seedTutor, seedVerificationDoc } from "./support/seed";
import { mintSession } from "./support/session";
import { api } from "./support/journey";
import { e2eStore } from "./support/store";

/* ERASURE (production readiness Stage 5): anonymise, don't delete.

   The two things the brief asks this suite to prove beyond doubt:
     · a tutor's identity documents are gone from STORAGE, not only from a table;
     · an erased person's name appears in NO response — checked by crawling every
       surface their name used to reach, and then by searching every text column
       of the database for it. */

const API = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";
const WEB = process.env.E2E_BASE_URL ?? "http://localhost:3210";

async function requestAndAge(profileId: string) {
  const res = await api("/account/delete", await mintSession(profileId), {});
  expect(res.ok, JSON.stringify(res)).toBe(true);
  await sql`update profiles set deletion_requested_at = now() - interval '31 days' where id = ${profileId}`;
}

async function purge() {
  const res = await fetch(`${API}/cron/purge`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
  });
  const body = (await res.json()) as { accounts?: { purged: number; deferred: number; inactiveErased: number } };
  expect(res.status, JSON.stringify(body)).toBe(200);
  return body.accounts!;
}

async function tombstone(profileId: string) {
  const [p] = await sql<Record<string, unknown>[]>`
    select email, phone, full_name, birth_year, deletion_status, purged_at from profiles where id = ${profileId}`;
  return p;
}

test.describe("deletion: honoured after the grace", () => {
  test("the account keeps no identity, no session and no login code, and the booking shell stays", async () => {
    const tutor = await seedTutor({ status: "verified" });
    const past = await seedClass({ tutorId: tutor.id, seats: 5, hoursFromNow: -48 });
    const me = await seedProfile({ role: "student", birthYear: 1995, phone: `+2169${String(Date.now()).slice(-7)}` });
    const booking = await seedBooking({ classId: past.id, studentId: me.id });
    const other = await mintSession(me.id);
    await sql`insert into otp_codes (id, identifier, code_hash, expires_at) values (gen_random_uuid(), ${me.email}, 'x', now() + interval '5 minutes')`;

    await requestAndAge(me.id);
    expect((await purge()).purged).toBeGreaterThanOrEqual(1);

    expect(await tombstone(me.id)).toMatchObject({ email: null, phone: null, full_name: null, birth_year: null, deletion_status: "purged" });
    expect((await tombstone(me.id)).purged_at).toBeTruthy();
    const [s] = await sql<{ n: number }[]>`select count(*)::int n from sessions where profile_id = ${me.id}`;
    expect(s.n).toBe(0);
    expect(await api("/me", other), "a session minted before the erasure is dead").toBeNull();
    const [o] = await sql<{ n: number }[]>`select count(*)::int n from otp_codes where identifier = ${me.email}`;
    expect(o.n).toBe(0);
    const [b] = await sql<{ n: number }[]>`select count(*)::int n from bookings where id = ${booking.id}`;
    expect(b.n, "the tutor's roster keeps an anonymous seat").toBe(1);
    const [audit] = await sql<{ n: number }[]>`
      select count(*)::int n from admin_actions where action = 'account.erased' and subject_id = ${me.id}`;
    expect(audit.n).toBe(1);
  });

  test("nothing is erased while a class booked during the grace is still to come", async () => {
    const me = await seedProfile({ role: "student", birthYear: 1995 });
    await requestAndAge(me.id);
    const tutor = await seedTutor({ status: "verified" });
    const upcoming = await seedClass({ tutorId: tutor.id, seats: 5, hoursFromNow: 72 });
    await seedBooking({ classId: upcoming.id, studentId: me.id });

    expect((await purge()).deferred).toBeGreaterThanOrEqual(1);
    expect((await tombstone(me.id)).email, "deferred, not erased").not.toBeNull();
  });

  test("an account nobody has used for three years is erased like a request; an admin never is", async () => {
    const idle = await seedProfile({ role: "student", birthYear: 1990 });
    const admin = await seedAdmin();
    await sql`update profiles set last_seen_at = now() - interval '1096 days' where id in (${idle.id}, ${admin.id})`;

    expect((await purge()).inactiveErased).toBeGreaterThanOrEqual(1);
    expect((await tombstone(idle.id)).purged_at).toBeTruthy();
    expect((await tombstone(admin.id)).purged_at, "the allow-listed admin is excluded").toBeNull();
    await sql`update profiles set last_seen_at = now() where id = ${admin.id}`;
  });
});

test.describe("deletion: a tutor's files are gone from storage", () => {
  test("ID scans, shared materials and every photo size are deleted from storage; the address is retired", async () => {
    const profile = await seedProfile({ role: "tutor", birthYear: 1985 });
    const tutor = await seedTutor({ profileId: profile.id, status: "verified" });
    await sql`update tutors set reviewed_at = now() - interval '2 days' where id = ${tutor.id}`;
    const doc = await seedVerificationDoc(tutor.id);
    const docKey = `verification/${tutor.id}/${doc.fileName}`;

    const materialKey = `materials/${tutor.id}/1-fiche.pdf`;
    await e2eStore().put(materialKey, Buffer.from("%PDF-1.4 e2e"));
    await sql`insert into materials (id, tutor_id, kind, visibility, title, storage_path, file_name, mime, size_bytes)
              values (gen_random_uuid(), ${tutor.id}, 'file', 'students', 'Fiche', ${materialKey}, '1-fiche.pdf', 'application/pdf', 12)`;
    const avatarBase = `avatars/${tutor.id}/1700000000000`;
    for (const size of ["sm", "md", "lg"]) await e2eStore().put(`${avatarBase}-${size}.webp`, Buffer.from(`RIFF${size}WEBP`));
    await sql`update tutors set avatar_path = ${avatarBase}, avatar_status = 'approved' where id = ${tutor.id}`;

    const keys = [docKey, materialKey, ...["sm", "md", "lg"].map((s) => `${avatarBase}-${s}.webp`)];
    for (const k of keys) expect(await e2eStore().get(k), `seeded ${k}`).not.toBeNull();

    await requestAndAge(profile.id);
    expect((await purge()).purged).toBeGreaterThanOrEqual(1);

    for (const k of keys) expect(await e2eStore().get(k), `${k} must be gone from storage`).toBeNull();
    const [d] = await sql<{ n: number }[]>`select count(*)::int n from verification_docs where tutor_id = ${tutor.id}`;
    expect(d.n).toBe(0);
    const [trace] = await sql<{ reason: string }[]>`select reason from verification_traces where tutor_id = ${tutor.id}`;
    expect(trace.reason).toBe("account-erased");
    const [t] = await sql<{ slug: string; full_name: string; bio: string | null; avatar_path: string | null; erased_at: Date | null }[]>`
      select slug, full_name, bio, avatar_path, erased_at from tutors where id = ${tutor.id}`;
    expect(t).toMatchObject({ full_name: "", bio: null, avatar_path: null });
    expect(t.erased_at).toBeTruthy();
    expect(t.slug).not.toBe(tutor.slug);

    expect(await api(`/tutors/${tutor.slug}/storefront`), "the page is gone").toBeNull();
    const page = await fetch(`${WEB}/fr/${tutor.slug}`, { redirect: "manual" });
    expect(page.status).toBe(404);

    // Nobody can take the old address and speak to the erased tutor's students.
    const impostor = await seedProfile({ role: "tutor", birthYear: 1980 });
    const claim = await api("/tutors", await mintSession(impostor.id), {
      name: "Quelqu'un d'autre", subject: "Mathématiques", bio: "Je reprends cette page.", slug: tutor.slug,
    });
    expect(claim).toMatchObject({ ok: false, error: "slug-taken" });
  });
});

test.describe("deletion: an erased user's name appears in no response", () => {
  test("not in notifications, threads, rosters, reviews, pages or any column of the database", async () => {
    const marker = `Zelda${randomBytes(3).toString("hex")}`;
    const surname = `Quor${randomBytes(3).toString("hex")}`;
    const fullName = `${marker} ${surname}`;

    const tutorProfile = await seedProfile({ role: "tutor", birthYear: 1985, fullName: "Tutor Keeps" });
    const tutor = await seedTutor({ profileId: tutorProfile.id, status: "verified", fullName: "Tutor Keeps" });
    const future = await seedClass({ tutorId: tutor.id, seats: 5, hoursFromNow: 96 });
    const past = await seedClass({ tutorId: tutor.id, seats: 5, hoursFromNow: -48 });
    const tutorToken = await mintSession(tutorProfile.id);

    const student = await seedProfile({ role: "student", birthYear: 1995, fullName });
    const studentToken = await mintSession(student.id);

    // Every path that writes the name somewhere another person reads it.
    expect((await api("/bookings", studentToken, { classId: future.id })).ok).toBe(true); // tutor: "Zelda a réservé…"
    const [bk] = await sql<{ id: string }[]>`select id from bookings where class_id = ${future.id} and student_id = ${student.id}`;
    const threadId = (await api("/threads", studentToken, { bookingId: bk.id })).threadId as string;
    expect((await api(`/threads/${threadId}/messages`, studentToken, { body: "Bonjour, à jeudi !" })).ok).toBe(true);
    expect((await api(`/threads/${threadId}/messages`, tutorToken, { body: "Avec plaisir." })).ok).toBe(true);
    expect((await api("/bookings/cancel", studentToken, { bookingId: bk.id })).ok).toBe(true); // tutor: "Zelda a annulé…"
    await seedBooking({ classId: past.id, studentId: student.id });
    await sql`insert into reviews (id, tutor_id, student_id, class_id, rating, text)
              values (gen_random_uuid(), ${tutor.id}, ${student.id}, ${past.id}, 5, 'Très clair.')`;
    // A notification written before 0022, with the full name and no about_profile_id.
    await sql`insert into notifications (id, profile_id, kind, title, body)
              values (gen_random_uuid(), ${tutorProfile.id}, 'new_booking', 'Nouvelle réservation', ${`${fullName} a réservé « ancienne séance ».`})`;

    const before = JSON.stringify(await api("/notifications", tutorToken));
    expect(before, "the setup really put the name in front of the tutor").toContain(marker);

    await requestAndAge(student.id);
    expect((await purge()).purged).toBeGreaterThanOrEqual(1);

    const admin = await seedAdmin();
    const adminToken = await mintSession(admin.id);
    const responses: Record<string, unknown> = {
      notifications: await api("/notifications", tutorToken),
      dashboard: await api("/dashboard", tutorToken),
      threads: await api("/threads", tutorToken),
      thread: await api(`/threads/${threadId}`, tutorToken),
      reviews: await api(`/tutors/${tutor.slug}/reviews`),
      storefront: await api(`/tutors/${tutor.slug}/storefront`),
      adminFind: await api("/admin/accounts/find", adminToken, { email: student.email }),
    };
    for (const [surface, body] of Object.entries(responses)) {
      const text = JSON.stringify(body);
      expect(text, `${surface} still names the erased user`).not.toContain(marker);
      expect(text, `${surface} still names the erased user`).not.toContain(surface === "adminFind" ? student.email : surname);
    }
    expect((responses.adminFind as { account: unknown }).account, "the address finds nobody").toBeNull();
    expect(JSON.stringify(responses.notifications)).toContain("Un compte supprimé");
    expect(JSON.stringify(responses.thread), "the tutor's own reply stays").toContain("Avec plaisir.");

    const html = await (await fetch(`${WEB}/fr/${tutor.slug}`)).text();
    expect(html, "the storefront page").not.toContain(marker);

    // And nowhere at rest: every text column of every table in the schema.
    const columns = await sql<{ table_name: string; column_name: string }[]>`
      select table_name, column_name from information_schema.columns
       where table_schema = 'public' and data_type in ('text', 'character varying')`;
    const hits: string[] = [];
    for (const c of columns) {
      const [r] = await sql.unsafe<{ n: number }[]>(
        `select count(*)::int n from "${c.table_name}" where "${c.column_name}" ilike $1 or "${c.column_name}" ilike $2`,
        [`%${marker}%`, `%${student.email}%`],
      );
      if (r.n > 0) hits.push(`${c.table_name}.${c.column_name}`);
    }
    expect(hits, "columns still holding the erased name or e-mail").toEqual([]);
  });
});
