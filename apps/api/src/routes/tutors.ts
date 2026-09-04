import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  and, desc, eq, ilike, inArray, or, sql as raw,
  classes, profiles, reviews, tutors,
} from "@tnajem/db";
import {
  vSlug, vText, vOptionalText, vOptionalPhone,
  normalizePhone, isValidPhone, publicName,
  type ExploreTutor, type TutorReviews, type Storefront, type PublicTutorRef,
} from "@tnajem/shared";
import { db } from "../db";
import { getSession } from "../lib/session";

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
       request scope. The web replays it from this envelope. Only one slug can ever
       need busting now that renames are impossible, and NOT publicTutors: a tutor
       here is still `draft`, so nothing about the public set changed. */
    return { ok: true, slug: effectiveSlug, revalidate: { tutors: [effectiveSlug] } };
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

    /* Only the reviewer's SHORTENED name ships ("Amine K." via publicName) — never
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
      .innerJoin(profiles, eq(reviews.studentId, profiles.id))
      .leftJoin(classes, eq(reviews.classId, classes.id))
      .where(eq(reviews.tutorId, t.id))
      .orderBy(desc(reviews.createdAt))
      .limit(50);

    const items = rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      text: r.text,
      studentName: publicName(r.studentName), // "Amine K." — no phone, no full identity
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
      const rows = await db
        .select()
        .from(tutors)
        .where(and(...conds))
        .orderBy(desc(tutors.rating))
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
      return rows.map((t) => toExploreTutor(t, byTutor.get(t.id), priceByTutor.get(t.id)));
    },
  );
}
