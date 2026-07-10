"use server";
import { eq, and, sql } from "drizzle-orm";
import { db, dbReady } from "@/lib/db";
import { profiles, tutors, classes, packs, bookings, consents, verificationDocs } from "@/lib/db/schema";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  normalizePhone, isValidPhone, createOtp, verifyOtpCode, otpCooldownRemaining,
  createSession, destroySession, getSession, setDemoCookie,
} from "@/lib/auth";
import { demoClasses } from "@/lib/demo";
import { smsEnabled, sendSms } from "@/lib/sms";
import type { DashboardData, StudentDashboard, ClassItem, TutorVerification, PendingTutor } from "@/lib/types";

type DocKind = "id_front" | "id_back" | "selfie" | "diploma" | "certificate" | "role_proof" | "other";

const DASH_MONTHS = ["JANV", "FÉVR", "MARS", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEPT", "OCT", "NOV", "DÉC"];

/* Server actions = the write/auth path. Callable from client components.
   In demo mode (no DATABASE_URL) they degrade gracefully so the UI still works. */

export type ActionResult = { ok: boolean; demo?: boolean; slug?: string; error?: string };

/* ---------- Auth (phone OTP) ---------- */
export async function requestOtp(input: { phone: string }):
  Promise<{ ok: boolean; devCode?: string; demo?: boolean; error?: string; retryAfter?: number }> {
  if (!dbReady) return { ok: true, demo: true, devCode: "000000" };
  const phone = normalizePhone(input.phone);
  if (!isValidPhone(phone)) return { ok: false, error: "invalid-phone" };

  // Anti-abuse: throttle repeat sends to the same number (SMS cost + spam).
  const wait = await otpCooldownRemaining(phone);
  if (wait > 0) return { ok: false, error: "too-soon", retryAfter: wait };

  const code = await createOtp(phone);
  if (smsEnabled()) {
    const sent = await sendSms(phone, `9arini : ton code de connexion est ${code} (valable 5 min).`);
    // Production posture: the code is NEVER returned to the client. If SMS
    // delivery fails, surface an error so the user can retry — don't leak it.
    return sent ? { ok: true } : { ok: false, error: "sms-failed" };
  }
  // No SMS provider configured → dev mode only: surface the code on-screen.
  return { ok: true, devCode: code };
}

export async function verifyOtp(input: { phone: string; code: string; role: "tutor" | "student"; locale?: string }):
  Promise<{ ok: boolean; role?: string; needsConsent?: boolean; error?: string }> {
  if (!dbReady) {
    setDemoCookie();
    return { ok: true, role: input.role, needsConsent: input.role === "student" };
  }
  const phone = normalizePhone(input.phone);
  const valid = await verifyOtpCode(phone, (input.code || "").trim());
  if (!valid) return { ok: false, error: "invalid-code" };

  let [profile] = await db.select().from(profiles).where(eq(profiles.phone, phone)).limit(1);
  if (!profile) {
    [profile] = await db.insert(profiles)
      .values({ phone, role: input.role, locale: input.locale ?? "fr" }).returning();
  }
  await createSession(profile.id);

  let needsConsent = false;
  if (profile.role === "student") {
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
  await db.insert(consents).values({
    minorId: session.profile.id,
    guardianName: input.guardianName,
    guardianPhone: normalizePhone(input.guardianPhone),
    consentText: "Consentement du parent/tuteur pour un compte de moins de 18 ans (INPDP).",
  });
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
  if (!dbReady) return { ok: true, demo: true, slug: input.slug };
  const session = await getSession();
  if (!session) return { ok: false, error: "not-authenticated" };
  const uid = session.profile.id;

  const [bySlug] = await db.select().from(tutors).where(eq(tutors.slug, input.slug)).limit(1);
  if (bySlug && bySlug.profileId !== uid) return { ok: false, error: "slug-taken" };

  await db.update(profiles).set({ role: "tutor", fullName: input.name }).where(eq(profiles.id, uid));

  const [mine] = await db.select().from(tutors).where(eq(tutors.profileId, uid)).limit(1);
  if (mine) {
    await db.update(tutors)
      .set({ slug: input.slug, fullName: input.name, subject: input.subject, bio: input.bio })
      .where(eq(tutors.id, mine.id));
  } else {
    await db.insert(tutors)
      .values({ profileId: uid, slug: input.slug, fullName: input.name, subject: input.subject, bio: input.bio });
  }
  return { ok: true, slug: input.slug };
}

export async function createClass(input: {
  title: string; description?: string; scheduledAt: string;
  durationMin: number; priceTnd: number; seats: number; isFreeFirst: boolean;
  meetUrl?: string; whiteboardUrl?: string; quizUrl?: string;
}): Promise<ActionResult> {
  if (!dbReady) return { ok: true, demo: true };
  const session = await getSession();
  if (!session) return { ok: false, error: "not-authenticated" };
  const [mine] = await db.select().from(tutors).where(eq(tutors.profileId, session.profile.id)).limit(1);
  if (!mine) return { ok: false, error: "no-storefront" };
  await db.insert(classes).values({
    tutorId: mine.id, title: input.title, description: input.description ?? null,
    scheduledAt: new Date(input.scheduledAt), durationMin: input.durationMin,
    priceTnd: String(input.priceTnd), seats: input.seats, isFreeFirst: input.isFreeFirst,
    meetUrl: input.meetUrl || null, whiteboardUrl: input.whiteboardUrl || null, quizUrl: input.quizUrl || null,
  });
  return { ok: true };
}

export async function createPack(input: { title: string; meta?: string; priceTnd: number }): Promise<ActionResult> {
  if (!dbReady) return { ok: true, demo: true };
  const session = await getSession();
  if (!session) return { ok: false, error: "not-authenticated" };
  const [mine] = await db.select().from(tutors).where(eq(tutors.profileId, session.profile.id)).limit(1);
  if (!mine) return { ok: false, error: "no-storefront" };
  await db.insert(packs).values({
    tutorId: mine.id, title: input.title, description: input.meta || null, priceTnd: String(input.priceTnd),
  });
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
      balance_tnd: 0, students: 0, sessions: 0, rating: 0, status: "draft", classes: [], packs: [],
    };
  }

  const rows = await db.select().from(classes).where(eq(classes.tutorId, mine.id));
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

  const packRows = await db.select().from(packs).where(eq(packs.tutorId, mine.id));
  const mappedPacks = packRows.map((p) => ({
    id: p.id, title: p.title, meta: p.description ?? "", price_tnd: Number(p.priceTnd),
  }));

  return {
    name: mine.fullName ?? session.profile.fullName,
    slug: mine.slug,
    has_storefront: true,
    balance_tnd: 0, // payments not wired yet → real earnings stay 0 until legal sign-off
    students: mine.studentsCount ?? 0,
    sessions: rows.length,
    rating: Number(mine.rating ?? 0),
    status: mine.status,
    classes: mapped,
    packs: mappedPacks,
  };
}

