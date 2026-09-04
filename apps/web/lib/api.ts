import "server-only";
import { cookies, headers } from "next/headers";
import { SESSION_COOKIE } from "@tnajem/shared/auth-core";
import { revalidateTutor, revalidatePublicTutors } from "./cache";
import type { ActionResult } from "@tnajem/shared/contracts";

/* The proxy every ported server action calls.

   Step 4's whole premise is that each action keeps its exported SIGNATURE and
   only its body changes, so no call site moves and the diff stays provable. This
   file is where the one-hop-to-Fastify lives.

   ══════════════════════════════════════════════════════════════════════════════
   FIVE RULES. Each of them is a behaviour change if broken.
   ══════════════════════════════════════════════════════════════════════════════

   1. X-FORWARDED-FOR IS LOAD-BEARING, NOT PLUMBING.
      clientIp() keys the OTP rate limiter (otp:req:ip 10/10min, otp:vfy:ip
      30/15min). The API now sees the WEB SERVER's socket address for every
      request, so unless the real client address is forwarded, all traffic
      collapses into one bucket: one attacker exhausts the limit for the entire
      internet, and every real user's throttle is spent by strangers.
      We OVERWRITE the header with the address Next already resolved — never
      append, because appending lets a client prepend a forged hop. The API side
      only trusts it from configured addresses (apps/api/src/env.ts::TRUST_PROXY).

   2. RETHROW TRANSPORT FAILURES. Do not convert them to { ok: false }.
      Today a database failure THROWS out of the action and the promise rejects,
      so Next's error boundary fires. Swallowing an API outage into a tidy
      { ok: false, error: "server-error" } would turn "the error boundary fires"
      into "the UI quietly says try again", and would mask an outage in exactly
      the place it most needs to be visible. Stage A's contract is identity, not
      improvement.

   3. NEVER call cookies() or headers() in a proxy used by an ISR page.
      getTutorReviews and getExploreTutors are called during SSR — the first from
      inside unstable_cache, where touching cookies() THROWS, and outside it the
      route silently opts out of ISR with no error and no warning. /[slug] and
      /explore would just stop being cached, and every WhatsApp-storm hit would
      become a database round trip. Those use callAnonymous().

   4. revalidate STAYS ON THE WEB SIDE.
      revalidateTag/revalidatePath only work inside a Next request scope, so they
      cannot move. Mutating endpoints report what they invalidated and we replay
      it here — see the `revalidate` field in @tnajem/shared/contracts.

   5. RETRY GETs ONLY, ONCE, ON ECONNREFUSED.
      Never retry a POST: retrying reserveSeat double-books. */

const API_URL = process.env.API_URL ?? "http://127.0.0.1:4000";

/** The client's address as Next resolved it. Rule 1. */
function forwardedFor(): string {
  try {
    const h = headers();
    const fwd = h.get("x-forwarded-for") ?? "";
    const first = fwd.split(",")[0]?.trim();
    return first || h.get("x-real-ip")?.trim() || "";
  } catch {
    return ""; // outside a request scope
  }
}

function sessionToken(): string | undefined {
  try {
    return cookies().get(SESSION_COOKIE)?.value;
  } catch {
    return undefined;
  }
}

class ApiTransportError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ApiTransportError";
  }
}

type CallOptions = { method?: "GET" | "POST"; body?: unknown; anonymous?: boolean };

async function request(path: string, opts: CallOptions): Promise<unknown> {
  const method = opts.method ?? "POST";
  const headersOut: Record<string, string> = { "content-type": "application/json" };

  if (!opts.anonymous) {
    const token = sessionToken();
    if (token) headersOut.cookie = `${SESSION_COOKIE}=${token}`;
    const ip = forwardedFor();
    if (ip) headersOut["x-forwarded-for"] = ip; // OVERWRITE, never append
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: headersOut,
    body: method === "GET" ? undefined : JSON.stringify(opts.body ?? {}),
    // The caller owns caching (unstable_cache on the ISR pages); never cache here.
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    /* Rule 2: a non-200 here is a transport or shape failure, never a domain
       outcome — those come back as 200 with { ok:false, error }. Throwing keeps
       today's behaviour, where a DB failure rejects the action's promise. */
    throw new ApiTransportError(`${method} ${path} -> ${res.status}`, res.status);
  }
  return res.json();
}

/** Authenticated call: forwards the session cookie and the client address. */
export async function call<T>(path: string, body?: unknown, method: "GET" | "POST" = "POST"): Promise<T> {
  const out = (await request(path, { method, body })) as T & Partial<ActionResult>;

  // Rule 4: replay the invalidations the API reported.
  const rv = out?.revalidate;
  if (rv) {
    for (const slug of rv.tutors ?? []) revalidateTutor(slug);
    if (rv.publicTutors) revalidatePublicTutors();
  }
  return out;
}

/** Anonymous call for SSR/ISR reads. Rule 3: touches NO cookies and NO headers. */
export async function callAnonymous<T>(path: string): Promise<T> {
  return (await request(path, { method: "GET", anonymous: true })) as T;
}

export { ApiTransportError };
