/* The client's IP address, as the proxy in front of us saw it.

   ONE rule, used by the middleware's per-IP lookup budget and by lib/api.ts when it
   forwards the address to apps/api (which keys the OTP rate limiter on it):

     1. X-Real-IP — nginx sets it from $remote_addr, overwriting anything the
        client sent (DEPLOY.md §A: `proxy_set_header X-Real-IP $remote_addr;`).
     2. else the RIGHTMOST X-Forwarded-For entry — the one the last proxy appended.

   NEVER the leftmost. `$proxy_add_x_forwarded_for` APPENDS to whatever the client
   sent, so the first entry is whatever the client typed: before 15 Sept lib/api.ts
   forwarded exactly that, and anyone could rotate "X-Forwarded-For: 1.2.3.4" to get
   a fresh OTP budget per request.

   Both rules assume a proxy in front that sets these headers. A web process exposed
   directly to the internet cannot tell a real address from a forged header — that
   deployment is unsupported (DEPLOY.md). Edge-safe: no Node APIs. */
type HeaderBag = { get(name: string): string | null };

export function clientIpFrom(headers: HeaderBag): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const hops = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return hops[hops.length - 1] ?? "";
}
