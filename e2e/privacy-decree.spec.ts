import { test, expect } from "@playwright/test";
import { sql } from "./support/db";
import { seedAdmin, seedProfile, seedTutor } from "./support/seed";
import { mintSession } from "./support/session";
import { contextAs, specimenIdPng } from "./support/journey";
import { PUBLIC_TEACHER_DECLARATION_VERSION } from "@tnajem/shared/legal";

/* DÉCRET N° 2015-1619 (production readiness Stage 5): never feature an identifiable
   serving public-school teacher. The machinery: a declaration the application
   cannot be submitted without, stored with its wording version, and shown to the
   admin beside the institution the tutor named. The wording is LEGAL-REVIEW. */

const API = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";

async function submit(profileId: string, png: Buffer, declare: boolean) {
  const form = new FormData();
  form.append("idFront", new Blob([new Uint8Array(png)], { type: "image/png" }), "cin.png");
  form.append("institution", "Lycée Pilote E2E");
  if (declare) form.append("notPublicTeacher", "yes");
  const res = await fetch(`${API}/verification`, {
    method: "POST",
    headers: { cookie: `tnajem_session=${await mintSession(profileId)}` },
    body: form,
  });
  return (await res.json()) as Record<string, unknown>;
}

test.describe("privacy: Décret 2015-1619 declaration", () => {
  test("an application without the declaration is refused before anything is stored", async ({ browser }) => {
    const profile = await seedProfile({ role: "tutor", birthYear: 1985 });
    const tutor = await seedTutor({ profileId: profile.id, status: "draft" });

    expect(await submit(profile.id, await specimenIdPng(browser, "SANS DECLARATION"), false)).toEqual({ ok: false, error: "declaration-required" });
    const [docs] = await sql<{ n: number }[]>`select count(*)::int n from verification_docs where tutor_id = ${tutor.id}`;
    expect(docs.n, "no scan written for a refused application").toBe(0);
    const [t] = await sql<{ status: string }[]>`select status from tutors where id = ${tutor.id}`;
    expect(t.status).toBe("draft");
  });

  test("the declaration is stored with its version and shown to the admin beside the institution", async ({ browser }) => {
    const profile = await seedProfile({ role: "tutor", birthYear: 1985 });
    const tutor = await seedTutor({ profileId: profile.id, status: "draft" });
    expect((await submit(profile.id, await specimenIdPng(browser, "AVEC DECLARATION"), true)).ok).toBe(true);

    const [t] = await sql<{ version: string; declared: boolean }[]>`
      select public_teacher_declaration_version as version, public_teacher_declared_at is not null as declared
        from tutors where id = ${tutor.id}`;
    expect(t).toEqual({ version: PUBLIC_TEACHER_DECLARATION_VERSION, declared: true });

    const ctx = await contextAs(browser, (await seedAdmin()).id);
    const page = await ctx.newPage();
    await page.goto("/fr/admin/verifications", { waitUntil: "networkidle" });
    const card = page.locator("article.av-card").filter({ hasText: tutor.slug });
    await expect(card).toContainText("Lycée Pilote E2E");
    await expect(card.locator("[data-e2e=decree-line]")).toContainText(`Déclare ne pas enseigner dans le public`);
    await expect(card.locator("[data-e2e=decree-line]")).toContainText(PUBLIC_TEACHER_DECLARATION_VERSION);
    await ctx.close();
  });
});
