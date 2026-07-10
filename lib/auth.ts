import "server-only";
import { cookies } from "next/headers";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { db, dbReady } from "./db";
import { profiles, sessions, otpCodes } from "./db/schema";

/* Custom phone-OTP + session auth on Postgres (no external auth dep).
   SMS delivery is pluggable: when no SMS provider is configured, requestOtp
   returns the code so the flow is completable in dev. Sessions are opaque
   tokens in an HTTP-only cookie, backed by the `sessions` table. */

export const SESSION_COOKIE = "9arini_session";
const SESSION_DAYS = 30;
const OTP_TTL_MIN = 5;
const MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60_000; // min gap between code sends to one phone
const SECRET = process.env.AUTH_SECRET ?? "dev-insecure-secret-change-me";

// Fail loudly (but don't crash) if the OTP-hashing secret is missing in prod.
if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
  console.error(
    "[9arini] AUTH_SECRET is not set in production. Set it to a long random value — " +
      "OTP verification depends on it and the default is insecure.",
  );
}

export function normalizePhone(raw: string): string {
  let p = (raw || "").replace(/[^\d+]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (!p.startsWith("+")) p = "+216" + p.replace(/^0+/, ""); // default Tunisia
  return p;
}
export function isValidPhone(p: string): boolean {
  const digits = p.replace(/\D/g, "").length;
  return digits >= 8 && digits <= 15; // E.164 upper bound
}
function hashCode(phone: string, code: string): string {
  return createHash("sha256").update(`${phone}:${code}:${SECRET}`).digest("hex");
}
function safeEq(a: string, b: string): boolean {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Seconds the caller must wait before another code can be sent to this phone (0 = ok now).
    Derived from the existing row's age (created = expiresAt − TTL), so no schema change. */
export async function otpCooldownRemaining(phone: string): Promise<number> {
  const [row] = await db.select().from(otpCodes).where(eq(otpCodes.phone, phone)).limit(1);
  if (!row) return 0;
  const createdAtMs = new Date(row.expiresAt).getTime() - OTP_TTL_MIN * 60_000;
  const remainingMs = OTP_RESEND_COOLDOWN_MS - (Date.now() - createdAtMs);
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

/** Generate + store a one-time code for a phone. Returns the plaintext code (caller sends it). */
export async function createOtp(phone: string): Promise<string> {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000);
  await db.delete(otpCodes).where(eq(otpCodes.phone, phone));
  await db.insert(otpCodes).values({ phone, codeHash: hashCode(phone, code), expiresAt });
  return code;
}

export async function verifyOtpCode(phone: string, code: string): Promise<boolean> {
  const [row] = await db.select().from(otpCodes).where(eq(otpCodes.phone, phone)).limit(1);
  if (!row) return false;
  if (new Date(row.expiresAt) < new Date()) return false;
  if ((row.attempts ?? 0) >= MAX_ATTEMPTS) return false;
  const ok = safeEq(row.codeHash, hashCode(phone, code));
  if (!ok) {
    await db.update(otpCodes).set({ attempts: (row.attempts ?? 0) + 1 }).where(eq(otpCodes.id, row.id));
    return false;
  }
  await db.delete(otpCodes).where(eq(otpCodes.phone, phone));
  return true;
}

export async function createSession(profileId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ token, profileId, expiresAt });
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** Read-only — safe in server components. Returns the signed-in profile or null. */
export async function getSession() {
  if (!dbReady) return null;
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ s: sessions, p: profiles })
    .from(sessions)
    .innerJoin(profiles, eq(sessions.profileId, profiles.id))
    .where(eq(sessions.token, token))
    .limit(1);
  if (!row) return null;
  if (new Date(row.s.expiresAt) < new Date()) {
    await db.delete(sessions).where(eq(sessions.token, token));
    return null;
  }
  return { profile: row.p };
}

export async function destroySession(): Promise<void> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token && dbReady) await db.delete(sessions).where(eq(sessions.token, token));
  cookies().delete(SESSION_COOKIE);
}

/** Demo mode (no DB): set/clear a non-DB cookie so the route guard + flow still work. */
export function setDemoCookie(): void {
  cookies().set(SESSION_COOKIE, "demo", { httpOnly: true, sameSite: "lax", path: "/" });
}
