import { test, expect } from "@playwright/test";
import { sql } from "./support/db";
import { seedProfile } from "./support/seed";
import { mintSession, sha256, sessionCookie } from "./support/session";
import { recoverOtp, resetRateLimits } from "./support/otp";
import { api, browserSession } from "./support/journey";

/* SESSIONS (production readiness Stage 4). Every rule here is enforced in
   apps/api/src/lib/session.ts on every request, so each test ends with the
   request that must now be refused. */

async function whoAmI(token: string): Promise<{ id?: string; role?: string } | null> {
  return (await api("/me", token)) as { id?: string; role?: string } | null;
}

test.describe("security: session storage", () => {
  test("the sessions table holds the token's hash, never the token", async () => {
    await resetRateLimits();
    const me = await seedProfile({ role: "student", birthYear: 1990 });
    const requested = await api("/auth/otp/request", undefined, { identifier: me.email, locale: "fr" });
    expect(requested.ok, JSON.stringify(requested)).toBe(true);
    const verified = (await api("/auth/otp/verify", undefined, {
      identifier: me.email,
      code: await recoverOtp(me.email),
      role: "student",
    })) as { ok: boolean; session?: { token: string } };
    expect(verified.ok).toBe(true);
    const token = verified.session!.token;

    const [raw] = await sql<{ n: number }[]>`select count(*)::int n from sessions where token_hash = ${token}`;
    expect(raw.n, "the raw token must not be stored").toBe(0);
    const [hashed] = await sql<{ n: number }[]>`
      select count(*)::int n from sessions where token_hash = ${sha256(token)} and profile_id = ${me.id}`;
    expect(hashed.n, "its sha256 is").toBe(1);
    expect((await whoAmI(token))?.id).toBe(me.id);
  });
});

test.describe("security: session expiry and revocation take effect on the next request", () => {
  test("a session idle for longer than the idle window is refused", async () => {
    const me = await seedProfile({ role: "student" });
    const token = await mintSession(me.id, 30);
    expect((await whoAmI(token))?.id).toBe(me.id);

    await sql`update sessions set last_seen_at = now() - interval '15 days' where token_hash = ${sha256(token)}`;
    expect(await whoAmI(token), "14 days unused ends the session").toBeNull();
  });

  test("activity keeps a session alive: a recent request moves the idle clock", async () => {
    const me = await seedProfile({ role: "student" });
    const token = await mintSession(me.id, 30);
    await sql`update sessions set last_seen_at = now() - interval '13 days' where token_hash = ${sha256(token)}`;
    expect((await whoAmI(token))?.id, "13 days is still inside the window").toBe(me.id);
    const [row] = await sql<{ fresh: boolean }[]>`
      select last_seen_at > now() - interval '1 minute' as fresh from sessions where token_hash = ${sha256(token)}`;
    expect(row.fresh, "the request must have moved last_seen_at").toBe(true);
  });

  test("the absolute expiry still applies to an active session", async () => {
    const me = await seedProfile({ role: "student" });
    const token = await mintSession(me.id);
    await sql`update sessions set expires_at = now() - interval '1 second' where token_hash = ${sha256(token)}`;
    expect(await whoAmI(token)).toBeNull();
  });

  test("logout everywhere ends every device's session, this one included", async () => {
    const me = await seedProfile({ role: "student" });
    const phone = await mintSession(me.id);
    const laptop = await mintSession(me.id);
    const other = await seedProfile({ role: "student" });
    const stranger = await mintSession(other.id);

    const res = await api("/auth/logout-all", phone, {});
    expect(res).toEqual({ ok: true, ended: 2 });
    expect(await whoAmI(phone)).toBeNull();
    expect(await whoAmI(laptop)).toBeNull();
    expect((await whoAmI(stranger))?.id, "another person's session is untouched").toBe(other.id);
  });

  test("asking for deletion signs out every other device and keeps this one", async () => {
    const me = await seedProfile({ role: "student" });
    const here = await mintSession(me.id);
    const elsewhere = await mintSession(me.id);

    const res = await api("/account/delete", here, {});
    expect(res.ok, JSON.stringify(res)).toBe(true);
    expect((await whoAmI(here))?.id, "this browser can still see the request and cancel it").toBe(me.id);
    expect(await whoAmI(elsewhere)).toBeNull();

    await api("/account/delete/cancel", here, {});
  });
});

test.describe("security: a privilege change rotates the session", () => {
  test("becoming a tutor retires the student token and issues a new one", async () => {
    const me = await seedProfile({ role: "student", birthYear: 1990 });
    const studentToken = await mintSession(me.id);

    const res = (await api("/profile/become-tutor", studentToken, { confirm: true })) as {
      ok: boolean;
      role?: string;
      session?: { token: string; expiresAt: string };
    };
    expect(res.ok).toBe(true);
    expect(res.session?.token).toMatch(/^[0-9a-f]{64}$/);
    expect(res.session!.token).not.toBe(studentToken);

    expect(await whoAmI(studentToken), "the token that authenticated a student is dead").toBeNull();
    expect((await whoAmI(res.session!.token))?.role).toBe("tutor");
  });

  test("through the UI, the browser ends up holding the new token and stays signed in", async ({ browser }) => {
    const me = await seedProfile({ role: "student", birthYear: 1990 });
    const before = await mintSession(me.id);
    const ctx = await browser.newContext();
    await ctx.addCookies([sessionCookie(before)]);
    const page = await ctx.newPage();
    await page.goto("/fr/onboarding/upgrade", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /passer en compte prof/i }).first().click();

    await expect.poll(async () => (await browserSession(ctx)) !== before, {
      timeout: 20_000,
      message: "the web must replace the cookie with the rotated token",
    }).toBe(true);
    const after = await browserSession(ctx);
    expect((await whoAmI(after))?.role).toBe("tutor");
    expect(await whoAmI(before)).toBeNull();
    await expect(page).toHaveURL(/\/fr\/onboarding/);
    await ctx.close();
  });
});
