/* Row factories. Every row is namespaced with RUN_ID so teardown deletes exactly
   what this run created and nothing else.

   NO GLOBAL TRUNCATE. This database holds real development data (14 profiles, 7
   tutors, 6 verification docs) and tools/ui-audit/routes.mjs depends on the real
   slug "yassine-math". Truncating would break `npm run ui:audit`. */
import { randomBytes, randomUUID } from "node:crypto";
import { sql } from "./db";
import { RUN_ID } from "./env";

/* Uniqueness must not depend on a counter. globalSetup runs in its OWN process,
   so process.env.E2E_RUN_ID does not reach the workers, and a per-process counter
   restarts at 1 in every worker and on every rerun -- which collided on
   tutors.slug (UNIQUE). Random suffix, "e2e-" prefix preserved so teardown's
   LIKE pattern still matches exactly what the suite created. */
const tag = () => `e2e-${RUN_ID}-${randomBytes(5).toString("hex")}`;

/** RFC 2606 .invalid can never route mail — a typo here must not send a login
    code to a stranger. */
export const email = (s: string) => `${s}@tnajem.invalid`;

export type SeededProfile = { id: string; email: string; role: string };

export async function seedProfile(opts: {
  role: "student" | "tutor" | "guardian";
  birthYear?: number | null;
  fullName?: string;
  phone?: string | null;
}): Promise<SeededProfile> {
  const t = tag();
  const addr = email(t);
  const [row] = await sql`
    insert into profiles (id, email, phone, role, locale, full_name, birth_year)
    values (${randomUUID()}, ${addr}, ${opts.phone ?? null}, ${opts.role}, 'fr',
            ${opts.fullName ?? `E2E ${t}`},
            ${opts.birthYear === undefined ? 1990 : opts.birthYear})
    returning id, email, role`;
  return row as SeededProfile;
}

export async function seedTutor(opts: {
  profileId?: string;
  status?: "draft" | "pending" | "verified" | "rejected";
  fullName?: string;
}): Promise<{ id: string; slug: string; profileId: string | null }> {
  const t = tag();
  const [row] = await sql`
    insert into tutors (id, profile_id, slug, full_name, subject, level, bio, status, verified)
    values (${randomUUID()}, ${opts.profileId ?? null}, ${t},
            ${opts.fullName ?? `E2E Tutor ${t}`}, 'Mathématiques', 'Bac',
            ${"Seeded by the E2E suite."}, ${opts.status ?? "verified"},
            ${(opts.status ?? "verified") === "verified"})
    returning id, slug, profile_id as "profileId"`;
  return row as { id: string; slug: string; profileId: string | null };
}

export async function seedClass(opts: {
  tutorId: string;
  seats?: number;
  seatsTaken?: number;
  isFreeFirst?: boolean;
  priceTnd?: number;
  hoursFromNow?: number;
}): Promise<{ id: string; title: string }> {
  const t = tag();
  const when = new Date(Date.now() + (opts.hoursFromNow ?? 72) * 3600_000);
  const [row] = await sql`
    insert into classes (id, tutor_id, title, description, scheduled_at, duration_min,
                         price_tnd, seats, seats_taken, is_free_first, status)
    values (${randomUUID()}, ${opts.tutorId}, ${`E2E Class ${t}`},
            ${"Seeded by the E2E suite."}, ${when}, 90,
            ${String(opts.priceTnd ?? 40)}, ${opts.seats ?? 20},
            ${opts.seatsTaken ?? 0}, ${opts.isFreeFirst ?? true}, 'scheduled')
    returning id, title`;
  return row as { id: string; title: string };
}

export async function seedBooking(opts: {
  classId: string; studentId: string; isFree?: boolean;
  status?: "reserved" | "paid" | "attended" | "cancelled";
}): Promise<{ id: string }> {
  const [row] = await sql`
    insert into bookings (id, class_id, student_id, is_free, status)
    values (${randomUUID()}, ${opts.classId}, ${opts.studentId},
            ${opts.isFree ?? true}, ${opts.status ?? "reserved"})
    returning id`;
  return row as { id: string };
}

export async function seedConsent(minorId: string): Promise<void> {
  await sql`insert into consents (id, minor_id, guardian_name, guardian_phone, consent_text)
            values (${randomUUID()}, ${minorId}, 'E2E Guardian', '+21620000000',
                    'Seeded by the E2E suite.')`;
}

/** Delete everything this run (or a named previous run) created. */
export async function purgeRun(runId: string): Promise<void> {
  const like = `e2e-${runId}-%`;
  // Order matters only where there is no ON DELETE CASCADE.
  await sql`delete from bookings  where class_id in (
              select c.id from classes c join tutors t on t.id = c.tutor_id where t.slug like ${like})`;
  await sql`delete from classes   where tutor_id in (select id from tutors where slug like ${like})`;
  await sql`delete from tutors    where slug like ${like}`;
  await sql`delete from profiles  where email like ${`e2e-${runId}-%@tnajem.invalid`}`;
}

/** Delete rows from ALL previous e2e runs. Used by globalSetup. */
export async function purgeAllRuns(): Promise<void> {
  await sql`delete from bookings where class_id in (
              select c.id from classes c join tutors t on t.id = c.tutor_id where t.slug like 'e2e-%')`;
  await sql`delete from classes  where tutor_id in (select id from tutors where slug like 'e2e-%')`;
  await sql`delete from tutors   where slug like 'e2e-%'`;
  await sql`delete from profiles where email like 'e2e-%@tnajem.invalid'`;
}

/* The admin identity. Fixed (not run-namespaced) because it must match the
   ADMIN_EMAILS value pinned in playwright.config.ts's webServer env. Teardown's
   `e2e-%@tnajem.invalid` pattern still matches it. */
export const ADMIN_EMAIL = "e2e-admin@tnajem.invalid";

export async function seedAdmin(): Promise<{ id: string }> {
  const [existing] = await sql<{ id: string }[]>`
    select id from profiles where email = ${ADMIN_EMAIL}`;
  if (existing) return existing;
  const [row] = await sql<{ id: string }[]>`
    insert into profiles (id, email, role, locale, full_name, birth_year)
    values (${randomUUID()}, ${ADMIN_EMAIL}, 'tutor', 'fr', 'E2E Admin', 1990)
    returning id`;
  return row;
}

/** A verification doc row plus the real file on disk under STORAGE_DIR. */
export async function seedVerificationDoc(tutorId: string): Promise<{ id: string; fileName: string }> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { STORAGE_DIR } = await import("./env");
  // A 1x1 PNG — must pass the doc route's SAFE_MIME check.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );
  const fileName = "id_front-e2e.png";
  const dir = join(STORAGE_DIR, "verification", tutorId);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, fileName), png);

  const [row] = await sql<{ id: string }[]>`
    insert into verification_docs (id, tutor_id, kind, file_name, storage_path, mime, size_bytes)
    values (${randomUUID()}, ${tutorId}, 'id_front', ${fileName},
            ${["verification", tutorId, fileName].join("/")}, 'image/png', ${png.length})
    returning id`;
  return { id: row.id, fileName };
}