/* ---------- Booking (student reserves a seat — free first session) ----------
   Payment-free for the pilot: reserves a seat and decrements availability.
   Idempotent — re-booking the same class returns { already: true }. */
export async function reserveSeat(input: { classId: string }):
  Promise<{ ok: boolean; demo?: boolean; already?: boolean; error?: string }> {
  if (!dbReady) return { ok: true, demo: true };
  const session = await getSession();
  if (!session) return { ok: false, error: "not-authenticated" };
  const uid = session.profile.id;

  const [cls] = await db.select().from(classes).where(eq(classes.id, input.classId)).limit(1);
  if (!cls) return { ok: false, error: "not-found" };
  if (cls.status === "cancelled" || cls.status === "done") return { ok: false, error: "unavailable" };

  // Already booked? → idempotent success (unique class+student).
  const [existing] = await db.select().from(bookings)
    .where(and(eq(bookings.classId, input.classId), eq(bookings.studentId, uid))).limit(1);
  if (existing) return { ok: true, already: true };

  const seatsLeft = (cls.seats ?? 0) - (cls.seatsTaken ?? 0);
  if (seatsLeft <= 0) return { ok: false, error: "full" };

  try {
    await db.insert(bookings).values({
      classId: input.classId, studentId: uid,
      isFree: Boolean(cls.isFreeFirst), status: "reserved",
    });
  } catch {
    return { ok: true, already: true }; // unique(class,student) race → treat as booked
  }
  await db.update(classes)
    .set({ seatsTaken: sql`${classes.seatsTaken} + 1` })
    .where(eq(classes.id, input.classId));
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
    .where(eq(bookings.studentId, uid));

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
      meetUrl: r.meetUrl ?? undefined,
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
  const [c] = await db.select().from(classes).where(eq(classes.id, id)).limit(1);
  if (!c) return null;
  const [tut] = await db.select().from(tutors).where(eq(tutors.id, c.tutorId)).limit(1);
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
    meet_url: c.meetUrl ?? undefined,
    whiteboard_url: c.whiteboardUrl ?? undefined,
    quiz_url: c.quizUrl ?? undefined,
    replay_url: c.replayUrl ?? undefined,
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
const sanitizeName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60) || "file";

