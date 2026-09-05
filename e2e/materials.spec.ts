import { test, expect } from "@playwright/test";
import { sql } from "./support/db";
import { seedProfile, seedTutor, seedClass, seedBooking, seedAdmin } from "./support/seed";
import { mintSession } from "./support/session";

/* MATERIALS (Step 10).

   The whole step turns on one thing: FILES ARE NOT IN public/, so every read goes
   through an endpoint that can ask "did this student actually book the class?".
   Most of this file exercises that question from the outside, because a
   visibility column nothing enforces is a decoration.

   ADDED, never edited into an existing spec. */

const API = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";

/* A real 1x1 PNG. The upload path sniffs MAGIC BYTES, so a fake buffer would be
   rejected — which is the behaviour being relied on, not worked around. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

async function upload(
  token: string,
  opts: { title?: string; visibility?: string; classId?: string; youtubeUrl?: string; bytes?: Buffer | null },
) {
  const form = new FormData();
  form.set("title", opts.title ?? "Fiche de révision");
  if (opts.visibility) form.set("visibility", opts.visibility);
  if (opts.classId) form.set("classId", opts.classId);
  if (opts.youtubeUrl) form.set("youtubeUrl", opts.youtubeUrl);
  if (opts.bytes !== null) {
    form.set("file", new Blob([new Uint8Array(opts.bytes ?? PNG)], { type: "image/png" }), "fiche.png");
  }
  const res = await fetch(`${API}/materials`, {
    method: "POST",
    headers: { cookie: `tnajem_session=${token}` },
    body: form,
  });
  return res.json() as Promise<{ ok: boolean; id?: string; error?: string }>;
}

async function fileStatus(id: string, token?: string): Promise<number> {
  const res = await fetch(`${API}/materials/${id}/file`, {
    headers: token ? { cookie: `tnajem_session=${token}` } : {},
    redirect: "manual",
  });
  return res.status;
}

async function listFor(slug: string, token?: string) {
  const res = await fetch(`${API}/tutors/${slug}/materials`, {
    headers: token ? { cookie: `tnajem_session=${token}` } : {},
  });
  return (await res.json()) as { id: string; title: string; visibility: string }[];
}

/** A verified tutor, one class, and a student holding a live booking on it. */
async function scenario() {
  const tutorProfile = await seedProfile({ role: "tutor", birthYear: 1985 });
  const tutor = await seedTutor({ profileId: tutorProfile.id, status: "verified" });
  const klass = await seedClass({ tutorId: tutor.id, seats: 10, hoursFromNow: 96 });
  const student = await seedProfile({ role: "student", birthYear: 1995 });
  const booking = await seedBooking({ classId: klass.id, studentId: student.id });
  const outsider = await seedProfile({ role: "student", birthYear: 1995 });
  return {
    tutor,
    klass,
    booking,
    tutorToken: await mintSession(tutorProfile.id),
    studentToken: await mintSession(student.id),
    outsiderToken: await mintSession(outsider.id),
  };
}

