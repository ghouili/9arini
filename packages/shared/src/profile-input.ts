import { vText, vOptionalPhone, normalizePhone, isValidPhone } from "./validation";
import { STUDENT_LEVELS, type StudentLevel } from "./types";

/* Input normalisation for the student profile.

   Extracted so there is ONE implementation, used by both the apps/api handler and
   the web app's demo-mode branch. saveStudentProfile validates BEFORE its
   `!dbReady` short-circuit, so the audit harness can exercise the error states
   with no database; moving validation to the API without this would have silently
   changed that path to accept anything.

   Two implementations of a validation rule that nothing forces to agree is
   exactly the shape of the admin-allowlist bug — one parser tested, a different
   one running. Not repeating it. */

export type StudentProfileInput = {
  fullName: string;
  level?: string | null;
  subjects?: string[];
  phone?: string | null;
};

export type StudentProfileParsed = {
  fullName: string;
  level: StudentLevel | null;
  subjects: string[];
  /** Normalised E.164-ish, or null when absent. */
  phone: string | null;
};

export type ParseResult =
  | { ok: true; value: StudentProfileParsed }
  | { ok: false; error: string };

export function parseStudentProfile(input: StudentProfileInput): ParseResult {
  const name = vText(input.fullName, { field: "name", max: 80, min: 2 });
  if (!name.ok) return { ok: false, error: name.error };

  /* Optional CONTACT phone — not a credential. Since email became the login
     identity this is where a student's number is collected, and it is what keeps
     the tutor's call button and notify()'s SMS side-channel meaningful. Absent is
     fine; half-typed is not. */
  const phone = vOptionalPhone(input.phone);
  if (!phone.ok) return { ok: false, error: phone.error };
  const normalizedPhone = phone.value ? normalizePhone(phone.value) : null;
  if (normalizedPhone && !isValidPhone(normalizedPhone)) {
    return { ok: false, error: "invalid-phone" };
  }

  /* Closed set — written from a public action and read back into UI copy. Absent
     is fine; present-but-unrecognised is a tampered payload, so it fails. */
  let level: StudentLevel | null = null;
  if (input.level != null && input.level !== "") {
    if (!(STUDENT_LEVELS as readonly string[]).includes(input.level)) {
      return { ok: false, error: "invalid-level" };
    }
    level = input.level as StudentLevel;
  }

  /* Free text from the client, stored comma-joined (the tutors.languages
     convention). Bound the count AND each entry, dedupe, and strip commas so one
     entry can never smuggle in extra ones when the string is split on read. */
  const subjects = Array.isArray(input.subjects)
    ? Array.from(
        new Set(
          input.subjects
            .map((x) => (typeof x === "string" ? x.replace(/,/g, " ").trim().slice(0, 40) : ""))
            .filter(Boolean),
        ),
      ).slice(0, 8)
    : [];

  return { ok: true, value: { fullName: name.value, level, subjects, phone: normalizedPhone } };
}
