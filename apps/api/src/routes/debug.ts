import type { FastifyInstance } from "fastify";
import { bearerAuthorised } from "../lib/bearer";

/* A DELIBERATE 500, for proving the error pipeline end to end.
 *
 * GATE 7 asks to "trigger a deliberate error and show it in Sentry". Without this
 * the only way to prove the pipeline is to break something real in production and
 * watch, which is not a test — it is an incident with an audience.
 *
 * MOUNTED IN EVERY ENVIRONMENT, on purpose. The pipeline that needs proving is
 * production's: its DSN, its release tag, its alert rule, its nginx hop. A route
 * that only exists when NODE_ENV !== "production" proves the development pipeline
 * and says nothing about the one that matters.
 *
 * Why that is safe here:
 *   - it takes the CRON_SECRET bearer to reach, checked in constant time, exactly
 *     like /cron/purge;
 *   - 503 when CRON_SECRET is unset, so a half-configured box has it closed rather
 *     than open;
 *   - POST only, so no crawler, prefetch or accidental click can fire it;
 *   - it has no side effects at all — one log line, one Sentry event, no database
 *     access, no file written;
 *   - it carries NO user input into the error, so nobody can plant a chosen string
 *     in the error report.
 */
export async function debugRoutes(app: FastifyInstance): Promise<void> {
  app.post("/debug/error", async (req, reply) => {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret) {
      req.log.error("CRON_SECRET is not set — /debug/error is closed");
      return reply.code(503).send({ ok: false, error: "not-configured" });
    }
    if (!bearerAuthorised(req.headers.authorization, secret)) {
      return reply.code(401).send({ ok: false, error: "unauthorised" });
    }
    /* Thrown, not reported directly: the point is to exercise the REAL path —
       setErrorHandler → captureServerError → the generic 500 body → the
       x-request-id on the response. The id is in the message so the Sentry event
       and the log line can be matched by eye during the gate. */
    throw new Error(`deliberate test error from /debug/error (request ${req.id})`);
  });
}
