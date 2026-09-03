import { test, expect } from "@playwright/test";
import { sql } from "./support/db";
import { seedAdmin, seedProfile, seedTutor, seedVerificationDoc } from "./support/seed";
import { mintSession, SESSION_COOKIE } from "./support/session";

/* The ID-scan endpoint is the single highest-value URL in the product: it is the
   one that returns a Tunisian national ID card. This matrix is the regression
   guard for the admin-allowlist consolidation.

   It was genuinely broken before: the route carried a phone-only allowlist while
   login is email OTP, so profile.phone was null for every admin and it returned
   403 to the very people the queue is for.

   The URL is asserted literally and must stay stable through Step 4 — the web app
   keeps /api/admin/doc/[id] as a pass-through to the API rather than moving it. */

async function docStatus(request: any, docId: string, token?: string) {
  const res = await request.get(`/api/admin/doc/${docId}`, {
    headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {},
    maxRedirects: 0,
  });
  return res;
}

test.describe("admin document access", () => {
  test("200 for an allowlisted admin, 403 for everyone else", async ({ request }) => {
    const admin = await seedAdmin();
    const tutor = await seedTutor({ status: "pending" });
    const doc = await seedVerificationDoc(tutor.id);
    const outsider = await seedProfile({ role: "student" });

    const adminTok = await mintSession(admin.id);
    const outsiderTok = await mintSession(outsider.id);

    const ok = await docStatus(request, doc.id, adminTok);
    expect(ok.status(), "allowlisted admin must be able to open an ID scan").toBe(200);
    expect(ok.headers()["content-type"]).toContain("image/png");

    expect((await docStatus(request, doc.id, outsiderTok)).status(),
      "a logged-in non-admin must not read an ID scan").toBe(403);
    expect((await docStatus(request, doc.id)).status(),
      "an anonymous caller must not read an ID scan").toBe(403);
    expect((await docStatus(request, doc.id, "de".repeat(32))).status(),
      "a forged token must not read an ID scan").toBe(403);
  });

  test("the response keeps every hardening header", async ({ request }) => {
    const admin = await seedAdmin();
    const tutor = await seedTutor({ status: "pending" });
    const doc = await seedVerificationDoc(tutor.id);

    const res = await docStatus(request, doc.id, await mintSession(admin.id));
    expect(res.status()).toBe(200);
    const h = res.headers();

    // Rendering an ID scan as an active document would be the whole exploit.
    expect(h["content-security-policy"]).toContain("default-src 'none'");
    expect(h["content-security-policy"]).toContain("sandbox");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["cache-control"]).toContain("no-store");
    /* toContain, not toBe: next.config.mjs sets a global
       Referrer-Policy: strict-origin-when-cross-origin and the route appends its
       own, so the browser receives "strict-origin-when-cross-origin,
       no-referrer". For Referrer-Policy the last recognised token wins, so the
       effective policy IS no-referrer -- but the header is not that string alone. */
    expect(h["referrer-policy"]).toContain("no-referrer");
    expect(h["content-disposition"]).toBeTruthy();
  });

  test("a malformed id is rejected without touching the disk", async ({ request }) => {
    const admin = await seedAdmin();
    const tok = await mintSession(admin.id);
    for (const bad of ["not-a-uuid", "../../etc/passwd", "00000000-0000-0000-0000-000000000000"]) {
      const res = await docStatus(request, encodeURIComponent(bad), tok);
      expect([400, 403, 404], `id "${bad}" must not return a document`).toContain(res.status());
    }
  });

  test("an admin sees pending tutors in the verification queue", async ({ browser }) => {
    const admin = await seedAdmin();
    const tutor = await seedTutor({ status: "pending" });
    await seedVerificationDoc(tutor.id);

    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const { sessionCookie } = await import("./support/session");
    await ctx.addCookies([sessionCookie(await mintSession(admin.id))]);
    const page = await ctx.newPage();
    await page.goto("/fr/admin/verifications");
    await expect(page.locator("main")).toContainText(tutor.slug);
    await ctx.close();
  });
});

test("approving a pending tutor makes them verified", async ({ browser }) => {
  const admin = await seedAdmin();
  const tutor = await seedTutor({ status: "pending" });
  await seedVerificationDoc(tutor.id);

  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const { sessionCookie } = await import("./support/session");
  await ctx.addCookies([sessionCookie(await mintSession(admin.id))]);
  const page = await ctx.newPage();
  await page.goto("/fr/admin/verifications");

  /* Scope to THIS tutor's card. The development database has real pending tutors
     in the same queue; a .first() click would approve someone else's account and
     assert nothing. */
  const card = page.locator("article.av-card").filter({ hasText: tutor.slug });
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: /approuver/i }).click();
  await expect
    .poll(async () => {
      const [r] = await sql<{ status: string }[]>`select status from tutors where id = ${tutor.id}`;
      return r?.status;
    }, { timeout: 15_000 })
    .toBe("verified");
  await ctx.close();
});