function adminPhones(): string[] {
  return (process.env.ADMIN_PHONES ?? "").split(",").map((s) => normalizePhone(s.trim())).filter(Boolean);
}
async function requireAdmin() {
  const session = await getSession();
  if (!session) return null;
  return adminPhones().includes(normalizePhone(session.profile.phone ?? "")) ? session : null;
}

export async function submitVerification(formData: FormData):
  Promise<{ ok: boolean; demo?: boolean; error?: string }> {
  if (!dbReady) return { ok: true, demo: true };
  const session = await getSession();
  if (!session) return { ok: false, error: "not-authenticated" };
  const [mine] = await db.select().from(tutors).where(eq(tutors.profileId, session.profile.id)).limit(1);
  if (!mine) return { ok: false, error: "no-storefront" };

  // Collect + validate files (idFront required).
  const incoming: { kind: DocKind; file: File }[] = [];
  for (const d of DOC_FIELDS) {
    const f = formData.get(d.field);
    if (f instanceof File && f.size > 0) {
      if (f.size > MAX_DOC_BYTES) return { ok: false, error: "file-too-large" };
      if (!OK_MIME.test(f.type)) return { ok: false, error: "bad-file-type" };
      incoming.push({ kind: d.kind, file: f });
    } else if (d.required) {
      return { ok: false, error: "id-required" };
    }
  }

  // Persist files to local storage + record metadata.
  const dir = join(STORAGE_ROOT, mine.id);
  await mkdir(dir, { recursive: true });
  for (const { kind, file } of incoming) {
    const safe = `${kind}-${Date.now()}-${sanitizeName(file.name)}`;
    await writeFile(join(dir, safe), Buffer.from(await file.arrayBuffer()));
    await db.insert(verificationDocs).values({
      tutorId: mine.id, kind, fileName: file.name,
      storagePath: join("verification", mine.id, safe), mime: file.type, sizeBytes: file.size,
    });
  }

  const str = (k: string) => { const v = formData.get(k); return typeof v === "string" && v.trim() ? v.trim() : null; };
  const yearsRaw = formData.get("experienceYears");
  const years = typeof yearsRaw === "string" && yearsRaw.trim()
    ? Math.max(0, Math.min(60, parseInt(yearsRaw, 10) || 0)) : null;

  await db.update(tutors).set({
    status: "pending", submittedAt: new Date(), reviewNote: null,
    experienceYears: years,
    institution: str("institution"), languages: str("languages"), pitch: str("pitch"),
    linkedinUrl: str("linkedinUrl"), instagramUrl: str("instagramUrl"), tiktokUrl: str("tiktokUrl"),
    youtubeUrl: str("youtubeUrl"), facebookUrl: str("facebookUrl"), websiteUrl: str("websiteUrl"),
    introVideoUrl: str("introVideoUrl"),
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
  const rows = await db.select().from(tutors).where(eq(tutors.status, "pending"));
  const items: PendingTutor[] = [];
  for (const t of rows) {
    const docs = await db.select().from(verificationDocs).where(eq(verificationDocs.tutorId, t.id));
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
  await db.update(tutors)
    .set({ status: "verified", verified: true, reviewedAt: new Date(), reviewNote: null })
    .where(eq(tutors.id, input.tutorId));
  return { ok: true };
}

export async function rejectTutor(input: { tutorId: string; note?: string }): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: "forbidden" };
  await db.update(tutors)
    .set({ status: "rejected", verified: false, reviewedAt: new Date(), reviewNote: input.note?.trim() || null })
    .where(eq(tutors.id, input.tutorId));
  return { ok: true };
}

/* Verified tutors for Explore (real mode). Demo mode → null (client keeps its static list). */
export async function getExploreTutors():
  Promise<null | { slug: string; full_name: string; subject: string; rating: number; students_count: number }[]> {
  if (!dbReady) return null;
  const rows = await db.select().from(tutors).where(eq(tutors.status, "verified"));
  return rows.map((t) => ({
    slug: t.slug, full_name: t.fullName, subject: t.subject,
    rating: Number(t.rating ?? 0), students_count: t.studentsCount ?? 0,
  }));
}
