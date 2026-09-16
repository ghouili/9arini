/* Error tracking for the API. Off unless SENTRY_DSN is set.
 *
 * WHY MANUAL CAPTURE AND NOT AUTO-INSTRUMENTATION. @sentry/node v10 builds its
 * automatic instrumentation on OpenTelemetry, which patches modules through
 * import-in-the-middle and therefore needs an ESM loader hook
 * (`node --import @sentry/node/preload dist/server.js`). This bundle is ESM
 * (tsup format: ["esm"]) and it is started as a bare `node dist/server.js` by both
 * ecosystem.config.cjs and the Dockerfile's CMD. A Sentry.init that expects the
 * hook and does not get it half-patches the runtime and reports nothing useful, so
 * OpenTelemetry is skipped outright and the one place that already sees every
 * failure — the Fastify error handler — reports them by hand.
 *
 * What that costs: no spans, no performance data. What it buys: the same error
 * pipeline in dev, in the container and under pm2, with no launcher flags to keep
 * in sync across three files.
 *
 * WHAT IS SENT: the exception (with a stack, which the log line deliberately does
 * NOT carry), the route pattern, the method, the status, and the request id that is
 * already on the response as x-request-id. Nothing else — see
 * @tnajem/shared/observability for the policy and the scrubber that enforces it.
 */
import * as Sentry from "@sentry/node";
import { sentryDsn, sentryEnvironment, sentryRelease, sentryOptions } from "@tnajem/shared/observability";
import { VERSION } from "../env";

let started = false;

/** Call once, at boot, before the server listens. A no-op without a DSN. */
export function initSentry(): boolean {
  if (started) return true;
  const dsn = sentryDsn();
  if (!dsn) return false;

  Sentry.init({
    ...sentryOptions({
      dsn,
      environment: sentryEnvironment(),
      release: sentryRelease(VERSION),
      serverName: "tnajem-api",
    }),
    /* NO DEFAULT INTEGRATIONS. The defaults include the OpenTelemetry HTTP
       instrumentation described above, a console integration that would turn every
       log line into a breadcrumb (the log lines are already the redacted surface;
       breadcrumbs are a second, unreviewed copy), and a request-data integration
       that attaches headers and bodies. Each of the four kept below is here for a
       stated reason. */
    defaultIntegrations: false,
    integrations: [
      // Group identical crashes instead of paying for N copies of one bug.
      Sentry.dedupeIntegration(),
      // `[Function: x]` in an event instead of a useless serialisation.
      Sentry.functionToStringIntegration(),
      /* The two failure modes the error handler never sees, because they escape
         the request scope entirely. Both are how this process dies silently. */
      Sentry.onUncaughtExceptionIntegration({ exitEvenIfOtherHandlersAreRegistered: false }),
      Sentry.onUnhandledRejectionIntegration({ mode: "warn" }),
    ],
    /* Skip OpenTelemetry setup — see the header. Without this, init() installs a
       tracer that never receives a span because the loader hook is absent. */
    skipOpenTelemetrySetup: true,
    /* Silence. apps/api/test/log-pii.test.ts captures every line this process
       writes, including console.*, and asserts none of them carries an e-mail or a
       phone number. A debug-chatty SDK would both fail that test and make the
       API's log unreadable. */
    debug: false,
  });
  started = true;
  return true;
}

/** True when events are actually being sent. Reported in the boot log line. */
export function sentryActive(): boolean {
  return started;
}

export type ServerErrorContext = {
  requestId: string;
  /** The route PATTERN (/tutors/:slug), never the concrete URL — see the policy. */
  route: string | undefined;
  method: string;
  status: number;
};

/** Report a 5xx. Called from the Fastify error handler; a no-op when off. */
export function captureServerError(err: unknown, ctx: ServerErrorContext): void {
  if (!started) return;
  Sentry.withScope((scope) => {
    scope.setTag("request_id", ctx.requestId);
    scope.setTag("route", ctx.route ?? "unrouted");
    scope.setTag("method", ctx.method);
    scope.setTag("status", String(ctx.status));
    Sentry.captureException(err);
  });
}

/** Flush on shutdown so the last crash is not lost with the process. */
export async function flushSentry(ms = 2000): Promise<void> {
  if (!started) return;
  try {
    await Sentry.flush(ms);
  } catch {
    /* Losing an event on the way out must never turn a clean shutdown into a
       crash — and there is nowhere left to report the failure to. */
  }
}
