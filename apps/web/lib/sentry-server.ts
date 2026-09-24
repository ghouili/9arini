/* Error tracking for the WEB SERVER. Off unless SENTRY_DSN is set.
 *
 * WHY THIS IS NOT IN instrumentation.ts. Next compiles the instrumentation hook
 * into BOTH the node-server and the edge-server bundles — unconditionally, whether
 * or not the app has any edge code (next/dist/build/entries.js: the hook is the one
 * page type that calls onServer() *and* onEdgeServer()). `serverExternalPackages`
 * only applies to the node compile: the edge compile's `externals` is a fixed list
 * that never consults it (next/dist/build/webpack-config.js). So a top-level
 * `import * as Sentry from "@sentry/node"` in instrumentation.ts got BUNDLED for
 * the edge, where it dragged in @sentry/node-core's ESM loader →
 * import-in-the-middle → module-details-from-path → `require("path")`, which the
 * edge target cannot resolve. The build failed with "Can't resolve 'path'".
 *
 * Holding the SDK behind a module boundary lets instrumentation.ts reach it through
 * a `process.env.NEXT_RUNTIME === "nodejs"` branch. Next's DefinePlugin inlines that
 * value per compile, so on the edge the branch folds to `if (false)` and webpack
 * drops the import() and everything under it before resolution. Nothing here is ever
 * seen by the edge compiler, the client bundle, or the CSP.
 *
 * The app has no edge code today (proxy.ts runs on the node runtime in Next 16, and
 * no route sets `runtime = "edge"`), so the branch costs no coverage. If one is ever
 * added, its errors will need a reporter that can live inside the edge budget —
 * @sentry/node is not it.
 *
 * WHAT IS SENT: the exception with its stack, the route PATH pattern, the method,
 * and Next's own routing context. Never headers (the session cookie lives there),
 * never the query string, never a body. @tnajem/shared/observability holds the
 * policy and the scrubber that enforces it on the assembled event.
 */
import "server-only";
import * as Sentry from "@sentry/node";
import { sentryDsn, sentryEnvironment, sentryRelease, sentryOptions, scrubUrl } from "@tnajem/shared/observability";

/** The two arguments Next hands `onRequestError` beyond the error itself. */
export type RequestInfo = { path?: string; method?: string };
export type ErrorContext = {
  routerKind?: string;
  routePath?: string;
  routeType?: string;
  renderSource?: string;
  revalidateReason?: string;
};

/** Call once, from register(). A no-op without a DSN. */
export function initSentry(): void {
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

/** Report one server-side render/route/action error. A no-op without a DSN. */
export function captureRequestError(err: unknown, request: RequestInfo, context: ErrorContext): void {
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
