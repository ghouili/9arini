import { test, expect, type APIRequestContext } from "@playwright/test";
import { seedTutor, seedClass } from "./support/seed";

/* phase-a lane L3 (A5) — nothing public promises a free first session the product
   does not give.

     1. /tarifs said "La 1ʳᵉ séance est toujours offerte à l'élève" (AR "ديما فابور")
        while the free session is a per-tutor opt-in, OFF by default. It now says
        "Si ton prof l'offre, ta 1ʳᵉ séance avec lui est gratuite."
     2. The storefront's link preview (og:description — the WhatsApp card) promised
        "1ère séance offerte" on the tutor's toggle alone. It now needs the toggle
        AND a bookable free-first class (advertisesFreeFirst in @tnajem/shared).

   ADDED, never edited into an existing spec. */

function ogDescription(html: string): string {
  return html.match(/<meta property="og:description" content="([^"]*)"/)?.[1] ?? "";
}

async function text(request: APIRequestContext, url: string): Promise<string> {
  const res = await request.get(url);
  expect(res.status(), url).toBe(200);
  return res.text();
}

for (const locale of ["fr", "ar"] as const) {
  test(`/${locale}/tarifs never says the first session is ALWAYS free`, async ({ page }) => {
    await page.goto(`/${locale}/tarifs`);
    const body = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    expect(body).not.toMatch(/toujours offerte/i);
    expect(body).not.toContain("ديما فابور");
    if (locale === "fr") expect(body).toContain("Si ton prof l'offre, ta 1ʳᵉ séance avec lui est gratuite.");
  });
}

test("toggle OFF: the link preview promises no free session, even with a class flagged free", async ({ request }) => {
  const tutor = await seedTutor({ status: "verified", offersFreeFirstSession: false });
  await seedClass({ tutorId: tutor.id, isFreeFirst: true, priceTnd: 20, hoursFromNow: 96 });
  const og = ogDescription(await text(request, `/fr/${tutor.slug}`));
  expect(og, "og:description must exist").not.toBe("");
  expect(og).not.toMatch(/offerte|gratuite/i);
});

test("toggle ON but only paid classes: still no promise", async ({ request }) => {
  const tutor = await seedTutor({ status: "verified", offersFreeFirstSession: true });
  await seedClass({ tutorId: tutor.id, isFreeFirst: false, priceTnd: 20, hoursFromNow: 96 });
  const og = ogDescription(await text(request, `/fr/${tutor.slug}`));
  expect(og).not.toMatch(/offerte|gratuite/i);
});

test("toggle ON and a bookable free-first class: the promise is made, because it is true", async ({ request }) => {
  const tutor = await seedTutor({ status: "verified", offersFreeFirstSession: true });
  await seedClass({ tutorId: tutor.id, isFreeFirst: true, priceTnd: 20, hoursFromNow: 96 });
  const og = ogDescription(await text(request, `/fr/${tutor.slug}`));
  expect(og).toContain("1ère séance offerte");
});
