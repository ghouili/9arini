/* ══════════════════════════════════════════════════════════════════════════════
   "Does this tutor slug exist?" — the middleware's one question, asked cheaply.

   middleware.ts needs the answer BEFORE the page renders, because it is the only
   place that can set a 404 status (a runtime notFound() on Next 14.2 ships an empty
   body — see app/[locale]/[slug]/page.tsx). The answer comes from
   app/api/tutor-exists/[slug], which reads the storefront's own unstable_cache
   entry. What this module adds is everything that keeps that from being a hole:

     • ANSWERS ARE REMEMBERED. "exists" for 30s, "missing" for 10s, at most 2 000
       slugs (oldest evicted first). The negative TTL is short on purpose: a tutor
       approved a moment ago may be 404'd for at most 10s by a visitor who tried
       the link just before. It used to be 0 — every nonsense slug from a crawler or
       a scanner cost an internal HTTP round trip and a storefront read.
     • EACH IP HAS A BUDGET: 20 lookups, refilled one every 3s, plus a global cap
       of 16 lookups in flight. Over budget the request PASSES THROUGH to the page
       (which renders the not-found screen inline) instead of being refused —
       Tunisian mobile networks put thousands of people behind one CGNAT address,
       and a 429 or a false 404 there would hit real students.
     • FAILURES FAIL OPEN, AND SAY SO. A timeout, a 5xx or an unreadable answer
       passes the request through (a soft 404 on a dead link beats a hard 404 on a
       real tutor) and logs one JSON line, `event: "tutor_lookup_fail_open"`, at
       most once a minute per reason with a count of what was suppressed. The line
       never carries the slug or the IP.

   Dependencies are injected (fetch, clock, log) so the TTLs, the bucket and the
   log suppression are tested without a server: e2e/tutor-lookup.spec.ts.
   Edge-safe: no Node APIs, no path aliases.
   ══════════════════════════════════════════════════════════════════════════════ */

export type LookupAnswer = "exists" | "missing" | "unknown";

export type FailOpenReason = "over_budget" | "in_flight_cap" | "timeout" | "http_error" | "network" | "bad_response";

type MinimalResponse = { ok: boolean; json(): Promise<unknown> };

export type TutorLookupDeps = {
  fetch: (url: string, init: { signal: AbortSignal; cache: "no-store" }) => Promise<MinimalResponse>;
  now: () => number;
  log: (line: string) => void;
};

export const DEFAULT_LOOKUP_OPTIONS = {
  positiveTtlMs: 30_000,
  negativeTtlMs: 10_000,
  maxEntries: 2_000,
  bucketCapacity: 20,
  bucketRefillMs: 3_000,
  maxBuckets: 10_000,
  maxInFlight: 16,
  timeoutMs: 2_000,
  logIntervalMs: 60_000,
};
export type TutorLookupOptions = typeof DEFAULT_LOOKUP_OPTIONS;

export function createTutorLookup(deps: TutorLookupDeps, options: Partial<TutorLookupOptions> = {}) {
  const o: TutorLookupOptions = { ...DEFAULT_LOOKUP_OPTIONS, ...options };
  const answers = new Map<string, { exists: boolean; until: number }>();
  const buckets = new Map<string, { tokens: number; at: number }>();
  const logged = new Map<FailOpenReason, { at: number; suppressed: number }>();
  let inFlight = 0;

  function failOpen(reason: FailOpenReason): "unknown" {
    const t = deps.now();
    const prev = logged.get(reason);
    if (prev && t - prev.at < o.logIntervalMs) {
      prev.suppressed++;
      return "unknown";
    }
    deps.log(
      JSON.stringify({
        level: "warn",
        event: "tutor_lookup_fail_open",
        reason,
        suppressed: prev?.suppressed ?? 0,
        at: new Date(t).toISOString(),
      }),
    );
    logged.set(reason, { at: t, suppressed: 0 });
    return "unknown";
  }

  function remember(slug: string, exists: boolean) {
    answers.delete(slug); // re-insert at the end: Map order is the eviction order
    if (answers.size >= o.maxEntries) {
      const oldest = answers.keys().next().value;
      if (oldest !== undefined) answers.delete(oldest);
    }
    answers.set(slug, { exists, until: deps.now() + (exists ? o.positiveTtlMs : o.negativeTtlMs) });
  }

  /** One token from this IP's bucket, or false when it is empty. */
  function spend(ip: string): boolean {
    const t = deps.now();
    let b = buckets.get(ip);
    if (!b) {
      if (buckets.size >= o.maxBuckets) {
        const oldest = buckets.keys().next().value;
        if (oldest !== undefined) buckets.delete(oldest);
      }
      b = { tokens: o.bucketCapacity, at: t };
      buckets.set(ip, b);
    } else {
      const refills = Math.floor((t - b.at) / o.bucketRefillMs);
      if (refills > 0) {
        b.tokens = Math.min(o.bucketCapacity, b.tokens + refills);
        b.at += refills * o.bucketRefillMs;
      }
    }
    if (b.tokens <= 0) return false;
    b.tokens--;
    return true;
  }

  async function lookup(slug: string, ctx: { ip: string; origin: string }): Promise<LookupAnswer> {
    const known = answers.get(slug);
    if (known && known.until > deps.now()) return known.exists ? "exists" : "missing";

    if (!spend(ctx.ip || "unknown")) return failOpen("over_budget");
    if (inFlight >= o.maxInFlight) return failOpen("in_flight_cap");

    inFlight++;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), o.timeoutMs);
    try {
      const res = await deps.fetch(`${ctx.origin}/api/tutor-exists/${encodeURIComponent(slug)}`, {
        signal: abort.signal,
        cache: "no-store",
      });
      if (!res.ok) return failOpen("http_error");
      const body = (await res.json()) as { exists?: unknown } | null;
      if (body?.exists === true || body?.exists === false) {
        remember(slug, body.exists);
        return body.exists ? "exists" : "missing";
      }
      return failOpen("bad_response");
    } catch {
      return failOpen(abort.signal.aborted ? "timeout" : "network");
    } finally {
      clearTimeout(timer);
      inFlight--;
    }
  }

  return { lookup, size: () => ({ answers: answers.size, buckets: buckets.size, inFlight }) };
}
