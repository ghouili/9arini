import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, classes, profiles, tutors, sql as raw } from "@tnajem/db";
import {
  isMinorBirthYear,
  vBirthYear,
  parseStudentProfile,
  type OnboardingState,
} from "@tnajem/shared";
import { db } from "../db";
import { checkRateLimit } from "../lib/rate-limit";
import { getSession } from "../lib/session";

/* profile — becomeTutor, saveStudentProfile, getOnboardingState.

   Ported from apps/web/app/actions.ts. Every refusal is HTTP 200 with
   { ok:false, error }, per the convention in @tnajem/shared/contracts: the client
   branches on these strings and a status code would break that. */

const becomeTutorBody = z.object({
  confirm: z.boolean(),
  birthYear: z.number().optional(),
});

const studentProfileBody = z.object({
  fullName: z.string(),
  level: z.string().nullable().optional(),
  subjects: z.array(z.string()).optional(),
  phone: z.string().nullable().optional(),
});

export async function profileRoutes(app: FastifyInstance): Promise<void> {
  /* ── POST /profile/become-tutor ─────────────────────────────────────────── */
  app.post("/profile/become-tutor", async (req, reply) => {
    const parsed = becomeTutorBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad-request" });
    const input = parsed.data;

    if (!input.confirm) return { ok: false, error: "not-confirmed" };

    const session = await getSession(req);
    if (!session) return { ok: false, error: "not-authenticated" };
    if (session.profile.role === "tutor") return { ok: true, role: "tutor" }; // idempotent
    if (session.profile.role !== "student") return { ok: false, error: "not-eligible" };

    // A role change is a privileged write on a public surface. Cheap ceiling.
    const rl = await checkRateLimit(`role:upgrade:${session.profile.id}`, 5, 60 * 60_000);
    if (!rl.ok) return { ok: false, error: "too-many-requests" };

    /* Age. Prefer what is already on file — a student cannot re-declare
       themselves older to get the role, exactly as verifyOtp only ever fills an
       UNKNOWN age. */
    let birthYear = session.profile.birthYear;
    if (birthYear == null) {
      birthYear = vBirthYear(input.birthYear);
      if (birthYear == null) return { ok: false, error: "age-required" };
      await db.update(profiles).set({ birthYear }).where(eq(profiles.id, session.profile.id));
    }
    if (isMinorBirthYear(birthYear)) return { ok: false, error: "minor-cannot-teach" };

    await db.update(profiles).set({ role: "tutor" }).where(eq(profiles.id, session.profile.id));

    /* The web sets the role-hint cookie from this. It is a forgeable UI hint that
       only decides which nav link renders, so it stays entirely on the web side —
       but the web needs to be TOLD the role changed, hence returning it. */
    return { ok: true, role: "tutor" };
  });

  /* ── POST /profile/student ──────────────────────────────────────────────── */
  app.post("/profile/student", async (req, reply) => {
    const parsed = studentProfileBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad-request" });

    // ONE validator, shared with the web's demo-mode branch — see profile-input.ts.
    const check = parseStudentProfile(parsed.data);
    if (!check.ok) return { ok: false, error: check.error };
    const v = check.value;

    const session = await getSession(req);
    if (!session) return { ok: false, error: "not-authenticated" };
    // Symmetric with createTutor's gate: the student screen writes a student profile.
    if (session.profile.role !== "student") return { ok: false, error: "not-a-student" };

    await db
      .update(profiles)
      .set({
        fullName: v.fullName,
        level: v.level,
        subjects: v.subjects.length ? v.subjects.join(",") : null,
        // Never null out a number already on file just because this submit omitted it.
        ...(v.phone ? { phone: v.phone } : {}),
      })
      .where(eq(profiles.id, session.profile.id));

    return { ok: true };
  });

  /* ── GET /profile/onboarding ────────────────────────────────────────────── */
  app.get("/profile/onboarding", async (req): Promise<OnboardingState | null> => {
    const session = await getSession(req);
    if (!session || session.profile.role !== "tutor") return null;

    const [mine] = await db
      .select({
        id: tutors.id,
        slug: tutors.slug,
        fullName: tutors.fullName,
        subject: tutors.subject,
        bio: tutors.bio,
        status: tutors.status,
      })
      .from(tutors)
      .where(eq(tutors.profileId, session.profile.id))
      .limit(1);

    /* The contact phone lives on the PROFILE, not the storefront, so it pre-fills
       even before a tutor has created their page. */
    const contactPhone = session.profile.phone ?? "";

    if (!mine) {
      return {
        hasStorefront: false,
        status: "draft",
        hasClass: false,
        hasSlug: false,
        draft: contactPhone
          ? { fullName: "", subject: "", bio: "", slug: "", phone: contactPhone }
          : null,
      };
    }

    // count(*) rather than fetching rows: the ladder only asks "any classes yet?".
    const [cnt] = await db
      .select({ n: raw<number>`count(*)::int` })
      .from(classes)
      .where(eq(classes.tutorId, mine.id));

    return {
      hasStorefront: true,
      status: mine.status,
      hasClass: (cnt?.n ?? 0) > 0,
      hasSlug: Boolean(mine.slug),
      draft: {
        fullName: mine.fullName ?? "",
        subject: mine.subject ?? "",
        bio: mine.bio ?? "",
        slug: mine.slug ?? "",
        phone: contactPhone,
      },
    };
  });
}
