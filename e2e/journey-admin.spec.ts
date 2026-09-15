import { test, expect } from "@playwright/test";
import { sql } from "./support/db";
import { seedAdmin, seedProfile, seedTutor, seedClass, seedBooking } from "./support/seed";
import { mintSession } from "./support/session";
import { api, contextAs, specimenIdPng, notificationBodies, auditActions } from "./support/journey";

/* ════════════════════════════════════════════════════════════════════════════
   THE ADMIN JOURNEY, end to end against the real API and database:
   queue → open a real uploaded ID document → approve → reject with a reason →
   block an account (and see what it does) → unblock.

   Before 15 Sept: reject took any tutor (verified too), needed no reason and wrote
   no audit row; approve and reject could both "win" a race; and there was no way
   to block an account at all.

   ADDED, never edited into an existing spec. */

async function uploadId(tutorProfileId: string, png: Buffer, fileName = "cin-recto.png") {
  const form = new FormData();
  form.append("idFront", new Blob([new Uint8Array(png)], { type: "image/png" }), fileName);
  const res = await fetch(`${process.env.E2E_API_URL ?? "http://127.0.0.1:4000"}/verification`, {
    method: "POST",
    headers: { cookie: `tnajem_session=${await mintSession(tutorProfileId)}` },
    body: form,
  });
  return (await res.json()) as Record<string, unknown>;
}

