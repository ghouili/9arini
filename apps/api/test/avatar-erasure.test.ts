import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { eraseAccount, localStore, slugHash, storageBase } from "@tnajem/db";
import { db } from "../src/db";
import { startApp, stopApp, seedProfile, seedTutor, login, sql, type App } from "./support/fx";

/* phase-a lane L4 (A11) — old tutor photos were never deleted.

   Replacing or deleting a photo left the old files in storage ("left for the
   retention job", which never touched avatars), and account erasure removed only
   the CURRENT photo's three sizes. /privacy promises the photo is erased. Runs on
   the local driver, under this lane's STORAGE_DIR. */

let app: App;
const cleanups: { tutorId: string; profileId: string; slug: string }[] = [];

before(async () => {
  app = await startApp();
});
after(async () => {
  for (const c of cleanups) {
    await rm(join(storageBase(), "avatars", c.tutorId), { recursive: true, force: true });
    // Audit rows stay: admin_actions is append-only since Phase A+ (0031).
    await sql`delete from verification_traces where tutor_id = ${c.tutorId}`;
    await sql`delete from retired_slugs where slug_hash = ${slugHash(c.slug)}`;
    await sql`delete from rate_limits where key like ${`%${c.profileId}%`}`.catch(() => undefined);
    await sql`delete from tutors where id = ${c.tutorId}`;
    await sql`delete from sessions where profile_id = ${c.profileId}`;
    await sql`delete from profiles where id = ${c.profileId}`;
  }
  await stopApp(app);
});

async function photo(seed: number): Promise<Buffer> {
  return sharp({ create: { width: 200, height: 200, channels: 3, background: { r: seed % 255, g: 90, b: 160 } } })
    .png()
    .toBuffer();
}

async function upload(cookie: string, bytes: Buffer) {
  const form = new FormData();
  form.append("photo", new Blob([new Uint8Array(bytes)], { type: "image/png" }), "me.png");
  const req = new Request("http://local/avatar", { method: "POST", body: form });
  const res = await app.inject({
    method: "POST",
    url: "/avatar",
    headers: { cookie, "content-type": req.headers.get("content-type") ?? "" },
    payload: Buffer.from(await req.arrayBuffer()),
  });
  const body = JSON.parse(res.body);
  assert.equal(body.ok, true, res.body);
  await new Promise((r) => setTimeout(r, 5)); // a new millisecond: the stamp names the version
}

async function objectsUnder(tutorId: string): Promise<string[]> {
  try {
    return (await readdir(join(storageBase(), "avatars", tutorId))).sort();
  } catch {
    return []; // no folder = no objects
  }
}

async function tutorWithSession() {
  const profile = await seedProfile({ role: "tutor", birthYear: 1990 });
  const tutor = await seedTutor({ profileId: profile.id, status: "verified" });
  cleanups.push({ tutorId: tutor.id, profileId: profile.id, slug: tutor.slug });
  return { tutor, profile, cookie: await login(profile.id) };
}

describe("A11 — a replaced or deleted photo is deleted from storage", () => {
  test("replacing a photo deletes the old one; deleting the photo deletes the current one", async () => {
    const { tutor, cookie } = await tutorWithSession();
    await upload(cookie, await photo(1));
    const first = await objectsUnder(tutor.id);
    assert.equal(first.length, 3, `three sizes stored: ${first.join(", ")}`);

    await upload(cookie, await photo(2));
    const second = await objectsUnder(tutor.id);
    assert.equal(second.length, 3, `only the current photo's three sizes remain: ${second.join(", ")}`);
    assert.ok(!second.some((f) => first.includes(f)), "the replaced photo is gone");

    const res = await app.inject({ method: "POST", url: "/avatar/delete", headers: { cookie } });
    assert.equal(JSON.parse(res.body).ok, true, res.body);
    assert.deepEqual(await objectsUnder(tutor.id), [], "a deleted photo is deleted from storage");
  });
});

describe("A11 — erasure deletes EVERY photo the tutor ever uploaded", () => {
  test("3 uploads, then the account is erased: 0 objects remain under avatars/<tutorId>/", async () => {
    const { tutor, profile, cookie } = await tutorWithSession();
    for (const seed of [10, 20, 30]) await upload(cookie, await photo(seed));
    /* A photo stored before replacements deleted anything (or left by a replace
       whose best-effort delete failed) is exactly what erasure has to sweep: no
       row points at it any more. */
    for (const s of ["sm", "md", "lg"]) await localStore().put(`avatars/${tutor.id}/1600000000000-${s}.webp`, Buffer.from("old"));
    assert.ok((await objectsUnder(tutor.id)).length >= 3, "photos are in storage before erasure");

    const result = await eraseAccount(db, profile.id, { reason: "requested" });
    assert.equal(result.outcome, "erased", JSON.stringify(result));
    assert.deepEqual(await objectsUnder(tutor.id), [], "no photo of an erased tutor survives in storage");
  });
});
