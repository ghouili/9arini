import { test, expect } from "@playwright/test";
import { seedProfile, seedTutor } from "./support/seed";
import { mintSession, sessionCookie } from "./support/session";

/* phase-a lane L2 · A17 — the dashboards check the role SERVER-SIDE, both ways.

   A student who opened /fr/dashboard used to get the tutor shell and "Crée ta
   vitrine": the role check was lost when the backend was split. The layouts now
   redirect before anything renders (app/[locale]/dashboard/layout.tsx and
   app/[locale]/student/layout.tsx), and GET /dashboard answers { wrongRole }
   (apps/api/test/a17-role-dashboard.test.ts). ADDED, never edited into an
   existing spec. */

test.describe("A17 · each role stays in its own space", () => {
  test("a student opening /fr/dashboard lands on /fr/student and never sees « Crée ta vitrine »", async ({ browser }) => {
    const student = await seedProfile({ role: "student", birthYear: 1990 });
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    await ctx.addCookies([sessionCookie(await mintSession(student.id))]);
    const page = await ctx.newPage();

    const res = await page.request.get("/fr/dashboard", { maxRedirects: 0 });
    expect(res.status(), "redirected on the server, before any HTML").toBe(307);
    expect(res.headers()["location"]).toMatch(/\/fr\/student$/);
    expect(await res.text()).not.toMatch(/cr[ée]e?r? ta vitrine/i);

    await page.goto("/fr/dashboard");
    await expect(page).toHaveURL(/\/fr\/student$/);
    await expect(page.getByText(/cr[ée]e?r? ta vitrine/i)).toHaveCount(0);

    // Every page under /dashboard is covered by the same layout.
    for (const sub of ["/fr/dashboard/new-class", "/fr/dashboard/payout", "/ar/dashboard"]) {
      const r = await page.request.get(sub, { maxRedirects: 0 });
      expect(r.status(), sub).toBe(307);
      expect(r.headers()["location"], sub).toMatch(/\/(fr|ar)\/student$/);
    }
    await ctx.close();
  });

  test("a tutor opening /fr/student lands on /fr/dashboard", async ({ browser }) => {
    const tutorProfile = await seedProfile({ role: "tutor", birthYear: 1985 });
    await seedTutor({ profileId: tutorProfile.id, status: "verified" });
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    await ctx.addCookies([sessionCookie(await mintSession(tutorProfile.id))]);
    const page = await ctx.newPage();

    for (const path of ["/fr/student", "/fr/student/welcome"]) {
      const r = await page.request.get(path, { maxRedirects: 0 });
      expect(r.status(), path).toBe(307);
      expect(r.headers()["location"], path).toMatch(/\/fr\/dashboard$/);
    }
    await page.goto("/fr/student");
    await expect(page).toHaveURL(/\/fr\/dashboard$/);
    await ctx.close();
  });

  test("each role still reaches its own space", async ({ browser }) => {
    const student = await seedProfile({ role: "student", birthYear: 1990 });
    const sCtx = await browser.newContext();
    await sCtx.addCookies([sessionCookie(await mintSession(student.id))]);
    expect((await sCtx.request.get("/fr/student", { maxRedirects: 0 })).status()).toBe(200);
    await sCtx.close();

    const tutorProfile = await seedProfile({ role: "tutor", birthYear: 1985 });
    await seedTutor({ profileId: tutorProfile.id, status: "verified" });
    const tCtx = await browser.newContext();
    await tCtx.addCookies([sessionCookie(await mintSession(tutorProfile.id))]);
    expect((await tCtx.request.get("/fr/dashboard", { maxRedirects: 0 })).status()).toBe(200);
    await tCtx.close();
  });
});
