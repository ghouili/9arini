import { test, expect } from "@playwright/test";
import { sql } from "./support/db";
import { seedTutor, seedClass } from "./support/seed";

/* THE ISR GUARD. The brief has no gate for this, and it is the failure that would
   do the most damage while producing no error at all.

   /[locale]/[slug] is the most-shared URL in the product — a tutor pastes their
   link into WhatsApp and it fans out. It is cached: `revalidate = 60` plus an
   unstable_cache wrapper around the reviews read. The build output labels it
   "ƒ (Dynamic)", which is misleading: that means "no paths prerendered at build",
   NOT "not cached". Verified empirically — a bio changed directly in the database
   is NOT reflected on the next request.

   The way this breaks during Step 4 is silent. If a proxy for getStorefront /
   getTutorReviews / getExploreTutors ever touches cookies() or headers():
     - inside unstable_cache, Next 14 THROWS;
     - outside it, the route quietly opts out of ISR. No error, no warning, no
       failing test. The page just gets slower, and every WhatsApp-storm hit
       becomes a database round trip.

   Hence apps/web/lib/api.ts::callAnonymous(), which touches neither. This spec is
   what makes that rule enforceable rather than aspirational. */

test("the storefront is cached — a database change is not reflected immediately", async ({ page, request }) => {
  const tutor = await seedTutor({ status: "verified", fullName: "ISR Probe Tutor" });
  await seedClass({ tutorId: tutor.id, seats: 5, hoursFromNow: 96 });

  /* SETTLE the cache entry before mutating.

     ISR is stale-while-revalidate: a request against an entry older than
     `revalidate` serves the STALE copy and kicks off a regeneration in the
     background, so the NEXT request sees fresh content. Mutating after a single
     warm request therefore races the regeneration and the assertion flaps.
     Two requests with a gap leaves a young entry, and only then is "did it go
     stale?" a question about caching rather than about timing. */
  await request.get(`/fr/${tutor.slug}`);
  await new Promise((r) => setTimeout(r, 1500));
  await request.get(`/fr/${tutor.slug}`);

  const marker = `ISR-MARKER-${Date.now()}`;
  await sql`update tutors set bio = ${marker} where id = ${tutor.id}`;

  const res = await request.get(`/fr/${tutor.slug}`);
  const html = await res.text();

  expect(
    html.includes(marker),
    "The storefront served fresh HTML straight after a database write, which means " +
      "it is no longer cached. Something in the getStorefront/getTutorReviews path " +
      "started touching cookies() or headers() and silently opted the route out of ISR.",
  ).toBe(false);

  await page.close();
});

/* NOT asserted here: that /explore is cached.

   app/[locale]/explore/page.tsx claims in a comment that calling getExploreTutors
   from the server component "keeps the route static+ISR (not dynamic)", and the
   build output labels it "●  (SSG)". Neither is true in practice, measured two
   ways:
     - a tutor seeded after the build shows up on the very next request, and a bio
       changed in the database is reflected immediately;
     - .next/server/app/[locale]/explore contains only page.js — no prerendered
       HTML, unlike a genuinely static route.

   So /explore server-renders on every hit today. That is a pre-existing
   performance gap, NOT something Step 4 introduced, and fixing it would be a
   behaviour change — out of scope for a stage whose contract is that nothing
   changes. Recorded here so the next person measures instead of trusting the
   comment, and so nobody "restores" caching believing it regressed.

   The storefront above is the one that IS cached, is the most-shared URL in the
   product, and is therefore the one worth guarding. */
