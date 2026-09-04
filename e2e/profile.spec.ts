import { test, expect } from "@playwright/test";
import { sql } from "./support/db";
import { seedProfile } from "./support/seed";
import { mintSession, sessionCookie } from "./support/session";

/* The profile domain: saveStudentProfile and becomeTutor.

   Added when they moved to apps/api. Neither had an assertion before — the tutor
   spec exercises getOnboardingState by visiting /onboarding, but nothing checked
   what these two WROTE, so a broken port would have left the suite green. */

async function as(browser: any, profileId: string) {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  await ctx.addCookies([sessionCookie(await mintSession(profileId))]);
  return ctx;
}

test("a student completes the welcome screen and it persists", async ({ browser }) => {
  const me = await seedProfile({ role: "student", birthYear: 1995, fullName: null as unknown as string });

  const ctx = await as(browser, me.id);
  const page = await ctx.newPage();
  await page.goto("/fr/student/welcome");

  await page.getByPlaceholder("ex. Amine Karoui").fill("Amine Karoui");
  await page.getByRole("button", { name: /Continuer/i }).first().dispatchEvent("click");

  await expect.poll(async () => {
    const [p] = await sql<{ full_name: string | null }[]>`
      select full_name from profiles where id = ${me.id}`;
    return p.full_name;
  }, { timeout: 20_000 }).toBe("Amine Karoui");

  await ctx.close();
});

test("becomeTutor promotes a student and rewrites the role hint", async ({ browser }) => {
  const me = await seedProfile({ role: "student", birthYear: 1990 });

  const ctx = await as(browser, me.id);
  const page = await ctx.newPage();
  await page.goto("/fr/onboarding/upgrade");

  await page.getByRole("button", { name: /passer en compte prof/i }).first().dispatchEvent("click");

  await expect.poll(async () => {
    const [p] = await sql<{ role: string }[]>`select role from profiles where id = ${me.id}`;
    return p.role;
  }, { timeout: 20_000, message: "the role write did not land" }).toBe("tutor");

  /* The role hint is a WEB-side cookie the API never sets — it only reports the
     new role. If this is missing, setRoleHint stopped being called and the header
     renders the wrong nav link until the next full reload.

     POLLED, not read once. The assertion above queries the DATABASE, which changes
     midway through the request; the cookie only exists once the response reaches
     the browser. Reading it immediately after the row flips races the response —
     which is exactly how this flaked. */
  await expect
    .poll(async () => {
      const cookies = await page.context().cookies();
      return cookies.find((c: { name: string; value: string }) => c.name === "tnajem_role")?.value;
    }, { timeout: 15_000, message: "the role-hint cookie must be rewritten on the browser" })
    .toBe("tutor");

  await ctx.close();
});

test("a minor cannot become a tutor", async () => {
  const api = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";
  const minor = await seedProfile({ role: "student", birthYear: new Date().getFullYear() - 15 });
  const token = await mintSession(minor.id);

  const res = await fetch(`${api}/profile/become-tutor`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `tnajem_session=${token}` },
    body: JSON.stringify({ confirm: true }),
  }).then((r) => r.json());

  expect(res.error, "teaching requires an adult on file").toBe("minor-cannot-teach");

  const [p] = await sql<{ role: string }[]>`select role from profiles where id = ${minor.id}`;
  expect(p.role, "and the role must not have changed").toBe("student");
});

test("becomeTutor without confirm is refused", async () => {
  const api = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";
  const me = await seedProfile({ role: "student", birthYear: 1990 });
  const token = await mintSession(me.id);

  const res = await fetch(`${api}/profile/become-tutor`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `tnajem_session=${token}` },
    body: JSON.stringify({ confirm: false }),
  }).then((r) => r.json());

  expect(res.error).toBe("not-confirmed");
  const [p] = await sql<{ role: string }[]>`select role from profiles where id = ${me.id}`;
  expect(p.role).toBe("student");
});

test("a tutor cannot write a student profile", async () => {
  const api = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";
  const tutor = await seedProfile({ role: "tutor", birthYear: 1985 });
  const token = await mintSession(tutor.id);

  const res = await fetch(`${api}/profile/student`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `tnajem_session=${token}` },
    body: JSON.stringify({ fullName: "Someone Else" }),
  }).then((r) => r.json());

  expect(res.error, "the student screen writes a student profile").toBe("not-a-student");
});

test("an unrecognised level is rejected as a tampered payload", async () => {
  const api = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";
  const me = await seedProfile({ role: "student", birthYear: 1995 });
  const token = await mintSession(me.id);

  const res = await fetch(`${api}/profile/student`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `tnajem_session=${token}` },
    body: JSON.stringify({ fullName: "Amine Karoui", level: "not-a-real-level" }),
  }).then((r) => r.json());

  // Absent is fine; present-but-unrecognised means the payload was tampered with.
  expect(res.error).toBe("invalid-level");
});
