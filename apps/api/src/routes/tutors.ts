import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  and, desc, eq, ilike, inArray, or, sql as raw,
  classes, profiles, reviews, subscriptions, tutors,
} from "@tnajem/db";
import {
  vSlug, vText, vOptionalText, vOptionalPhone,
  normalizePhone, isValidPhone, publicDisplayName,
  type ExploreTutor, type TutorReviews, type Storefront, type PublicTutorRef,
} from "@tnajem/shared";
import { db } from "../db";
import { getSession } from "../lib/session";
import { assertNoContactInfo, CONTACT_ERROR } from "../lib/contact-guard";
import { exploreBoostSql, subscriptionIsLiveSql } from "../lib/entitlements";

/* tutors — createTutor, and the three PUBLIC reads that feed the cached storefront.

   ══════════════════════════════════════════════════════════════════════════════
   THE READS BELOW ARE ANONYMOUS AND MUST STAY THAT WAY.
   ══════════════════════════════════════════════════════════════════════════════
   /storefront, /reviews and /explore are called during SSR by pages that are
   ISR-cached. Their web-side proxies use callAnonymous(), which touches neither
   cookies() nor headers(), because inside unstable_cache Next 14 THROWS on
   cookies() and outside it the route silently opts out of caching — no error, no
   warning, just a database round trip on every WhatsApp-storm hit.

   Nothing here may become session-dependent. If a future change needs "what this
   viewer sees", it belongs on a different, authenticated endpoint.
   e2e/isr.spec.ts is the guard. */

const createTutorBody = z.object({
  name: z.string(),
  subject: z.string(),
  bio: z.string(),
  slug: z.string(),
  phone: z.string().nullable().optional(),
});