test.describe("admin journey", () => {
  test("queue → open the real uploaded ID → approve; the decision is audited and the tutor told", async ({ browser }, testInfo) => {
    const admin = await seedAdmin();
    const tutorProfile = await seedProfile({ role: "tutor", birthYear: 1986, fullName: "Hela Journey" });
    const tutor = await seedTutor({ profileId: tutorProfile.id, status: "draft", fullName: "Hela Journey" });

    // A REAL upload through POST /verification: multipart, magic bytes, storage.
    const png = await specimenIdPng(browser, "HELA JOURNEY");
    expect(await uploadId(tutorProfile.id, png)).toMatchObject({ ok: true });
    const [doc] = await sql<{ id: string; mime: string; size_bytes: number }[]>`
      select id, mime, size_bytes from verification_docs where tutor_id = ${tutor.id}`;
    expect(doc.mime).toBe("image/png");
    expect(Number(doc.size_bytes)).toBe(png.length);
    const [pending] = await sql<{ status: string }[]>`select status from tutors where id = ${tutor.id}`;
    expect(pending.status, "uploading the ID submits the application").toBe("pending");

    const ctx = await contextAs(browser, admin.id);
    const page = await ctx.newPage();
    await page.goto("/fr/admin/verifications");
    const card = page.locator("article.av-card").filter({ hasText: tutor.slug });
    await expect(card).toHaveCount(1);

    /* Open the document the way an admin does: the link on the card. Since Stage 4 it
       is a signed, short-lived link and the document DOWNLOADS (Content-Disposition:
       attachment) — the stored object is encrypted, so matching bytes also prove the
       API decrypted exactly what the tutor uploaded. */
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      card.getByRole("link", { name: /Identité \(recto\)/ }).click(),
    ]);
    const saved = testInfo.outputPath(`admin-downloads-${download.suggestedFilename()}`);
    await download.saveAs(saved);
    const { readFile } = await import("node:fs/promises");
    expect((await readFile(saved)).equals(png), "the admin receives exactly the bytes the tutor uploaded").toBe(true);
    await testInfo.attach("the ID document the admin downloaded", { path: saved, contentType: "image/png" });
    expect(await auditActions(doc.id), "the read is on record").toContain("verification.doc.read");

    await card.getByRole("button", { name: /Approuver/ }).click();
    await expect.poll(async () => (await sql<{ status: string }[]>`select status from tutors where id = ${tutor.id}`)[0].status, { timeout: 15_000 }).toBe("verified");
    expect(await auditActions(tutor.id)).toContain("verification.approve");
    expect(await notificationBodies(tutorProfile.id, "verification_approved")).toHaveLength(1);

    // A decided application cannot be decided again.
    const adminToken = await mintSession(admin.id);
    expect(await api("/admin/verifications/approve", adminToken, { tutorId: tutor.id })).toMatchObject({ ok: false, error: "not-pending" });
    expect(await api("/admin/verifications/reject", adminToken, { tutorId: tutor.id, note: "Photo illisible" }), "reject can no longer un-verify a live tutor")
      .toMatchObject({ ok: false, error: "not-pending" });
    await ctx.close();
  });

  test("reject needs a reason, the tutor reads it, and it is audited", async ({ browser }) => {
    const admin = await seedAdmin();
    const tutorProfile = await seedProfile({ role: "tutor", birthYear: 1987 });
    const tutor = await seedTutor({ profileId: tutorProfile.id, status: "draft" });
    expect(await uploadId(tutorProfile.id, await specimenIdPng(browser, "REJECT ME"))).toMatchObject({ ok: true });
    const adminToken = await mintSession(admin.id);

    expect(await api("/admin/verifications/reject", adminToken, { tutorId: tutor.id }), "no reason").toMatchObject({ ok: false, error: "note-required" });
    expect(await api("/admin/verifications/reject", adminToken, { tutorId: tutor.id, note: "  ok " }), "too short").toMatchObject({ ok: false, error: "note-required" });

    const ctx = await contextAs(browser, admin.id);
    const page = await ctx.newPage();
    await page.goto("/fr/admin/verifications");
    const card = page.locator("article.av-card").filter({ hasText: tutor.slug });
    await card.getByPlaceholder(/Motif du refus/).fill("La photo de la pièce est floue, renvoie-la en pleine lumière.");
    await card.getByRole("button", { name: /Refuser/ }).click();
    await expect.poll(async () => (await sql<{ status: string }[]>`select status from tutors where id = ${tutor.id}`)[0].status, { timeout: 15_000 }).toBe("rejected");
    await ctx.close();

    const [bodies] = [await notificationBodies(tutorProfile.id, "verification_rejected")];
    expect(bodies).toHaveLength(1);
    expect(bodies[0], "the tutor is told what to fix").toContain("La photo de la pièce est floue");
    expect(await auditActions(tutor.id)).toContain("verification.reject");
  });

  test("a spoofed upload is refused by its bytes, not its claimed type", async () => {
    const tutorProfile = await seedProfile({ role: "tutor", birthYear: 1985 });
    await seedTutor({ profileId: tutorProfile.id, status: "draft" });
    const script = Buffer.from("#!/bin/sh\necho 'not an image' > /tmp/pwned\n".repeat(4));
    expect(await uploadId(tutorProfile.id, script, "cin.png")).toMatchObject({ ok: false, error: "bad-file-type" });
  });

  test("block → the account, its storefront and its classes stop; unblock → the account is back", async ({ browser, request }) => {
    const admin = await seedAdmin();
    const tutorProfile = await seedProfile({ role: "tutor", birthYear: 1980, fullName: "Blocked Journey" });
    const tutor = await seedTutor({ profileId: tutorProfile.id, status: "verified", fullName: "Blocked Journey" });
    const klass = await seedClass({ tutorId: tutor.id, hoursFromNow: 72, seats: 5, seatsTaken: 1, priceTnd: 30 });
    const student = await seedProfile({ role: "student", birthYear: 1996 });
    await seedBooking({ classId: klass.id, studentId: student.id, isFree: false });
    const tutorToken = await mintSession(tutorProfile.id);
    const adminToken = await mintSession(admin.id);

    expect((await request.get(`/fr/${tutor.slug}`)).status(), "live before the block").toBe(200);
    expect(await api("/admin/accounts/block", adminToken, { profileId: admin.id, reason: "test self" })).toMatchObject({ ok: false, error: "cannot-block-self" });
    // The server refuses on its own, not only the page: no silent cancellation of a live class.
    expect(await api("/admin/accounts/block", adminToken, { profileId: tutorProfile.id, reason: "Signalements répétés" }))
      .toMatchObject({ ok: false, error: "has-upcoming", upcomingClasses: 1, upcomingBookings: 0 });
    expect(await api("/admin/accounts/block", adminToken, { profileId: tutorProfile.id, reason: "ok" }), "a reason is required")
      .toMatchObject({ ok: false, error: "reason-required" });

    const ctx = await contextAs(browser, admin.id);
    const page = await ctx.newPage();
    await page.goto("/fr/admin/accounts");
    await page.locator('[data-e2e="account-email"]').fill(tutorProfile.email);
    await page.getByRole("button", { name: "Chercher" }).click();
    const card = page.locator('[data-e2e="account-card"]');
    await expect(card).toContainText("1 cours à venir");
    await card.locator('[data-e2e="block-reason"]').fill("Signalements répétés — enquête en cours.");

    // Without ticking the consequence, the block is refused and nothing moves.
    await card.getByRole("button", { name: "Bloquer le compte" }).click();
    await expect(page.getByText(/coche la case pour les annuler/)).toBeVisible();
    expect((await sql<{ blocked_at: Date | null }[]>`select blocked_at from profiles where id = ${tutorProfile.id}`)[0].blocked_at).toBeNull();

    await card.locator('[data-e2e="block-cancel-upcoming"]').check();
    await card.getByRole("button", { name: "Bloquer le compte" }).click();
    await expect(page.locator('[data-e2e="account-blocked"]')).toBeVisible({ timeout: 15_000 });
    await ctx.close();

    const [p] = await sql<{ blocked_at: Date | null; blocked_reason: string; blocked_by: string }[]>`
      select blocked_at, blocked_reason, blocked_by from profiles where id = ${tutorProfile.id}`;
    expect(p.blocked_at).not.toBeNull();
    expect(p.blocked_by).toBe(admin.id);
    const [t] = await sql<{ suspended_at: Date | null; status: string }[]>`select suspended_at, status from tutors where id = ${tutor.id}`;
    expect(t.suspended_at).not.toBeNull();
    expect(t.status, "the verification decision is untouched").toBe("verified");
    const [s] = await sql<{ n: number }[]>`select count(*)::int n from sessions where profile_id = ${tutorProfile.id}`;
    expect(s.n, "every session is gone").toBe(0);

    expect(await api("/me", tutorToken), "a token minted before the block is worthless").toBeNull();
    /* THE CONTENT goes dark at once: the block replays revalidateTag through the web
       app, so not even the ISR page cache still holds the storefront (measured:
       x-nextjs-cache MISS, no name in the body). THE STATUS follows within the
       middleware's positive-answer TTL (30s) — until then it is a soft 404. */
    expect(await (await request.get(`/fr/${tutor.slug}`)).text(), "no content of a blocked tutor is served, not even from the page cache").not.toContain("Blocked Journey");
    await expect.poll(async () => (await request.get(`/fr/${tutor.slug}`)).status(), { timeout: 40_000, intervals: [2_000] }).toBe(404);
    expect(await api(`/tutors/${tutor.slug}/storefront`)).toBeNull();

    const [c] = await sql<{ status: string; seats_taken: number }[]>`select status, seats_taken from classes where id = ${klass.id}`;
    expect(c).toMatchObject({ status: "cancelled", seats_taken: 0 });
    const [ledger] = await sql<{ actor: string; retained_tnd: string; reason: string }[]>`
      select actor, retained_tnd, reason from cancellations where class_id = ${klass.id}`;
    expect(ledger).toMatchObject({ actor: "system", retained_tnd: "0.00", reason: "account-blocked" });
    const told = await notificationBodies(student.id, "booking_cancelled");
    expect(told).toHaveLength(1);
    expect(told[0], "the student is told the class will not happen").toContain("n'aura pas lieu");
    expect(told[0], "…and never why").not.toMatch(/bloqu|suspend/i);
    expect(await auditActions(tutorProfile.id)).toContain("account.block");

    // Unblock from the page, as an admin would: the web app replays the revalidation.
    const ctx2 = await contextAs(browser, admin.id);
    const page2 = await ctx2.newPage();
    await page2.goto("/fr/admin/accounts");
    await page2.locator('[data-e2e="account-email"]').fill(tutorProfile.email);
    await page2.getByRole("button", { name: "Chercher" }).click();
    await page2.getByRole("button", { name: "Débloquer" }).click();
    await expect.poll(async () => (await sql<{ blocked_at: Date | null }[]>`select blocked_at from profiles where id = ${tutorProfile.id}`)[0].blocked_at, { timeout: 15_000 }).toBeNull();
    await ctx2.close();
    expect(await auditActions(tutorProfile.id)).toContain("account.unblock");
    const [back] = await sql<{ suspended_at: Date | null }[]>`select suspended_at from tutors where id = ${tutor.id}`;
    expect(back.suspended_at).toBeNull();
    // Back within the middleware's negative-answer TTL (10s).
    await expect.poll(async () => (await request.get(`/fr/${tutor.slug}`)).status(), { timeout: 25_000, intervals: [2_000] }).toBe(200);
  });

  test("a blocked account cannot sign in with a valid code", async () => {
    const admin = await seedAdmin();
    const me = await seedProfile({ role: "student", birthYear: 1995 });
    const adminToken = await mintSession(admin.id);
    expect(await api("/admin/accounts/block", adminToken, { profileId: me.id, reason: "Compte frauduleux" })).toMatchObject({ ok: true });

    const { recoverOtp, resetRateLimits } = await import("./support/otp");
    await resetRateLimits();
    expect(await api("/auth/otp/request", undefined, { identifier: me.email, locale: "fr" })).toMatchObject({ ok: true });
    const code = await recoverOtp(me.email);
    expect(await api("/auth/otp/verify", undefined, { identifier: me.email, code, locale: "fr" })).toEqual({ ok: false, error: "account-blocked" });
    const [s] = await sql<{ n: number }[]>`select count(*)::int n from sessions where profile_id = ${me.id}`;
    expect(s.n).toBe(0);
  });
});
