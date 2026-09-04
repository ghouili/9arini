import type { FastifyRequest } from "fastify";
import { adminAuthIdentities, isAllowlistedAdmin } from "@tnajem/shared";
import { otpChannel } from "@tnajem/shared/auth-core";
import { getSession, type Session } from "./session";

/* The API's admin gate.

   The PARSING and the ALLOWLIST DECISION come from @tnajem/shared/admin — the same
   functions apps/web uses and apps/api/test/admin.test.ts covers. Only the session
   lookup differs between the two processes, and that is all that lives here.

   That split is deliberate and was learned the hard way: this gate briefly had two
   implementations, and the tested one was not the one that ran. Do not inline the
   allowlist logic here, however small it looks. */

export async function requireAdmin(req: FastifyRequest): Promise<Session | null> {
  const channel = otpChannel();
  const allow = adminAuthIdentities(process.env, channel);

  if (allow.length === 0) {
    req.log.error(
      `${channel === "email" ? "ADMIN_EMAILS" : "ADMIN_PHONES"} is not configured — ` +
        "refusing all admin access.",
    );
    return null; // fail closed, never open
  }

  const session = await getSession(req);
  if (!session) return null;

  return isAllowlistedAdmin(session.profile, allow, channel) ? session : null;
}