test.describe("visibility is enforced by the API, not by obscurity", () => {
  test("PUBLIC: anyone, signed out included", async () => {
    const s = await scenario();
    const up = await upload(s.tutorToken, { visibility: "public", title: "Programme 2025" });
    expect(up.ok, up.error).toBe(true);
    expect(await fileStatus(up.id!)).toBe(200);
    expect(await fileStatus(up.id!, s.outsiderToken)).toBe(200);
  });

  test("STUDENTS: the booked student yes, an outsider NO, signed-out NO", async () => {
    const s = await scenario();
    const up = await upload(s.tutorToken, { visibility: "students", title: "Corrigé du DS" });
    expect(up.ok, up.error).toBe(true);

    expect(await fileStatus(up.id!, s.studentToken), "a student who booked must get it").toBe(200);
    expect(await fileStatus(up.id!, s.outsiderToken), "a signed-in stranger must not").toBe(403);
    expect(await fileStatus(up.id!), "and neither may an anonymous request").toBe(403);
    expect(await fileStatus(up.id!, s.tutorToken), "the owner always can").toBe(200);
  });

  test("PRIVATE: the tutor alone — not even their own students", async () => {
    const s = await scenario();
    const up = await upload(s.tutorToken, { visibility: "private", title: "Brouillon" });
    expect(up.ok, up.error).toBe(true);
    expect(await fileStatus(up.id!, s.tutorToken)).toBe(200);
    expect(await fileStatus(up.id!, s.studentToken)).toBe(403);
    expect(await fileStatus(up.id!)).toBe(403);
  });

  test("CANCELLING THE BOOKING REVOKES ACCESS", async () => {
    /* Giving up the seat gives up the materials, the same rule messaging follows.
       This is the case a static public/ directory could never enforce. */
    const s = await scenario();
    const up = await upload(s.tutorToken, { visibility: "students" });
    expect(await fileStatus(up.id!, s.studentToken)).toBe(200);

    await sql`update bookings set status = 'cancelled' where id = ${s.booking.id}`;
    expect(await fileStatus(up.id!, s.studentToken), "a cancelled seat keeps no entitlement").toBe(403);
  });

  test("the LIST shows each viewer only what they may read", async () => {
    const s = await scenario();
    await upload(s.tutorToken, { visibility: "public", title: "PUB" });
    await upload(s.tutorToken, { visibility: "students", title: "STU" });
    await upload(s.tutorToken, { visibility: "private", title: "PRIV" });

    const titles = async (token?: string) => (await listFor(s.tutor.slug, token)).map((m) => m.title).sort();
    expect(await titles(), "anonymous").toEqual(["PUB"]);
    expect(await titles(s.outsiderToken), "signed-in stranger").toEqual(["PUB"]);
    expect(await titles(s.studentToken), "booked student").toEqual(["PUB", "STU"]);
    expect(await titles(s.tutorToken), "owner").toEqual(["PRIV", "PUB", "STU"]);
  });
});

