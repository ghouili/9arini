import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { purgeExpiredVerificationDocs, purgeExpiredAuthRows } from "@tnajem/db";
import { db } from "../db";
import { purgeDeletedAccounts } from "./moderation";

/* The retention purge, moved from apps/web/app/api/cron/purge.

   It belongs here now: apps/web owns no database, and this job deletes rows and
   unlinks identity documents. /privacy promises those documents are deleted at
   most 90 days after the verification decision, so this endpoint is the thing
   that keeps a published legal commitment — it is not a maintenance nicety. */

/** Constant-time bearer check. A length pre-check first, because timingSafeEqual
    throws on a length mismatch — and comparing with === would leak the token
    prefix through response timing. */
function authorised(header: string | undefined, secret: string): boolean {
  const provided = (header ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!provided) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(secret, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function cronRoutes(app: FastifyInstance): Promise<void> {
  const handle = async (
    req: FastifyRequest<{ Querystring: { dryRun?: string } }>,
    reply: FastifyReply,
  ) => {
    const secret = process.env.CRON_SECRET?.trim();
    /* 503, not 401, when it is UNCONFIGURED: an unset secret is a broken deploy,
       not a rejected caller, and the two need to look different in a log. It also
       refuses to run rather than running unauthenticated. */
    if (!secret) {
      req.log.error("CRON_SECRET is not set — refusing to run the retention purge");
      return reply.code(503).send({ ok: false, error: "not-configured" });
    }

    const auth = req.headers.authorization;
    if (!authorised(auth, secret)) return reply.code(401).send({ ok: false, error: "unauthorised" });

    const dryRun = req.query?.dryRun === "1";

    /* The two jobs run INDEPENDENTLY: a failure purging documents must not stop
       expired sessions and OTP codes being swept, and vice versa. */
    const docs = await purgeExpiredVerificationDocs(db, { dryRun });
    const authRows = await purgeExpiredAuthRows(db, { dryRun });
    /* Step 15. Third INDEPENDENT job, same reason as the first two: an account
       whose 30-day grace has expired must be erased even if the document purge
       fails, and vice versa. */
    const accounts = await purgeDeletedAccounts(db, { dryRun });

    /* COUNTS ONLY in the response body. docs.removed[] carries tutor and document
       ids; that stays in the server log and never crosses the wire — this
       endpoint is reachable by anyone holding the bearer token, and the ids are a
       map of who uploaded what. */
    const body = {
      ok: docs.errors.length === 0,
      dryRun,
      documents: {
        tutorsAffected: docs.tutorsAffected,
        docsDeleted: docs.docsDeleted,
        filesDeleted: docs.filesDeleted,
        filesMissing: docs.filesMissing,
        errors: docs.errors.length,
      },
      auth: authRows,
      accounts,
    };
    return reply.code(docs.errors.length ? 500 : 200).send(body);
  };

  // GET and POST both: cron runners differ, and the job is idempotent either way.
  app.get<{ Querystring: { dryRun?: string } }>("/cron/purge", handle);
  app.post<{ Querystring: { dryRun?: string } }>("/cron/purge", handle);
}
