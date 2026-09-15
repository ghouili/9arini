import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { sql } from "./support/db";
import { seedAdmin, seedClass, seedProfile, seedTutor } from "./support/seed";
import { contextAs, api } from "./support/journey";
import { e2eStore } from "./support/store";

/* REPORTING, FROM THE PAGES PEOPLE ACTUALLY LAND ON (production readiness Stage 5).

   The API route existed; no page offered it, so nobody could report anything. And
   the queue existed with no screen, so a report went into a table nobody opened.
   Each test uses the real UI, signed out where the brief says "without an account". */

async function publicMaterial(tutorId: string) {
  const id = randomUUID();
  const key = `materials/${tutorId}/${Date.now()}-fiche.pdf`;
  await e2eStore().put(key, Buffer.from("%PDF-1.4 e2e"));
  await sql`insert into materials (id, tutor_id, kind, visibility, title, storage_path, file_name, mime, size_bytes)
            values (${id}, ${tutorId}, 'file', 'public', 'Fiche de révision E2E', ${key}, 'fiche.pdf', 'application/pdf', 12)`;
  return id;
}

test.describe("report: reachable without an account", () => {
  test("a signed-out visitor reports a storefront from the page itself", async ({ page }) => {
    const tutor = await seedTutor({ status: "verified" });
    await page.goto(`/fr/${tutor.slug}`, { waitUntil: "networkidle" });

    await page.getByRole("button", { name: "Signaler un problème" }).click();
    await page.getByLabel("Qu'est-ce qui ne va pas ?").fill("Cette page demande aux élèves d'écrire sur WhatsApp.");
    await page.locator("[data-e2e=report-send]").click();
    await expect(page.locator("[data-e2e=report-done]")).toContainText("Merci, c'est reçu");

    const rows = await sql<{ reporter_profile_id: string | null; subject_kind: string; status: string }[]>`
      select reporter_profile_id, subject_kind, status from reports where subject_id = ${tutor.id}`;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ reporter_profile_id: null, subject_kind: "tutor", status: "open" });
  });

  test("the class page offers the same report, in Arabic too", async ({ page }) => {
    const tutor = await seedTutor({ status: "verified" });
    const klass = await seedClass({ tutorId: tutor.id, hoursFromNow: 72 });
    await page.goto(`/ar/class/${klass.id}`, { waitUntil: "networkidle" });

    await page.getByRole("button", { name: "بلّغ على مشكل" }).click();
    await page.getByLabel("شنوّة المشكل ؟").fill("الحصة هاذي فيها كلام موش لايق.");
    await page.locator("[data-e2e=report-send]").click();
    await expect(page.locator("[data-e2e=report-done]")).toBeVisible();
    const [row] = await sql<{ n: number }[]>`select count(*)::int n from reports where subject_kind = 'class' and subject_id = ${klass.id}`;
    expect(row.n).toBe(1);
  });

  test("a rights-holder asks for a document to be removed, without an account", async ({ page }) => {
    const tutor = await seedTutor({ status: "verified" });
    const materialId = await publicMaterial(tutor.id);
    await page.goto(`/fr/${tutor.slug}`, { waitUntil: "networkidle" });

    const item = page.locator("li").filter({ hasText: "Fiche de révision E2E" });
    await item.getByRole("button", { name: "Signaler" }).click();
    await item.getByLabel("Je suis l'auteur de ce document (droits d'auteur)").check();
    await item.getByLabel("Qu'est-ce qui ne va pas ?").fill("Ce document est copié de mon livre publié en 2024.");
    await item.getByLabel("Ton nom").fill("Autrice E2E");
    await item.getByLabel("Ton e-mail (pour qu'on te réponde)").fill("autrice-e2e@tnajem.invalid");
    await item.locator("[data-e2e=report-send]").click();
    await expect(item.locator("[data-e2e=report-done]")).toBeVisible();

    const [claim] = await sql<{ status: string; claimant_name: string }[]>`
      select status, claimant_name from material_takedowns where material_id = ${materialId}`;
    expect(claim).toMatchObject({ status: "open", claimant_name: "Autrice E2E" });
    const [m] = await sql<{ removed_at: Date | null }[]>`select removed_at from materials where id = ${materialId}`;
    expect(m.removed_at, "filing removes nothing").toBeNull();
  });

  test("a report about something that does not exist is refused", async () => {
    const res = await api("/reports", undefined, { subjectKind: "tutor", subjectId: randomUUID(), reason: "Une page qui n'existe pas du tout." });
    expect(res).toEqual({ ok: false, error: "not-found" });
  });
});

