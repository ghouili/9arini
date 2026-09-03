import "server-only";

import {
  getSession,
  otpChannel,
  normalizeEmail,
  normalizePhone,
  isValidEmail,
  isValidPhone,
} from "./auth";

/* THE admin allowlist. One implementation, imported by every admin surface.

   There used to be three, and they disagreed:

     1. app/actions.ts::adminAllowlist()  — channel-aware, correct
     2. app/api/admin/doc/[id]/route.ts::adminPhones() — PHONE-ONLY
     3. app/actions.ts::adminEmails()     — no validation at all

   (2) was the live bug. Login moved to email OTP (lib/auth.ts::otpChannel defaults
   to "email"), so an admin who signed up by email has profile.phone === null — and
   a phone-only check returns false for every one of them. The result: an admin
   could open /admin/verifications and see the queue, then get 403 on every single
   ID scan they tried to open. The queue was unusable. It failed CLOSED, so it was
   never a security hole — just a door that was welded shut.

   Three fail-closed properties are preserved verbatim from the phone version, and
   must survive any future edit:

     a. Empty entries are dropped BEFORE normalising. normalizePhone("") returns
        "+216" (it prefixes the country code to an empty string), so a trailing
        comma in ADMIN_PHONES once produced the list ["+216"] — and since a profile
        with a null phone also normalised to "+216", every null-phone user became
        an admin and could stream any tutor's national ID card.
     b. An empty allowlist refuses EVERYONE. Never "no list means allow all".
     c. An entry that fails validation is discarded, not trusted. */
function adminAllowlist(): string[] {
  const email = otpChannel() === "email";
  const raw = email ? process.env.ADMIN_EMAILS : process.env.ADMIN_PHONES;
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0) // ← (a): never normalize an empty string
    .map((s) => (email ? normalizeEmail(s) : normalizePhone(s)))
    .filter((v) => (email ? isValidEmail(v) : isValidPhone(v))); // ← (c)
}

/** The admin's session, or null. Fails closed on every path. */
export async function requireAdmin() {
  const email = otpChannel() === "email";
  const allow = adminAllowlist();
  if (allow.length === 0) {
    console.error(
      `[Tnajem] ${email ? "ADMIN_EMAILS" : "ADMIN_PHONES"} is not configured — refusing all admin access.`,
    );
    return null; // ← (b): fail closed, never open
  }
  const session = await getSession();
  if (!session) return null;

  // A profile with no identity of the ACTIVE kind can never be an admin.
  const raw = ((email ? session.profile.email : session.profile.phone) ?? "").trim();
  if (!raw) return null;

  const normalized = email ? normalizeEmail(raw) : normalizePhone(raw);
  if (!(email ? isValidEmail(normalized) : isValidPhone(normalized))) return null;
  return allow.includes(normalized) ? session : null;
}

/** Boolean form, for route handlers that only need the verdict. */
export async function isAdmin(): Promise<boolean> {
  return (await requireAdmin()) !== null;
}

/* Who to EMAIL when something needs review. Distinct from the allowlist on
   purpose: you notify admins by address even when the login channel is SMS, so
   this always reads ADMIN_EMAILS. It gets the same trim/drop-empty/validate
   treatment, so a trailing comma can no longer produce a junk recipient. */
export function adminNotifyEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => normalizeEmail(s))
    .filter((e) => isValidEmail(e));
}
