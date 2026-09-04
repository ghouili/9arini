import "server-only";

import { getSession, otpChannel } from "./auth";
import {
  adminAuthIdentities,
  isAllowlistedAdmin,
  adminNotifyEmails as adminNotifyEmailsFromEnv,
} from "@tnajem/shared";

/* The web app's admin gate.

   The PARSING and the ALLOWLIST DECISION live in @tnajem/shared/admin — one
   implementation, shared with apps/api and covered by apps/api/test/admin.test.ts.
   This file holds only the part that cannot be shared: reading the session, which
   needs next/headers.

   That split is the point. This module briefly carried its own copy of the parser
   (Step 0 consolidated three implementations into it; Step 2 then created the
   shared one and left this behind), which meant the unit tests were guarding code
   the web app never executed. Two implementations of a security control that
   nothing forces to agree is exactly the shape of the original bug.

   The fail-closed properties are documented in @tnajem/shared/admin — read them
   there before changing anything here. */

/** The admin's session, or null. Fails closed on every path. */
export async function requireAdmin() {
  const channel = otpChannel();
  const allow = adminAuthIdentities(process.env, channel);

  if (allow.length === 0) {
    console.error(
      `[Tnajem] ${channel === "email" ? "ADMIN_EMAILS" : "ADMIN_PHONES"} is not configured — ` +
        "refusing all admin access.",
    );
    return null; // fail closed, never open
  }

  const session = await getSession();
  if (!session) return null;

  return isAllowlistedAdmin(session.profile, allow, channel) ? session : null;
}

/** Boolean form, for route handlers that only need the verdict. */
export async function isAdmin(): Promise<boolean> {
  return (await requireAdmin()) !== null;
}

/* Who to EMAIL about a new submission. Distinct from the allowlist on purpose —
   see the note in @tnajem/shared/admin. Wrapped so the call site keeps its
   zero-argument shape; the shared function takes env explicitly because a plain
   unit test must be able to hand it one. */
export function adminNotifyEmails(): string[] {
  return adminNotifyEmailsFromEnv(process.env);
}
