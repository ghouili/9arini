import { normalizeEmail, normalizePhone, isValidEmail, isValidPhone } from "./validation";

/* THE admin allowlist parser. Pure — no session, no cookies, no environment
   decisions — so Fastify, the Next app and a plain unit test can all use it.

   There were once three implementations and they disagreed:
     1. app/actions.ts::adminAllowlist()             channel-aware, correct
     2. app/api/admin/doc/[id]/route.ts::adminPhones()  PHONE-ONLY
     3. app/actions.ts::adminEmails()                no validation at all

   (2) was the live bug. Login is email OTP (otpChannel() defaults to "email"), so
   an admin who signed up by e-mail has profile.phone === null and a phone-only
   check returned false for every one of them: they could open the verification
   queue and then get 403 on every ID scan in it. It failed CLOSED, so never a
   hole — a welded-shut door.

   THREE FAIL-CLOSED PROPERTIES. Any future edit must preserve all three.

     a. Empty entries are dropped BEFORE normalising. normalizePhone("") returns
        "+216" (it prefixes the country code to an empty string), so a trailing
        comma in ADMIN_PHONES once produced the list ["+216"] — and a profile with
        a null phone also normalised to "+216", making every null-phone user an
        admin with read access to every national ID card in the system.
     b. An empty allowlist refuses EVERYONE. Never "no list means allow all".
        This parser returns []; the CALLER decides policy and logs.
     c. An entry that fails validation is discarded, not trusted. */

export type AdminChannel = "email" | "sms";

/** AUTHORIZATION identities, following the login channel. */
export function adminAuthIdentities(env: NodeJS.ProcessEnv, channel: AdminChannel): string[] {
  const email = channel === "email";
  const raw = email ? env.ADMIN_EMAILS : env.ADMIN_PHONES;
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0) // ← (a): never normalise an empty string
    .map((s) => (email ? normalizeEmail(s) : normalizePhone(s)))
    .filter((v) => (email ? isValidEmail(v) : isValidPhone(v))); // ← (c)
}

/** Does this session identity appear on the allowlist? Fails closed on every path. */
export function isAllowlistedAdmin(
  identity: { email: string | null; phone: string | null },
  allow: string[],
  channel: AdminChannel,
): boolean {
  if (allow.length === 0) return false; // ← (b)
  const email = channel === "email";

  // A profile with no identity of the ACTIVE kind can never be an admin.
  const raw = ((email ? identity.email : identity.phone) ?? "").trim();
  if (!raw) return false;

  const normalized = email ? normalizeEmail(raw) : normalizePhone(raw);
  if (!(email ? isValidEmail(normalized) : isValidPhone(normalized))) return false;
  return allow.includes(normalized);
}

/* Who to EMAIL when something needs review. Deliberately NOT merged into the
   authorization function: under OTP_CHANNEL=sms, adminAuthIdentities returns
   PHONE NUMBERS, and you cannot email a phone number. Merging them yields one of
   two bugs — mailing phone numbers under sms, or authorising on ADMIN_EMAILS
   while login is by phone, which is the original bug in a mirror.

   It gains the trim/drop-empties/validate discipline the old adminEmails() lacked:
   a strict strengthening of the notification path with no effect on authorization. */
export function adminNotifyEmails(env: NodeJS.ProcessEnv): string[] {
  return (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => normalizeEmail(s))
    .filter((e) => isValidEmail(e));
}