test.describe("the file itself", () => {
  test("the STORED path is under STORAGE_DIR and never public/", async () => {
    const s = await scenario();
    const up = await upload(s.tutorToken, {});
    const [row] = await sql<{ storage_path: string; mime: string }[]>`
      select storage_path, mime from materials where id = ${up.id!}`;
    expect(row.storage_path, "materials live beside ID scans, not in the web root").toMatch(/^materials\//);
    expect(row.storage_path, "POSIX separators only — a backslash does not resolve on Linux").not.toContain("\\");
    expect(row.mime, "the SNIFFED type is stored, never the client's claim").toBe("image/png");
  });

  test("a renamed script is refused, whatever the client calls it", async () => {
    const s = await scenario();
    const up = await upload(s.tutorToken, { bytes: Buffer.from("<script>alert(1)</script>") });
    expect(up.ok).toBe(false);
    expect(up.error).toBe("bad-file-type");
  });

  test("the response never serves a type it did not sniff", async () => {
    const s = await scenario();
    const up = await upload(s.tutorToken, { visibility: "public" });
    const res = await fetch(`${API}/materials/${up.id!}/file`);
    expect(res.headers.get("content-type")).toContain("image/png");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    /* `private` even for a public file: a shared cache keyed on the URL alone
        would hand a students-only file to the next person through it. */
    expect(res.headers.get("cache-control")).toContain("private");
  });
});

test.describe("videos store an id, not a URL", () => {
  test("a watch URL becomes an 11-character id", async () => {
    const s = await scenario();
    const up = await upload(s.tutorToken, {
      bytes: null,
      youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s",
      visibility: "public",
    });
    expect(up.ok, up.error).toBe(true);
    const [row] = await sql<{ youtube_id: string; storage_path: string | null }[]>`
      select youtube_id, storage_path from materials where id = ${up.id!}`;
    expect(row.youtube_id).toBe("dQw4w9WgXcQ");
    expect(row.storage_path, "a video has no file").toBeNull();
  });

  test("a non-YouTube link is refused with a code that says why", async () => {
    const s = await scenario();
    const up = await upload(s.tutorToken, { bytes: null, youtubeUrl: "https://vimeo.com/123456" });
    expect(up.ok).toBe(false);
    expect(up.error).toBe("invalid-youtube-url");
  });
});

test.describe("who may upload", () => {
  test("an UNVERIFIED tutor cannot stock a library", async () => {
    const profile = await seedProfile({ role: "tutor", birthYear: 1985 });
    await seedTutor({ profileId: profile.id, status: "pending" });
    const up = await upload(await mintSession(profile.id), {});
    expect(up.ok).toBe(false);
    expect(up.error).toBe("not-verified");
  });

  test("a tutor cannot attach a material to someone else's class", async () => {
    const a = await scenario();
    const b = await scenario();
    const up = await upload(a.tutorToken, { classId: b.klass.id });
    expect(up.ok).toBe(false);
    expect(up.error).toBe("not-found");
  });

  test("contact details in the title are refused, as everywhere else", async () => {
    const s = await scenario();
    const up = await upload(s.tutorToken, { title: "Fiche — appelle 98123456" });
    expect(up.ok).toBe(false);
    expect(up.error).toBe("contact-info-not-allowed");
  });
});

test.describe("copyright takedown", () => {
  async function claim(materialId: string, body?: Record<string, string>) {
    const res = await fetch(`${API}/materials/${materialId}/takedown`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        claimantName: "Éditions Alpha",
        claimantEmail: "droits@alpha.example",
        reason: "Ce document est un extrait de notre manuel scolaire, publié sans autorisation.",
        ...body,
      }),
    });
    return res.json() as Promise<{ ok: boolean; status?: string; error?: string }>;
  }

  test("ANYONE can file a claim — no account required", async () => {
    /* A rights-holder is almost never a user of this site. Requiring them to sign
       up to complain is the same as having no process. */
    const s = await scenario();
    const up = await upload(s.tutorToken, { visibility: "public" });
    const res = await claim(up.id!);
    expect(res.ok).toBe(true);
    expect(res.status, "and it must not pretend the file is already gone").toBe("received");

    // Filing a claim removes NOTHING. A human decides.
    expect(await fileStatus(up.id!)).toBe(200);
  });

  test("an upheld claim removes the file and records ONE strike", async () => {
    const s = await scenario();
    const up = await upload(s.tutorToken, { visibility: "public" });
    await claim(up.id!);

    const [row] = await sql<{ id: string }[]>`
      select id from material_takedowns where material_id = ${up.id!} limit 1`;

    /* seedAdmin(), NOT a hand-rolled profile with the admin address written in.
       profiles.email is UNIQUE and seedAdmin is get-or-create, so minting a second
       one collides with whatever admin.spec.ts already made — which passes in
       isolation and fails in the full suite, the worst way to learn it. One
       helper, one admin identity. */
    const admin = await seedAdmin();
    const adminToken = await mintSession(admin.id);

    const resolve = async () =>
      (await (
        await fetch(`${API}/admin/takedowns/${row.id}/resolve`, {
          method: "POST",
          headers: { "content-type": "application/json", cookie: `tnajem_session=${adminToken}` },
          body: JSON.stringify({ uphold: true }),
        })
      ).json()) as { ok: boolean };

    expect((await resolve()).ok).toBe(true);
    expect(await fileStatus(up.id!), "an upheld claim makes it a 404, not a 403").toBe(404);

    /* Resolving twice must not double the strike — a count that can be wrong
       upward is one nobody can act on. */
    await resolve();
    const [n] = await sql<{ n: number }[]>`
      select count(*)::int n from tutor_strikes where tutor_id = ${s.tutor.id}`;
    expect(n.n).toBe(1);
  });

  test("a non-admin cannot resolve a claim", async () => {
    const s = await scenario();
    const up = await upload(s.tutorToken, { visibility: "public" });
    await claim(up.id!);
    const [row] = await sql<{ id: string }[]>`
      select id from material_takedowns where material_id = ${up.id!} limit 1`;

    const res = await fetch(`${API}/admin/takedowns/${row.id}/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `tnajem_session=${s.tutorToken}` },
      body: JSON.stringify({ uphold: true }),
    });
    const body = (await res.json()) as { ok: boolean; error?: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe("forbidden");
    expect(await fileStatus(up.id!), "and the file must still be there").toBe(200);
  });
});
