import { test, expect } from "@playwright/test";
import { sql } from "./support/db";
import { seedAdmin, seedProfile, seedTutor, seedVerificationDoc } from "./support/seed";
import { mintSession, SESSION_COOKIE } from "./support/session";
import { api } from "./support/journey";
import { signedDocLink } from "./support/doc-crypto";

/* The ID-scan endpoint is the single highest-value URL in the product: it is the
   one that returns a Tunisian national ID card. This matrix is the regression
   guard for the admin-allowlist consolidation.

   It was genuinely broken before: the route carried a phone-only allowlist while
   login is email OTP, so profile.phone was null for every admin and it returned
   403 to the very people the queue is for.

   The URL is asserted literally and must stay stable through Step 4 — the web app
   keeps /api/admin/doc/[id] as a pass-through to the API rather than moving it. */

/* A document is never addressable by its id alone (Stage 4): the review queue hands
   each admin a short-lived link bound to them. docStatus takes that URL. */
async function docStatus(request: any, url: string, token?: string) {
  const res = await request.get(url, {
    headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {},
    maxRedirects: 0,
  });
  return res;
}

/** The link the queue gives this admin for this document. */
async function queueLink(adminToken: string, docId: string): Promise<string> {
  const queue = (await api("/admin/verifications", adminToken)) as { items: { docs: { id: string; url: string }[] }[] };
  const doc = queue.items.flatMap((t) => t.docs).find((d) => d.id === docId);
  if (!doc) throw new Error("the document is not in the admin's queue");
  return doc.url;
}

test.describe("admin document access", () => {
  test("200 for an allowlisted admin, 403 for everyone else", async ({ request }) => {
    const admin = await seedAdmin();
    const tutor = await seedTutor({ status: "pending" });
    const doc = await seedVerificationDoc(tutor.id);
    const outsider = await seedProfile({ role: "student" });

    const adminTok = await mintSession(admin.id);
    const outsiderTok = await mintSession(outsider.id);

    const link = await queueLink(adminTok, doc.id);
    const ok = await docStatus(request, link, adminTok);
    expect(ok.status(), "allowlisted admin must be able to open an ID scan").toBe(200);
    expect(ok.headers()["content-type"]).toContain("image/png");

    expect((await docStatus(request, link, outsiderTok)).status(),
      "a logged-in non-admin must not read an ID scan, even holding the admin's link").toBe(403);
    expect((await docStatus(request, link)).status(),
      "an anonymous caller must not read an ID scan").toBe(403);
    expect((await docStatus(request, link, "de".repeat(32))).status(),
      "a forged token must not read an ID scan").toBe(403);
  });

  test("security: a document is not addressable by its id; links expire and open one document", async ({ request }) => {
    const admin = await seedAdmin();
    const adminTok = await mintSession(admin.id);
    const tutor = await seedTutor({ status: "pending" });
    const doc = await seedVerificationDoc(tutor.id);
    const other = await seedVerificationDoc((await seedTutor({ status: "pending" })).id);

    expect((await docStatus(request, `/api/admin/doc/${doc.id}`, adminTok)).status(),
      "the bare id, even with an admin session, returns nothing").toBe(403);

    const link = await queueLink(adminTok, doc.id);
    expect((await docStatus(request, link.replace(doc.id, other.id), adminTok)).status(),
      "a link opens the one document it was issued for").toBe(403);
    expect((await docStatus(request, link.replace(/sig=([0-9a-f])/, (_m, c) => `sig=${c === "0" ? "1" : "0"}`), adminTok)).status(),
      "an altered signature is refused").toBe(403);

    const past = Math.floor(Date.now() / 1000) - 5;
    const expired = await docStatus(request, signedDocLink(doc.id, admin.id, past), adminTok);
    expect(expired.status(), "an expired link says so").toBe(410);
    expect(await expired.text()).toContain("Lien expiré");
    expect((await docStatus(request, signedDocLink(doc.id, admin.id, past + 300), adminTok)).status(),
      "the suite's independent signature matches the API's").toBe(200);
  });

  test("security: every document read writes an audit row naming the admin and the request", async ({ request }) => {
    const admin = await seedAdmin();
    const adminTok = await mintSession(admin.id);
    const tutor = await seedTutor({ status: "pending" });
    const doc = await seedVerificationDoc(tutor.id);

    const res = await docStatus(request, await queueLink(adminTok, doc.id), adminTok);
    expect(res.status()).toBe(200);
    const requestId = res.headers()["x-request-id"];
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);

    const rows = await sql<{ admin_profile_id: string; action: string; subject_kind: string; note: string }[]>`
      select admin_profile_id, action, subject_kind, note from admin_actions
      where subject_id = ${doc.id} and action = 'verification.doc.read'`;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ admin_profile_id: admin.id, subject_kind: "verification_doc", note: `request ${requestId}` });

    // A refused read is not a read: no row.
    await docStatus(request, `/api/admin/doc/${doc.id}`, adminTok);
    const [after] = await sql<{ n: number }[]>`
      select count(*)::int n from admin_actions where subject_id = ${doc.id} and action = 'verification.doc.read'`;
    expect(after.n).toBe(1);
  });

  test("the response keeps every hardening header", async ({ request }) => {
    const admin = await seedAdmin();
    const tutor = await seedTutor({ status: "pending" });
    const doc = await seedVerificationDoc(tutor.id);

    const tok = await mintSession(admin.id);
    const res = await docStatus(request, await queueLink(tok, doc.id), tok);
    expect(res.status()).toBe(200);
    const h = res.headers();

    // Rendering an ID scan as an active document would be the whole exploit.
    expect(h["content-security-policy"]).toContain("default-src 'none'");
    expect(h["content-security-policy"]).toContain("sandbox");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["cache-control"]).toContain("no-store");
    /* Exactly, and alone. On Next 16 a header named in next.config.mjs replaces the
       route's own, so the site-wide strict-origin-when-cross-origin (and the page
       CSP) silently took over this response until the doc route was excluded from
       the site-wide set. toBe, so a merged or replaced value fails here. */
    expect(h["referrer-policy"]).toBe("no-referrer");
    // Downloaded, never rendered in the app's origin. The filename is sanitised at upload.
    expect(h["content-disposition"]).toMatch(/^attachment; filename="[A-Za-z0-9._-]+"$/);
  });

  test("a malformed id is rejected without touching the disk", async ({ request }) => {
    const admin = await seedAdmin();
    const tok = await mintSession(admin.id);
    for (const bad of ["not-a-uuid", "../../etc/passwd", "00000000-0000-0000-0000-000000000000"]) {
      const res = await docStatus(request, `/api/admin/doc/${encodeURIComponent(bad)}`, tok);
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
