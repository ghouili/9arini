import { test, expect } from "@playwright/test";
import { sql } from "./support/db";
import { seedProfile, seedTutor, seedAdmin } from "./support/seed";
import { mintSession } from "./support/session";

/* PROFILE PHOTOS (Step 13).

   Three rules, and every test here belongs to one of them:

     1. NOTHING PUBLISHES ON UPLOAD. A face on a public page, in a product used by
        children, is reviewed by a human first.
     2. THE ORIGINAL IS NEVER STORED. EXIF carries GPS; a selfie taken at home is
        the tutor's home coordinates.
     3. A MINOR NEVER GETS A PHOTOGRAPH.

   ADDED, never edited into an existing spec. */

const API = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";

/* A REAL JPEG CARRYING A REAL EXIF BLOCK, built here rather than committed as a
   fixture so the test can look for the exact bytes it planted.

   THE CANARY STANDS IN FOR GPS, and the substitution is sound: sharp's typed API
   exposes IFD0..IFD3 but no GPS IFD, so a GPS tag cannot be written through it.
   It does not need to be. The assertion below is not "the GPS tag was removed"
   but "no Exif block reached disk AT ALL" — which is strictly stronger, and is
   what a re-encode guarantees. If there is no APP1/Exif segment in the stored
   file, there is no GPS tag in it either. */
async function jpegWithExif(): Promise<{ bytes: Buffer; marker: string }> {
  const sharp = (await import("sharp")).default;
  const marker = "TNAJEM-EXIF-CANARY";
  const bytes = await sharp({
    create: { width: 400, height: 400, channels: 3, background: { r: 120, g: 90, b: 60 } },
  })
    .withMetadata({ exif: { IFD0: { ImageDescription: marker, Make: marker } } })
    .jpeg()
    .toBuffer();
  return { bytes, marker };
}

async function upload(token: string, bytes: Buffer, filename = "photo.jpg") {
  const form = new FormData();
  form.set("photo", new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }), filename);
  const res = await fetch(`${API}/avatar`, {
    method: "POST",
    headers: { cookie: `tnajem_session=${token}` },
    body: form,
  });
  return res.json() as Promise<{ ok: boolean; status?: string; error?: string }>;
}

async function avatarStatus(slug: string, size = "md", token?: string): Promise<number> {
  const res = await fetch(`${API}/tutors/${slug}/avatar/${size}`, {
    headers: token ? { cookie: `tnajem_session=${token}` } : {},
    redirect: "manual",
  });
  return res.status;
}