export async function tutorRoutes(app: FastifyInstance): Promise<void> {
  /* ── POST /tutors (create or update the caller's storefront) ─────────────── */
  app.post("/tutors", async (req, reply) => {
    const parsed = createTutorBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad-request" });
    const input = parsed.data;

    // `/[slug]` is a root catch-all → a reserved slug would shadow a real route.
    const slug = vSlug(input.slug);
    if (!slug.ok) return { ok: false, error: slug.error };
    const name = vText(input.name, { field: "name", max: 80, min: 2 });
    if (!name.ok) return { ok: false, error: name.error };
    const subject = vText(input.subject, { field: "subject", max: 80 });
    if (!subject.ok) return { ok: false, error: subject.error };
    const bio = vOptionalText(input.bio, { field: "bio", max: 1000 });
    if (!bio.ok) return { ok: false, error: bio.error };

    /* Optional CONTACT phone, same role as on the student welcome screen: email is
       the login identity, so this is where a tutor's number is collected. It is
       what lets notify() text them about a new booking. */
    const phone = vOptionalPhone(input.phone);
    if (!phone.ok) return { ok: false, error: phone.error };
    const normalizedPhone = phone.value ? normalizePhone(phone.value) : null;
    if (normalizedPhone && !isValidPhone(normalizedPhone)) {
      return { ok: false, error: "invalid-phone" };
    }

    const session = await getSession(req);
    if (!session) return { ok: false, error: "not-authenticated" };

    /* ---- ROLE GATE ----
       This action used to write `role: "tutor"` alongside the name, which made it
       the de-facto role switch for the whole product: ANY signed-in profile that
       reached /onboarding became a tutor, one tap from a student's own navigation,
       with nothing asking them to confirm. Meanwhile verifyOtp deliberately
       refuses to change an existing profile's role — so the screen that ASKED for
       a role could not set one, and the action that SET one never asked.

       There is now exactly one writer of role='tutor': /profile/become-tutor,
       behind an explicit confirmation and an adult-age check. This only ever
       writes the display name. */
    if (session.profile.role !== "tutor") return { ok: false, error: "not-a-tutor" };
    const uid = session.profile.id;

    /* ZERO CONTACT EXCHANGE (Step 8). A storefront is a PUBLIC page: a number in
       the bio is not a leak to one counterparty, it is a leak to the open internet
       and every scraper on it. REJECTED rather than masked, because the tutor is
       looking at the form and can fix it in ten seconds — silently publishing
       "[masqué]" on their own storefront would be worse.

       AFTER the auth and role gates on purpose: assertNoContactInfo WRITES flag
       rows, and running it before we know who is calling would let an anonymous
       caller fill contact_leak_flags with rows attributed to nobody. */
    if (
      !(await assertNoContactInfo(uid, [
        { surface: "tutor_name", value: name.value },
        { surface: "tutor_subject", value: subject.value },
        { surface: "tutor_bio", value: bio.value },
      ]))
    ) {
      return { ok: false, error: CONTACT_ERROR };
    }

    const [mine] = await db.select().from(tutors).where(eq(tutors.profileId, uid)).limit(1);

    /* ---- THE SLUG IS WRITE-ONCE ----
       This used to .set({ slug, ... }) unconditionally, so any submit could rename
       a live storefront. That silently 404s every link the tutor has already
       shared — the WhatsApp message to their class, the bio link on their
       Instagram — and frees the old slug for someone else to claim. It is the most
       destructive thing this endpoint could do, and it needed nothing more than a
       stale tab or a replayed request.

       So once a storefront exists its slug is fixed HERE. The client mirrors this
       by locking the field, but the rule lives on the server, because a client
       that forgets is exactly the case this defends against. */
    const effectiveSlug = mine ? mine.slug : slug.value;

    if (!mine) {
      // Only a first publish can collide: an existing tutor keeps the slug they hold.
      const [bySlug] = await db
        .select()
        .from(tutors)
        .where(eq(tutors.slug, effectiveSlug))
        .limit(1);
      if (bySlug && bySlug.profileId !== uid) return { ok: false, error: "slug-taken" };
    }

    await db
      .update(profiles)
      // Never null out a number already on file just because this submit omitted it.
      .set({ fullName: name.value, ...(normalizedPhone ? { phone: normalizedPhone } : {}) })
      .where(eq(profiles.id, uid));

    if (mine) {
      await db
        .update(tutors)
        .set({ fullName: name.value, subject: subject.value, bio: bio.value })
        .where(eq(tutors.id, mine.id));
    } else {
      await db.insert(tutors).values({
        profileId: uid,
        slug: effectiveSlug,
        fullName: name.value,
        subject: subject.value,
        bio: bio.value,
      });
    }

    /* revalidateTutor CANNOT run here — revalidateTag only works inside a Next
       request scope. The web replays it from this envelope.

       publicTutors IS busted when the tutor is already VERIFIED, and that is a fix
       Step 9 forced. This used to say "not publicTutors: a tutor here is still
       draft", which was true while this endpoint only ever ran at CREATION. It is
       an EDIT endpoint too, and /explore renders a verified tutor's name and
       subject — so a verified tutor correcting their subject would have kept the
       old one on the catalogue for the rest of the cache window, with no way to
       tell why. Only one slug ever needs busting, because renames are impossible. */
    const wasPublic = mine?.status === "verified";
    return {
      ok: true,
      slug: effectiveSlug,
      revalidate: { tutors: [effectiveSlug], ...(wasPublic ? { publicTutors: true } : {}) },
    };
  });

  /* ── POST /tutors/free-first-session ─────────────────────────────────────
     The tutor's own opt-in for the free first session.

     A DEDICATED endpoint rather than a field on POST /tutors: this one flag is a
     PROMISE ABOUT MONEY to a student, so it deserves its own auditable call
     rather than riding along in a form that also rewrites bio and subject.

     It changes what a PUBLIC, ISR-cached page says, so it reports its slug for
     revalidation. Forgetting that would leave "Première séance offerte" on a
     cached storefront for up to an hour after the tutor turned it off — the
     precise failure this whole step exists to prevent.

     publicTutors is included too, and that is a deliberate over-invalidation
     rather than an oversight: /explore does not render the badge TODAY, but it
     is the obvious place to add one, and the cost of busting a list cache on a
     rare write is nothing next to the cost of a stale money claim. */
  app.post("/tutors/free-first-session", async (req, reply) => {
    const parsed = z.object({ enabled: z.boolean() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad-request" });

    const session = await getSession(req);
    if (!session) return { ok: false, error: "not-authenticated" };
    if (session.profile.role !== "tutor") return { ok: false, error: "not-a-tutor" };

    const [mine] = await db
      .select({ id: tutors.id, slug: tutors.slug })
      .from(tutors)
      .where(eq(tutors.profileId, session.profile.id))
      .limit(1);
    if (!mine) return { ok: false, error: "no-storefront" };

    await db
      .update(tutors)
      .set({ offersFreeFirstSession: parsed.data.enabled })
      .where(eq(tutors.id, mine.id));

    return {
      ok: true,
      enabled: parsed.data.enabled,
      revalidate: { tutors: mine.slug ? [mine.slug] : [], publicTutors: true },
    };
  });

  /* ── GET /tutors/:slug/storefront — PUBLIC, anonymous ────────────────────── */
  app.get<{ Params: { slug: string } }>("/tutors/:slug/storefront", async (req): Promise<Storefront | null> => {
    const { getStorefrontData } = await import("../lib/storefront");
    return getStorefrontData(req.params.slug);
  });

  /* ── GET /tutors/public-refs — PUBLIC, for the sitemap ───────────────────── */
  app.get("/tutors/public-refs", async (): Promise<PublicTutorRef[]> => {
    const rows = await db
      .select({ slug: tutors.slug, createdAt: tutors.createdAt })
      .from(tutors)
      .where(eq(tutors.status, "verified"));
    return rows.map((r) => ({
      slug: r.slug,
      lastModified: r.createdAt ? new Date(r.createdAt) : new Date(),
    }));
  });

  /* ── GET /tutors/:slug/reviews — PUBLIC, anonymous ───────────────────────── */
  app.get<{ Params: { slug: string } }>("/tutors/:slug/reviews", async (req): Promise<TutorReviews> => {
    const empty: TutorReviews = { items: [], average: 0, count: 0 };
    const tutorSlug = req.params.slug;
    if (typeof tutorSlug !== "string" || !tutorSlug.trim()) return empty;

    const [t] = await db.select().from(tutors).where(eq(tutors.slug, tutorSlug.trim())).limit(1);
    if (!t) return empty;
    /* Match the storefront: a non-verified tutor has no public page, so it must
       have no public review feed either — otherwise reviews leak the existence and
       reputation of a rejected tutor to anyone who guesses the slug. */
    if (t.status !== "verified") return empty;

    /* Only the reviewer's FIRST NAME ships (publicDisplayName) — never
       profiles.phone, never the raw full name, never the reviewer's profile id.
       This is a fully public, unauthenticated surface, so the projection below IS
       the security boundary: it selects fullName and nothing else identifying. */
    const rows = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        text: reviews.text,
        createdAt: reviews.createdAt,
        studentName: profiles.fullName,
        classTitle: classes.title,
      })
      .from(reviews)
      /* LEFT join, not inner. Step 15 made reviews.student_id nullable so that a
         student closing their account ANONYMISES their review instead of deleting
         it — and an inner join here would have silently undone that: the review
         would survive in the table, keep counting toward tutors.rating, and
         vanish from the public feed. A rating with no visible reviews behind it
         is the exact "unexplainable number" the change was meant to prevent.
         publicDisplayName(null) is null, which the storefront renders as an
         anonymous byline. */
      .leftJoin(profiles, eq(reviews.studentId, profiles.id))
      .leftJoin(classes, eq(reviews.classId, classes.id))
      .where(eq(reviews.tutorId, t.id))
      .orderBy(desc(reviews.createdAt))
      .limit(50);

    const items = rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      text: r.text,
      // Step 8 tightened this from "Amine K." to "Amine": a surname initial plus
      // a subject and a city narrows a person a long way, and buys the reader
      // nothing. No phone, no email, no full identity.
      studentName: publicDisplayName(r.studentName),
      classTitle: r.classTitle ?? null,
      createdAt: new Date(r.createdAt).toISOString(),
    }));

    /* Aggregate over the WHOLE table, not over `items`.

       BUG (fixed, preserved here): average and count were computed from the 50
       rows the query happens to return, so a tutor with 200 reviews publicly
       displayed "50 avis" and the average was silently "the average of the 50 most
       recent" rather than the real one. */
    const [agg] = await db
      .select({
        avg: raw<string | null>`avg(${reviews.rating})`,
        n: raw<number>`count(*)::int`,
      })
      .from(reviews)
      .where(eq(reviews.tutorId, t.id));

    const count = agg?.n ?? 0;
    const average = agg?.avg ? Math.round(Number(agg.avg) * 10) / 10 : 0;
    return { items, average, count };
  });

  /* ── GET /tutors/explore — PUBLIC, anonymous ─────────────────────────────── */
  app.get<{ Querystring: { subject?: string; q?: string } }>(
    "/tutors/explore",
    async (req): Promise<ExploreTutor[]> => {
      const subject = (req.query.subject ?? "").trim();
      const q = (req.query.q ?? "").trim().slice(0, 60);

      const conds = [eq(tutors.status, "verified")];
      if (subject) conds.push(ilike(tutors.subject, `%${subject}%`));
      if (q) {
        const like = `%${q}%`;
        const text = or(
          ilike(tutors.fullName, like),
          ilike(tutors.subject, like),
          ilike(tutors.level, like),
          ilike(tutors.bio, like),
        );
        if (text) conds.push(text);
      }

      /* Bounded. This was an unbounded select() over the whole tutors table: it
         grows linearly with the catalogue and /explore calls it on every filter
         change. 60 cards is far more than the grid shows; the filters are the real
         navigation. */
      /* ── PAID PLACEMENT (Step 16) ─────────────────────────────────────────

         Pro and Prestige buy a higher position, which is what /tarifs sells as
         "Mis en avant dans Explorer" and "Placement prioritaire". Two things
         make that acceptable rather than deceptive, and both are load-bearing:

           1. The boost is DISCLOSED. Every boosted card carries `featured:true`
              and the UI marks it, with a line on /explore saying so. A ranking
              somebody paid for and the reader cannot see is an advertisement
              disguised as a recommendation.
           2. It orders, it does not FILTER. A tutor on no plan is never hidden,
              and rating still breaks the tie inside each tier — money moves you
              up the list, it does not buy you a rating.

         The weight is projected into SQL from the shared catalogue rather than
         written out here, so adding a boosted plan cannot leave the ranking
         behind. During the pilot every tutor resolves to 0 and the ordering is
         exactly what it was.

         The boost has to be in the ORDER BY, not applied after the fetch: the
         LIMIT is applied by Postgres, so a boosted tutor sitting 61st by rating
         would never reach a JavaScript sort. */
      const boost = exploreBoostSql();
      const rows = await db
        .select({
          id: tutors.id,
          slug: tutors.slug,
          fullName: tutors.fullName,
          subject: tutors.subject,
          level: tutors.level,
          bio: tutors.bio,
          studentsCount: tutors.studentsCount,
          boost,
        })
        .from(tutors)
        .leftJoin(subscriptions, and(eq(subscriptions.tutorId, tutors.id), subscriptionIsLiveSql))
        .where(and(...conds))
        .orderBy(desc(boost), desc(tutors.rating))
        .limit(60);
      if (rows.length === 0) return [];
      const ids = rows.map((t) => t.id);

      // Ratings straight from reviews (tutors.rating is a cached mirror of this).
      const revAgg = await db
        .select({
          tutorId: reviews.tutorId,
          avg: raw<string | null>`avg(${reviews.rating})`,
          n: raw<number>`count(*)::int`,
        })
        .from(reviews)
        .where(inArray(reviews.tutorId, ids))
        .groupBy(reviews.tutorId);
      const byTutor = new Map(revAgg.map((r) => [r.tutorId, r]));

      // "À partir de X TND" — cheapest class still on sale.
      const priceAgg = await db
        .select({ tutorId: classes.tutorId, min: raw<string | null>`min(${classes.priceTnd})` })
        .from(classes)
        .where(inArray(classes.tutorId, ids))
        .groupBy(classes.tutorId);
      const priceByTutor = new Map(priceAgg.map((r) => [r.tutorId, r.min]));

      const { toExploreTutor } = await import("../lib/explore-map");
      return rows.map((t) =>
        toExploreTutor(t, byTutor.get(t.id), priceByTutor.get(t.id), (t.boost ?? 0) > 0),
      );
    },
  );
}
