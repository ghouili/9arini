import { test, expect, type Browser } from "@playwright/test";
import { sql } from "./support/db";
import { seedProfile, seedTutor, seedClass } from "./support/seed";
import { mintSession, sessionCookie } from "./support/session";

/* ════════════════════════════════════════════════════════════════════════════
   The free first session is promised by the toggle — not by the bio.

   On 14 Sept the demo bio ended "1ère séance offerte" while the storefront's own
   badge was driven by offers_free_first_session. A tutor who turns the option
   OFF and leaves that sentence in keeps advertising a session the booking flow
   will charge for. Pinned:

     • option OFF + bio with the promise → the onboarding form warns (live)
     • option ON  + the same bio        → no warning
     • the storefront's "1ère séance gratuite" follows the option, whatever
       the bio says

   ADDED, never edited into an existing spec. */

const WARNING = "mais l'option est désactivée";
const PROMISE_BIO = "« Révisions Bac, à ton rythme. 1ère séance offerte. »";

async function tutorOnOnboarding(browser: Browser, offersFreeFirstSession: boolean) {
  const me = await seedProfile({ role: "tutor", birthYear: 1986 });
  const tutor = await seedTutor({ profileId: me.id, status: "verified", offersFreeFirstSession });
  await sql`update tutors set bio = ${PROMISE_BIO} where id = ${tutor.id}`;
  const ctx = await browser.newContext();
  await ctx.addCookies([sessionCookie(await mintSession(me.id))]);
  const page = await ctx.newPage();
  await page.goto("/fr/onboarding");
  return { ctx, page };
}

test("option OFF + a bio promising a free session: the form warns, and stops when the phrase goes", async ({ browser }) => {
  const { ctx, page } = await tutorOnOnboarding(browser, false);
  const bio = page.getByPlaceholder(/On révise les maths/);
  await expect(bio, "the saved bio is pre-filled").toHaveValue(PROMISE_BIO);

  const status = page.getByRole("status").filter({ hasText: WARNING });
  await expect(status, "the mismatch is announced").toHaveCount(1);

  await bio.fill("« Révisions Bac, à ton rythme. »");
  await expect(status, "no promise, no warning").toHaveCount(0);

  await bio.fill("« Révisions Bac. Première séance gratuite ! »");
  await expect(status, "the warning follows the text live").toHaveCount(1);

  // A warning, not a block.
  await expect(page.getByRole("button", { name: /Publier ma page/i })).toBeEnabled();
  await ctx.close();
});

test("option ON + the same bio: no warning", async ({ browser }) => {
  const { ctx, page } = await tutorOnOnboarding(browser, true);
  await expect(page.getByPlaceholder(/On révise les maths/)).toHaveValue(PROMISE_BIO);
  await expect(page.getByText(WARNING)).toHaveCount(0);
  await ctx.close();
});

test("the storefront's free-session badge follows the option, not the bio", async ({ page }) => {
  const off = await seedTutor({ status: "verified", offersFreeFirstSession: false, fullName: "Toggle Off Tutor" });
  await sql`update tutors set bio = ${PROMISE_BIO} where id = ${off.id}`;
  await seedClass({ tutorId: off.id, isFreeFirst: true, hoursFromNow: 72 });

  const on = await seedTutor({ status: "verified", offersFreeFirstSession: true, fullName: "Toggle On Tutor" });
  await seedClass({ tutorId: on.id, isFreeFirst: true, hoursFromNow: 72 });

  await page.goto(`/fr/${off.slug}`);
  await expect(page.locator(".sf-pills"), "the page is bookable").toBeVisible();
  await expect(page.locator(".sf-pill", { hasText: "1ère séance gratuite" }), "option OFF: no badge, whatever the bio says").toHaveCount(0);

  await page.goto(`/fr/${on.slug}`);
  await expect(page.locator(".sf-pill", { hasText: "1ère séance gratuite" }), "option ON: the badge").toHaveCount(1);
  await expect(page.locator(".sf-bio"), "and the bio makes no claim of its own").not.toContainText("offerte");
});