test.describe("report: an admin works the moderation queue", () => {
  test("resolves a report, upholds a copyright claim and approves the photo shown", async ({ browser }) => {
    const admin = await seedAdmin();

    const reported = await seedTutor({ status: "verified", fullName: "Prof Signalé E2E" });
    const reason = `Signalement de test ${randomUUID().slice(0, 8)} — demande un numéro.`;
    await api("/reports", undefined, { subjectKind: "tutor", subjectId: reported.id, reason });

    const owner = await seedTutor({ status: "verified", fullName: "Prof Document E2E" });
    const materialId = await publicMaterial(owner.id);
    await api(`/materials/${materialId}/takedown`, undefined, {
      claimantName: "Ayant droit E2E", claimantEmail: "ayant-droit-e2e@tnajem.invalid", reason: "Reproduction non autorisée de mon cours.",
    });

    const photoProfile = await seedProfile({ role: "tutor", birthYear: 1985 });
    const photoTutor = await seedTutor({ profileId: photoProfile.id, status: "verified", fullName: "Prof Photo E2E" });
    const base = `avatars/${photoTutor.id}/1760000000000`;
    for (const s of ["sm", "md", "lg"]) await e2eStore().put(`${base}-${s}.webp`, Buffer.from(`RIFF${s}WEBPVP8 `));
    await sql`update tutors set avatar_path = ${base}, avatar_status = 'pending', avatar_updated_at = now() where id = ${photoTutor.id}`;

    const ctx = await contextAs(browser, admin.id);
    const page = await ctx.newPage();
    await page.goto("/fr/admin/moderation", { waitUntil: "networkidle" });

    const report = page.locator("[data-e2e=report-item]").filter({ hasText: reason });
    await expect(report).toContainText("Prof Signalé E2E");
    await report.getByRole("button", { name: "Traité" }).click();
    await expect(report).toHaveCount(0);
    const [r] = await sql<{ id: string; status: string; resolved_by: string }[]>`select id, status, resolved_by from reports where reason = ${reason}`;
    expect(r).toMatchObject({ status: "actioned", resolved_by: admin.id });

    const claim = page.locator("[data-e2e=takedown-item]").filter({ hasText: "Ayant droit E2E" });
    await claim.getByRole("button", { name: "Retirer le document" }).click();
    await expect(claim).toHaveCount(0);
    const [m] = await sql<{ removed_reason: string | null }[]>`select removed_reason from materials where id = ${materialId}`;
    expect(m.removed_reason).toBe("copyright-takedown");
    const [strike] = await sql<{ n: number }[]>`select count(*)::int n from tutor_strikes where tutor_id = ${owner.id}`;
    expect(strike.n).toBe(1);

    const photo = page.locator("[data-e2e=photo-item]").filter({ hasText: "Prof Photo E2E" });
    await expect(photo.locator("img")).toHaveAttribute("src", new RegExp(`/api/admin/avatar/${photoTutor.id}/md`));
    await photo.getByRole("button", { name: "Approuver" }).click();
    await expect(photo).toHaveCount(0);
    const [t] = await sql<{ avatar_status: string }[]>`select avatar_status from tutors where id = ${photoTutor.id}`;
    expect(t.avatar_status).toBe("approved");

    const audit = await sql<{ action: string }[]>`
      select action from admin_actions
       where admin_profile_id = ${admin.id} and subject_id in (${r.id}, ${materialId}, ${photoTutor.id})`;
    expect(audit.map((a) => a.action).sort()).toEqual(["avatar.approve", "report.actioned", "takedown.upheld"]);
    await ctx.close();
  });
});
