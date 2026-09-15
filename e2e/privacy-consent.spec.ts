import { test, expect } from "@playwright/test";
import { sql } from "./support/db";
import { seedClass, seedProfile, seedTutor } from "./support/seed";
import { mintSession } from "./support/session";
import { api, contextAs } from "./support/journey";
import { recoverOtp, resetRateLimits } from "./support/otp";
import { CONSENT_POLICY_VERSION, TERMS_VERSION } from "@tnajem/shared/legal";

/* CONSENT RECORDS (production readiness Stage 5): a version and a timestamp on
   every consent, withdrawal as easy as granting, and the terms an account was
   created under. */

const minorYear = () => new Date().getFullYear() - 15;

async function giveConsent(childToken: string, guardianEmail: string) {
  return api("/consent", childToken, { guardianName: "Parent E2E", guardianPhone: "+21620000000", guardianEmail });
}

test.describe("privacy: consent is recorded with its version and date", () => {
  test("the policy version and the moment are stored, and refreshed when consent is given again", async () => {
    const child = await seedProfile({ role: "student", birthYear: minorYear() });
    const parent = await seedProfile({ role: "guardian", birthYear: 1980 });
    const token = await mintSession(child.id);

    expect((await giveConsent(token, parent.email)).ok).toBe(true);
    const [first] = await sql<{ policy_version: string; fresh: boolean }[]>`
      select policy_version, signed_at > now() - interval '1 minute' as fresh from consents where minor_id = ${child.id}`;
    expect(first).toEqual({ policy_version: CONSENT_POLICY_VERSION, fresh: true });

    await sql`update consents set signed_at = now() - interval '10 days', policy_version = 'old' where minor_id = ${child.id}`;
    expect((await giveConsent(token, parent.email)).ok).toBe(true);
    const [again] = await sql<{ policy_version: string; fresh: boolean }[]>`
      select policy_version, signed_at > now() - interval '1 minute' as fresh from consents where minor_id = ${child.id}`;
    expect(again, "re-signing records the current version and today's date").toEqual({ policy_version: CONSENT_POLICY_VERSION, fresh: true });
  });
});

test.describe("privacy: a guardian withdraws consent as easily as it was given", () => {
  test("from the parent space: bookings stop, upcoming seats are released, and only the guardian gives it back", async ({ browser }) => {
    const tutorProfile = await seedProfile({ role: "tutor", birthYear: 1985 });
    const tutor = await seedTutor({ profileId: tutorProfile.id, status: "verified" });
    const booked = await seedClass({ tutorId: tutor.id, seats: 5, hoursFromNow: 96 });
    const another = await seedClass({ tutorId: tutor.id, seats: 5, hoursFromNow: 120 });

    const child = await seedProfile({ role: "student", birthYear: minorYear(), fullName: "Enfant Consent" });
    const parent = await seedProfile({ role: "guardian", birthYear: 1980 });
    const childToken = await mintSession(child.id);
    expect((await giveConsent(childToken, parent.email)).ok).toBe(true);
    expect((await api("/bookings", childToken, { classId: booked.id })).ok, "consent given: the child books").toBe(true);

    const ctx = await contextAs(browser, parent.id);
    const page = await ctx.newPage();
    await page.goto("/fr/guardian", { waitUntil: "networkidle" });
    const block = page.locator("[data-e2e=consent-block]");
    await expect(block).toContainText(`version ${CONSENT_POLICY_VERSION}`);
    await block.getByRole("button", { name: "Retirer mon accord" }).click();
    await block.getByRole("button", { name: "Oui, retirer mon accord" }).click();
    await expect(block.getByRole("status")).toContainText("Accord retiré. 1 séance(s) à venir annulée(s).");
    await expect(block).toContainText("Ton enfant ne peut plus réserver");

    const [consent] = await sql<{ withdrawn_by: string | null; withdrawn: boolean }[]>`
      select withdrawn_by, withdrawn_at is not null as withdrawn from consents where minor_id = ${child.id}`;
    expect(consent).toEqual({ withdrawn_by: parent.id, withdrawn: true });
    const [seat] = await sql<{ status: string }[]>`select status from bookings where class_id = ${booked.id} and student_id = ${child.id}`;
    expect(seat.status).toBe("cancelled");
    const [ledger] = await sql<{ reason: string; retained_tnd: string }[]>`
      select reason, retained_tnd from cancellations where class_id = ${booked.id}`;
    expect(ledger.reason).toBe("consent-withdrawn");
    expect(Number(ledger.retained_tnd), "waived: the child did not choose to cancel").toBe(0);
    const tutorNotes = (await api("/notifications", await mintSession(tutorProfile.id))) as unknown as { body: string }[];
    expect(tutorNotes.map((n) => n.body).join(" ")).toContain("Une place s'est libérée");

    expect(await api("/bookings", childToken, { classId: another.id }), "withdrawn: no new booking").toMatchObject({ ok: false, error: "needs-consent" });
    expect(await giveConsent(childToken, parent.email), "the child cannot undo the guardian's withdrawal").toEqual({ ok: false, error: "consent-withdrawn" });

    await block.getByRole("button", { name: "Redonner mon accord" }).click();
    await expect(block.getByRole("status")).toContainText("Accord redonné");
    expect((await api("/bookings", childToken, { classId: another.id })).ok, "given back: booking works again").toBe(true);
    await ctx.close();
  });
});

test.describe("privacy: an account records the terms it was created under", () => {
  test("the signup screen names the terms and the policy, and the new account stores the version", async ({ page }) => {
    await page.goto("/fr/signup/eleve");
    const note = page.locator("[data-e2e=signup-terms]");
    await expect(note).toContainText("En créant ton compte, tu acceptes les conditions d'utilisation et la politique de confidentialité.");
    await expect(note.getByRole("link", { name: "conditions d'utilisation" })).toHaveAttribute("href", /\/fr\/terms$/);
    await expect(note.getByRole("link", { name: "politique de confidentialité" })).toHaveAttribute("href", /\/fr\/privacy$/);

    await resetRateLimits();
    const email = `e2e-terms-${Date.now()}@tnajem.invalid`;
    expect((await api("/auth/otp/request", undefined, { identifier: email, locale: "fr" })).ok).toBe(true);
    const verified = await api("/auth/otp/verify", undefined, { identifier: email, code: await recoverOtp(email), role: "student", birthYear: 1995 });
    expect(verified.created).toBe(true);
    const [p] = await sql<{ terms_version: string; fresh: boolean }[]>`
      select terms_version, terms_accepted_at > now() - interval '1 minute' as fresh from profiles where email = ${email}`;
    expect(p).toEqual({ terms_version: TERMS_VERSION, fresh: true });
    await sql`delete from profiles where email = ${email}`;
  });
});
