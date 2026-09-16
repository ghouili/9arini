/* Error tracking for the WEB SERVER. Off unless SENTRY_DSN is set.
 *
 * Next runs `register()` once per server process, before any request is handled,
 * and calls `onRequestError` for every error thrown while rendering a page, a
 * route handler or a server action. That is the whole surface this file needs —
 * which is why it is here instead of @sentry/nextjs + withSentryConfig:
 *
 *   - withSentryConfig WRAPS next.config.mjs, and that file's `webpack()` is
 *     contractual: it installs the NormalModuleReplacementPlugin that keeps the
 *     invented demo tutors out of production bundles, and guardrails.mjs §6 fails
 *     the build if a fixture string survives. A config wrapper that reorders or
 *     drops that plugin turns a hard gate into a silent one.
 *   - the wizard's setup also ships a BROWSER SDK, and the site's CSP is
 *     `connect-src 'self'` with no external origins (next.config.mjs). Reporting
 *     browser errors would mean widening that policy and shipping more JavaScript
 *     to every page on a 3G connection. Decided against, 16 Sept: server-side only.
 *
 * So: @sentry/node, no config wrapper, nothing added to the client bundle, and the
 * CSP untouched. `serverExternalPackages` in next.config.mjs keeps this out of the
 * webpack bundle so the SDK loads from node_modules at runtime.
 *
 * WHAT IS SENT: the exception with its stack, the route PATH pattern, the method,
 * and Next's own routing context. Never headers (the session cookie lives there),
 * never the query string, never a body. @tnajem/shared/observability holds the
 * policy and the scrubber that enforces it on the assembled event.
 */
import * as Sentry from "@sentry/node";
import { sentryDsn, sentryEnvironment, sentryRelease, sentryOptions, scrubUrl } from "@tnajem/shared/observability";

export async function register(): Promise<void> {
  const dsn = sentryDsn();
  if (!dsn) return;

  Sentry.init({
    ...sentryOptions({
      dsn,
      environment: sentryEnvironment(),
      release: sentryRelease(),
      serverName: "tnajem-web",
    }),
    /* Same reasoning as apps/api/src/lib/sentry.ts: the default integrations are
       OpenTelemetry-based and need `node --import`, which neither the standalone
       runner nor the Dockerfile provides. Console breadcrumbs stay off too — Next
       logs plenty, and none of it has been reviewed for what it may contain. */
    defaultIntegrations: false,
    integrations: [Sentry.dedupeIntegration(), Sentry.functionToStringIntegration()],
    skipOpenTelemetrySetup: true,
    debug: false,
  });
}

type RequestInfo = { path?: string; method?: string };
type ErrorContext = {
  routerKind?: string;
  routePath?: string;
  routeType?: string;
  renderSource?: string;
  revalidateReason?: string;
};

/* Next's hook for server-side render/route/action errors. Its third argument is
   the useful one: routePath is the PATTERN (/[locale]/[slug]), which groups
   errors properly, where request.path is one visitor's concrete URL. */
export async function onRequestError(err: unknown, request: RequestInfo, context: ErrorContext): Promise<void> {
  const dsn = sentryDsn();
  if (!dsn) return;

  Sentry.withScope((scope) => {
    scope.setTag("route", context.routePath ?? "unknown");
    scope.setTag("route_type", context.routeType ?? "unknown");
    scope.setTag("router", context.routerKind ?? "unknown");
    scope.setTag("method", request.method ?? "unknown");
    if (context.renderSource) scope.setTag("render_source", context.renderSource);
    if (context.revalidateReason) scope.setTag("revalidate_reason", context.revalidateReason);
    /* The concrete path, minus its query string — /checkout?class=<uuid> is a
       capability, and scrubUrl is the same helper the event scrubber uses. */
    if (request.path) scope.setContext("request", { path: scrubUrl(request.path) });
    /* THE JOIN. When the web tier failed because the API did, api.ts attaches the
       API's x-request-id to the thrown ApiTransportError — the same id the API
       logged and put on its own response. Without this tag the two halves of one
       failure are two unrelated reports. */
    const requestId = (err as { apiRequestId?: string } | null)?.apiRequestId;
    if (requestId) scope.setTag("api_request_id", requestId);
    Sentry.captureException(err);
  });
}
