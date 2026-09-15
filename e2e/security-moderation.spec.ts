import { test, expect } from "@playwright/test";
import { sql } from "./support/db";
import { seedAdmin, seedProfile, seedTutor } from "./support/seed";
import { mintSession } from "./support/session";
import { api, auditActions } from "./support/journey";
import { e2eStore } from "./support/store";

/* MODERATION DECIDES WHAT WAS REVIEWED (Stage 4 security review, 15 Sept 2026).
   An approval used to take effect on whatever was current at click time. */

const API = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";

test.describe("security: a tutor approval is bound to the submission the admin reviewed", () => {
  test("a dossier resubmitted after the admin opened it cannot be approved with the old version", async () => {
    const admin = await seedAdmin();
    const adminToken = await mintSession(admin.id);
    const tutor = await seedTutor({ status: "pending" });
    const reviewed = "2026-09-15T10:00:00.123Z";
    const resubmitted = "2026-09-15T10:05:00.456Z";
    await sql`update tutors set submitted_at = ${resubmitted} where id = ${tutor.id}`;

    expect(await api("/admin/verifications/approve", adminToken, { tutorId: tutor.id, submittedAt: reviewed }))
      .toEqual({ ok: false, error: "changed-since-review" });
    const [still] = await sql<{ status: string }[]>`select status from tutors where id = ${tutor.id}`;
    expect(still.status).toBe("pending");

    const ok = await api("/admin/verifications/approve", adminToken, { tutorId: tutor.id, submittedAt: resubmitted });
    expect(ok.ok, JSON.stringify(ok)).toBe(true);
    expect(await auditActions(tutor.id)).toContain("verification.approve");
  });

  test("an approval without the reviewed version is refused", async () => {
    const admin = await seedAdmin();
    const tutor = await seedTutor({ status: "pending" });
    const res = await fetch(`${API}/admin/verifications/approve`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `tnajem_session=${await mintSession(admin.id)}` },
      body: JSON.stringify({ tutorId: tutor.id }),
    });
    expect(res.status).toBe(400);
  });
});

test.describe("security: a photo decision is bound to the photo reviewed, and audited", () => {
  async function tutorWithPendingPhoto(version: string) {
    const profile = await seedProfile({ role: "tutor", birthYear: 1985 });
    const tutor = await seedTutor({ profileId: profile.id, status: "verified" });
    await sql`update tutors set avatar_path = ${`avatars/${tutor.id}/${version}`}, avatar_status = 'pending' where id = ${tutor.id}`;
    return tutor;
  }

  test("a photo swapped in after review is not approved by the old decision", async () => {
    const adminToken = await mintSession((await seedAdmin()).id);
    const tutor = await tutorWithPendingPhoto("1000");
    await sql`update tutors set avatar_path = ${`avatars/${tutor.id}/2000`} where id = ${tutor.id}`;

    expect(await api(`/admin/avatars/${tutor.id}`, adminToken, { approve: true, version: "1000" }))
      .toEqual({ ok: false, error: "changed-since-review" });
    const [row] = await sql<{ avatar_status: string }[]>`select avatar_status from tutors where id = ${tutor.id}`;
    expect(row.avatar_status).toBe("pending");

    expect((await api(`/admin/avatars/${tutor.id}`, adminToken, { approve: true, version: "2000" })).ok).toBe(true);
    expect(await auditActions(tutor.id)).toContain("avatar.approve");
  });

  test("a rejected photo cannot be approved afterwards", async () => {
    const adminToken = await mintSession((await seedAdmin()).id);
    const tutor = await tutorWithPendingPhoto("3000");
    expect((await api(`/admin/avatars/${tutor.id}`, adminToken, { approve: false, version: "3000" })).ok).toBe(true);
    expect(await auditActions(tutor.id)).toContain("avatar.reject");
    expect(await api(`/admin/avatars/${tutor.id}`, adminToken, { approve: true, version: "3000" }))
      .toEqual({ ok: false, error: "not-pending" });
  });

  test("the reviewer can see the pending photo; nobody else can through that route", async () => {
    const admin = await seedAdmin();
    const tutor = await tutorWithPendingPhoto("4000");
    const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBPVP8 "), Buffer.alloc(32)]);
    await e2eStore().put(`avatars/${tutor.id}/4000-md.webp`, webp);

    const asAdmin = await fetch(`${API}/admin/avatars/${tutor.id}/md`, { headers: { cookie: `tnajem_session=${await mintSession(admin.id)}` } });
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.headers.get("cache-control")).toContain("no-store");
    expect(Buffer.from(await asAdmin.arrayBuffer()).equals(webp)).toBe(true);

    const stranger = await seedProfile({ role: "student", birthYear: 1995 });
    const asStranger = await fetch(`${API}/admin/avatars/${tutor.id}/md`, { headers: { cookie: `tnajem_session=${await mintSession(stranger.id)}` } });
    expect(asStranger.status).toBe(403);
  });
});

test.describe("security: materials cannot fill the store by uploading and deleting", () => {
  test("removed files still count against the tutor's storage quota", async () => {
    const profile = await seedProfile({ role: "tutor", birthYear: 1985 });
    const tutor = await seedTutor({ profileId: profile.id, status: "verified" });
    // The quota, already spent by files the tutor has since removed.
    await sql`insert into materials (id, tutor_id, kind, visibility, title, storage_path, file_name, mime, size_bytes, removed_at, removed_reason)
              values (gen_random_uuid(), ${tutor.id}, 'file', 'private', 'Removed', ${`materials/${tutor.id}/old.pdf`}, 'old.pdf',
                      'application/pdf', ${200 * 8 * 1024 * 1024}, now(), 'removed-by-tutor')`;

    const form = new FormData();
    form.set("title", "Encore une fiche");
    form.set("visibility", "private");
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
    form.set("file", new Blob([new Uint8Array(png)], { type: "image/png" }), "fiche.png");
    const res = await fetch(`${API}/materials`, { method: "POST", headers: { cookie: `tnajem_session=${await mintSession(profile.id)}` }, body: form });
    expect(await res.json()).toEqual({ ok: false, error: "storage-quota-reached" });
  });
});
