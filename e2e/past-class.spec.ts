import { test, expect, type Browser } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { sql } from "./support/db";
import { seedProfile, seedTutor, seedClass } from "./support/seed";
import { mintSession, sessionCookie } from "./support/session";

/* ════════════════════════════════════════════════════════════════════════════
   A class that has started is not for sale — anywhere.

   On 14 Sept a storefront sold a class from 9 September as its "Prochaine
   séance", with "20 places restantes" and a live "Réserver". POST /bookings
   already refused it; every surface that decided what to OFFER looked at seats
   only. Pinned here, for each surface and for the server:

     • the storefront lists only upcoming classes, soonest first, in both locales
     • a tutor with nothing upcoming gets the empty state, in both locales
     • /explore's "à partir de" ignores past classes
     • the class page and checkout offer no booking for a past class
     • the booking action is refused SERVER-SIDE — a crafted POST, and a click on
       a checkout that was open when the class started

   A fresh tutor per test: the storefront read is cached for 60s.
   ADDED, never edited into an existing spec. */

const API = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";

const EMPTY = { fr: "Pas de séance à venir pour l'instant", ar: "ما فماش حصة جاية توّا" } as const;
const CLOSED = "Cette séance n'est plus ouverte à la réservation";

async function asStudent(browser: Browser) {
  const student = await seedProfile({ role: "student", birthYear: 1990 });
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  await ctx.addCookies([sessionCookie(await mintSession(student.id))]);
  return { ctx, student };
}

async function classTitle(id: string): Promise<string> {
  const [row] = await sql<{ title: string }[]>`select title from classes where id = ${id}`;
  return row.title;
}

for (const locale of ["fr", "ar"] as const) {
  test(`/${locale}: a tutor whose only class is past shows the empty state and no booking`, async ({ page }) => {
    const tutor = await seedTutor({ status: "verified" });
    const past = await seedClass({ tutorId: tutor.id, hoursFromNow: -2 });

    await page.goto(`/${locale}/${tutor.slug}`);
    const main = page.locator("main");

    await expect(main, "a past class must not be listed").not.toContainText(await classTitle(past.id));
    await expect(main.getByRole("heading", { name: EMPTY[locale] }).first(), "the empty state renders").toBeVisible();
    await expect(page.locator('a[href*="/checkout"]'), "nothing may lead to checkout").toHaveCount(0);
  });
}

test("only upcoming classes are listed, soonest first, and the next session is the soonest", async ({ page }) => {
  const tutor = await seedTutor({ status: "verified" });
  const past = await seedClass({ tutorId: tutor.id, hoursFromNow: -26 });
  const later = await seedClass({ tutorId: tutor.id, hoursFromNow: 96 });
  const sooner = await seedClass({ tutorId: tutor.id, hoursFromNow: 30 });

  await page.goto(`/fr/${tutor.slug}`);

  const rows = page.locator(".sf-classes .sf-row-title");
  await expect(rows, "two upcoming classes, the past one dropped").toHaveCount(2);
  await expect(rows.nth(0)).toHaveText(await classTitle(sooner.id));
  await expect(rows.nth(1)).toHaveText(await classTitle(later.id));
  await expect(page.locator("main"), "the past class is gone").not.toContainText(await classTitle(past.id));
  await expect(page.locator(".sf-panel-title"), "'Prochaine séance' is the soonest upcoming class").toHaveText(
    await classTitle(sooner.id),
  );
  await expect(page.locator(`a[href*="/checkout?class=${past.id}"]`)).toHaveCount(0);
});

test("/explore's 'à partir de' ignores past classes", async () => {
  const name = `PastPrice ${randomBytes(4).toString("hex")}`;
  const tutor = await seedTutor({ status: "verified", fullName: name });
  await seedClass({ tutorId: tutor.id, hoursFromNow: -48, priceTnd: 5 });
  await seedClass({ tutorId: tutor.id, hoursFromNow: 48, priceTnd: 40 });

  // Phase A+ (P2): search matches the first name, not "first + last" — the slug is exact.
  const rows = (await (await fetch(`${API}/tutors/explore?q=${encodeURIComponent(tutor.slug)}`)).json()) as {
    slug: string;
    price_from_tnd: number | null;
  }[];
  const row = rows.find((r) => r.slug === tutor.slug);
  expect(row?.price_from_tnd, "a price from a class that already ran is not an offer").toBe(40);
});

test("the class page and checkout offer no booking for a past class", async ({ browser }) => {
  const tutor = await seedTutor({ status: "verified" });
  const past = await seedClass({ tutorId: tutor.id, hoursFromNow: -3 });
  const { ctx } = await asStudent(browser);
  const page = await ctx.newPage();

  await page.goto(`/fr/class/${past.id}`);
  // The class page renders the notice twice — desktop panel and mobile card — one hidden per width.
  await expect(page.getByText(CLOSED).filter({ visible: true }), "the class page says it is closed").toHaveCount(1);
  await expect(page.locator(`a[href*="/checkout?class=${past.id}"]`), "no Réserver link").toHaveCount(0);

  await page.goto(`/fr/checkout?class=${past.id}`);
  await expect(page.getByText(CLOSED).filter({ visible: true }), "checkout says it is closed").toHaveCount(1);
  await expect(page.getByRole("button", { name: /Confirmer ma place/ }), "no confirm button").toHaveCount(0);

  await ctx.close();
});

test("a crafted booking for a past class is refused by the server", async () => {
  const tutor = await seedTutor({ status: "verified" });
  const past = await seedClass({ tutorId: tutor.id, hoursFromNow: -1, seats: 20 });
  const student = await seedProfile({ role: "student", birthYear: 1990 });

  const res = await fetch(`${API}/bookings`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `tnajem_session=${await mintSession(student.id)}` },
    body: JSON.stringify({ classId: past.id }),
  });
  const body = (await res.json()) as { ok: boolean; error?: string };

  expect(body.ok, "the server must refuse, whatever the UI shows").toBe(false);
  expect(body.error).toBe("unavailable");
  const [bk] = await sql<{ n: number }[]>`select count(*)::int n from bookings where class_id = ${past.id}`;
  expect(bk.n, "no booking row may be written").toBe(0);
});

test("a checkout left open while the class starts is refused by the booking action", async ({ browser }) => {
  /* The UI decides at render; the clock keeps moving. The class starts ~20s from
     now, the checkout is loaded while it is still open, and the click lands after
     the start — so the only thing standing between the student and a seat in a
     class that has begun is the server action and the API behind it. */
  const tutor = await seedTutor({ status: "verified" });
  const startsInMs = 20_000;
  const klass = await seedClass({ tutorId: tutor.id, hoursFromNow: startsInMs / 3_600_000, seats: 20 });
  const startsAt = Date.now() + startsInMs;
  const { ctx } = await asStudent(browser);
  const page = await ctx.newPage();

  await page.goto(`/fr/checkout?class=${klass.id}`);
  const confirm = page.getByRole("button", { name: /Confirmer ma place/ });
  await expect(confirm, "still open when the page loaded").toBeVisible();

  await page.waitForTimeout(Math.max(0, startsAt - Date.now()) + 1_500);
  await confirm.click();

  // Filtered: Next's route announcer is also role="alert", and it is empty.
  await expect(
    page.getByRole("alert").filter({ hasText: "Cette séance n'est plus disponible." }),
    "the server action's refusal reaches the student",
  ).toHaveCount(1);
  const [bk] = await sql<{ n: number }[]>`select count(*)::int n from bookings where class_id = ${klass.id}`;
  expect(bk.n, "no booking row may be written").toBe(0);

  await ctx.close();
});