async function moderate(tutorId: string, approve: boolean, adminToken: string) {
  const res = await fetch(`${API}/admin/avatars/${tutorId}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `tnajem_session=${adminToken}` },
    body: JSON.stringify({ approve }),
  });
  return res.json() as Promise<{ ok: boolean; error?: string }>;
}

async function tutorWithPhoto(opts: { birthYear?: number } = {}) {
  const profile = await seedProfile({ role: "tutor", birthYear: opts.birthYear ?? 1985 });
  const tutor = await seedTutor({ profileId: profile.id, status: "verified" });
  const token = await mintSession(profile.id);
  return { profile, tutor, token };
}

test.describe("nothing publishes on upload", () => {
  test("a fresh photo is PENDING and invisible to everyone but its owner", async () => {
    const t = await tutorWithPhoto();
    const { bytes } = await jpegWithExif();
    const res = await upload(t.token, bytes);
    expect(res.ok, res.error).toBe(true);
    expect(res.status, "there is no path that publishes a photo directly").toBe("pending");

    expect(await avatarStatus(t.tutor.slug), "anonymous must not see an unreviewed face").toBe(404);
    const stranger = await seedProfile({ role: "student", birthYear: 1995 });
    expect(await avatarStatus(t.tutor.slug, "md", await mintSession(stranger.id))).toBe(404);
    expect(await avatarStatus(t.tutor.slug, "md", t.token), "the owner may see their own").toBe(200);
  });

  test("the public storefront reports no photo until it is approved", async () => {
    const t = await tutorWithPhoto();
    const { bytes } = await jpegWithExif();
    await upload(t.token, bytes);

    const before = (await (await fetch(`${API}/tutors/${t.tutor.slug}/storefront`)).json()) as {
      tutor: { has_photo: boolean };
    };
    expect(before.tutor.has_photo, "a pending photo is unreviewed, so the page shows the monogram").toBe(false);

    const admin = await seedAdmin();
    expect((await moderate(t.tutor.id, true, await mintSession(admin.id))).ok).toBe(true);

    const after = (await (await fetch(`${API}/tutors/${t.tutor.slug}/storefront`)).json()) as {
      tutor: { has_photo: boolean };
    };
    expect(after.tutor.has_photo).toBe(true);
    expect(await avatarStatus(t.tutor.slug), "and now anyone may see it").toBe(200);
  });

  test("a REJECTED photo goes back to invisible", async () => {
    const t = await tutorWithPhoto();
    const { bytes } = await jpegWithExif();
    await upload(t.token, bytes);
    const admin = await seedAdmin();
    await moderate(t.tutor.id, false, await mintSession(admin.id));

    expect(await avatarStatus(t.tutor.slug)).toBe(404);
    const sf = (await (await fetch(`${API}/tutors/${t.tutor.slug}/storefront`)).json()) as {
      tutor: { has_photo: boolean };
    };
    expect(sf.tutor.has_photo).toBe(false);
  });

  test("a non-admin cannot approve a photo", async () => {
    const t = await tutorWithPhoto();
    const { bytes } = await jpegWithExif();
    await upload(t.token, bytes);
    // Not even their own — self-approval is the whole point of review.
    const res = await moderate(t.tutor.id, true, t.token);
    expect(res.ok).toBe(false);
    expect(res.error).toBe("forbidden");
    expect(await avatarStatus(t.tutor.slug)).toBe(404);
  });

  test("replacing an approved photo makes it pending again", async () => {
    /* Otherwise the review is a one-time toll: upload something innocuous, get
       approved, then swap the bytes. */
    const t = await tutorWithPhoto();
    const { bytes } = await jpegWithExif();
    await upload(t.token, bytes);
    const admin = await seedAdmin();
    await moderate(t.tutor.id, true, await mintSession(admin.id));
    expect(await avatarStatus(t.tutor.slug)).toBe(200);

    await upload(t.token, bytes);
    const [row] = await sql<{ avatar_status: string }[]>`
      select avatar_status from tutors where id = ${t.tutor.id}`;
    expect(row.avatar_status).toBe("pending");
    expect(await avatarStatus(t.tutor.slug), "the old approval must not carry over").toBe(404);
  });
});

test.describe("the original is never stored", () => {
  test("NO EXIF BLOCK REACHES DISK — so no GPS tag can either", async () => {
    /* The privacy point of the whole step. A phone writes GPS into a selfie, and
       a tutor's selfie is usually taken at home. */
    const t = await tutorWithPhoto();
    const { bytes, marker } = await jpegWithExif();
    expect(bytes.toString("latin1"), "the fixture must actually carry the canary").toContain(marker);

    const res = await upload(t.token, bytes);
    expect(res.ok, res.error).toBe(true);

    const [row] = await sql<{ avatar_path: string }[]>`
      select avatar_path from tutors where id = ${t.tutor.id}`;

    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const { STORAGE_DIR } = await import("./support/env");

    for (const size of ["sm", "md", "lg"]) {
      const stored = await readFile(join(STORAGE_DIR, `${row.avatar_path}-${size}.webp`));
      const text = stored.toString("latin1");
      expect(text, `${size}: the EXIF canary survived re-encoding`).not.toContain(marker);
      expect(text, `${size}: an Exif block survived`).not.toContain("Exif");
      expect(text.slice(0, 16), `${size}: everything is re-encoded to WEBP`).toContain("WEBP");
    }
  });

  test("all three sizes are written, and they differ", async () => {
    const t = await tutorWithPhoto();
    const { bytes } = await jpegWithExif();
    await upload(t.token, bytes);
    const sizes = await Promise.all(
      ["sm", "md", "lg"].map(async (s) => {
        const res = await fetch(`${API}/tutors/${t.tutor.slug}/avatar/${s}`, {
          headers: { cookie: `tnajem_session=${t.token}` },
        });
        expect(res.status, s).toBe(200);
        expect(res.headers.get("content-type")).toBe("image/webp");
        return (await res.arrayBuffer()).byteLength;
      }),
    );
    expect(sizes[0]).toBeLessThan(sizes[2]);
  });

  test("an unreviewed photo is never cached; an approved one may be", async () => {
    const t = await tutorWithPhoto();
    const { bytes } = await jpegWithExif();
    await upload(t.token, bytes);

    const pending = await fetch(`${API}/tutors/${t.tutor.slug}/avatar/md`, {
      headers: { cookie: `tnajem_session=${t.token}` },
    });
    expect(pending.headers.get("cache-control"), "a pending photo can be revoked in a minute")
      .toContain("no-store");

    const admin = await seedAdmin();
    await moderate(t.tutor.id, true, await mintSession(admin.id));
    const approved = await fetch(`${API}/tutors/${t.tutor.slug}/avatar/md`);
    expect(approved.headers.get("cache-control")).toContain("public");
  });

  test("a file that is not an image is refused", async () => {
    const t = await tutorWithPhoto();
    const res = await upload(t.token, Buffer.from("<script>alert(1)</script>"));
    expect(res.ok).toBe(false);
    expect(res.error).toBe("bad-file-type");
  });

  test("a tiny image is refused rather than upscaled into mush", async () => {
    const sharp = (await import("sharp")).default;
    const tiny = await sharp({
      create: { width: 40, height: 40, channels: 3, background: { r: 1, g: 2, b: 3 } },
    }).jpeg().toBuffer();
    const t = await tutorWithPhoto();
    const res = await upload(t.token, tiny);
    expect(res.ok).toBe(false);
    expect(res.error).toBe("image-too-small");
  });
});

test.describe("a minor never gets a photograph", () => {
  test("a minor's upload is refused BEFORE the file is read", async () => {
    /* Belt-and-braces today — becomeTutor already refuses a minor, so no minor
       holds a tutor row. Written at the write site anyway, because that is the
       line that has to already exist if students ever get photos or the age check
       is relaxed. */
    const minorYear = new Date().getFullYear() - 15;
    const profile = await seedProfile({ role: "tutor", birthYear: minorYear });
    await seedTutor({ profileId: profile.id, status: "verified" });
    const { bytes } = await jpegWithExif();
    const res = await upload(await mintSession(profile.id), bytes);
    expect(res.ok).toBe(false);
    expect(res.error).toBe("minor-no-photo");
  });

  test("an UNKNOWN age is treated as a minor", async () => {
    /* isMinorBirthYear returns true for null, and that default is the safe one:
       "we never asked" must not mean "assume they are an adult". */
    const profile = await seedProfile({ role: "tutor", birthYear: null });
    await seedTutor({ profileId: profile.id, status: "verified" });
    const { bytes } = await jpegWithExif();
    const res = await upload(await mintSession(profile.id), bytes);
    expect(res.ok).toBe(false);
    expect(res.error).toBe("minor-no-photo");
  });
});

test.describe("removing a photo", () => {
  test("clears the row and the public page", async () => {
    const t = await tutorWithPhoto();
    const { bytes } = await jpegWithExif();
    await upload(t.token, bytes);
    const admin = await seedAdmin();
    await moderate(t.tutor.id, true, await mintSession(admin.id));
    expect(await avatarStatus(t.tutor.slug)).toBe(200);

    const res = await fetch(`${API}/avatar/delete`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `tnajem_session=${t.token}` },
      body: "{}",
    });
    expect(((await res.json()) as { ok: boolean }).ok).toBe(true);
    expect(await avatarStatus(t.tutor.slug)).toBe(404);
  });
});
