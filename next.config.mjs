/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === "production";

/* ── Content-Security-Policy ───────────────────────────────────────────────────
   Why 'unsafe-inline' rather than a nonce, deliberately:

   Next's App Router streams the RSC flight payload and hydration bootstrap as
   INLINE <script>/<style> on every page. The robust alternative — a per-request
   nonce injected by middleware — strips 'unsafe-inline' but forces EVERY response
   to be dynamically rendered (the nonce differs per request), which would defeat
   the ISR/static caching of the storefront that the whole scaling plan rests on
   (SCALABILITY.md: cache the viral page's HTML perfectly). For this app, allowing
   inline while keeping the page cacheable is the right trade — and the highest-risk
   surface (the ID-scan viewer, app/api/admin/doc) already ships its own
   `default-src 'none'; sandbox` CSP, which combines with this one, never loosens it.

   Live video runs on meet.jit.si in a NEW TAB (window.open in app/live), not an
   iframe, so no frame-src/camera/microphone grant is needed on our origin. That
   keeps the policy tight: nothing may frame us, we frame nothing, no plugins,
   no base-tag or form-action hijack, and connect/img/font are self-only. */
function contentSecurityPolicy() {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'", // clickjacking — supersedes X-Frame-Options on modern browsers
    "form-action 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    // Dev (HMR) additionally needs eval; prod is inline-only.
    `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
    // Dev needs the HMR websocket; prod talks only to its own origin (server actions).
    `connect-src 'self'${isProd ? "" : " ws: wss:"}`,
    "manifest-src 'self'",
  ];
  if (isProd) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

/* Sent on every response. Cheap headers ship in dev too; HSTS + CSP are prod-only
   (HSTS is ignored over http anyway, and the CSP's prod form would fight HMR). */
function securityHeaders() {
  const headers = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-DNS-Prefetch-Control", value: "off" },
    // No feature this app uses needs these; the Jitsi tab is a separate origin that
    // grants its own camera/mic. Payments are off, so opt out of the Payment API too.
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
    { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  ];
  if (isProd) {
    // Two years, subdomains, preload-eligible. Also set this at the edge (nginx/
    // Cloudflare, DEPLOY.md) — belt and braces if a request ever bypasses Next.
    headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" });
  }
  return headers;
}

/* Tuned for the actual client: a mid-range Android on 3G in Tunisia, opening a
   tutor's storefront from a WhatsApp link. Every kilobyte and every round trip
   on that path is the product. */
const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders() }];
  },

  output: "standalone", // self-contained server build for Docker/Render/Railway
  reactStrictMode: true,

  /* gzip/brotli on the Node responses. nginx sits in front (DEPLOY.md §6) and can
     compress too — if you enable `gzip on` there, set this back to false so the
     HTML is not compressed twice (wasted CPU on every request). Leaving it ON
     here is the safe default: the current nginx block does NOT enable gzip, so
     without this the storefront HTML ships uncompressed over 3G. */
  compress: true,

  /* Stop advertising the framework on every response. One header off every
     response is a rounding error in bytes and one less free hint for a scanner. */
  poweredByHeader: false,

  /* Do not ship the source-map payload for the client bundles in prod (default,
     stated explicitly): they are megabytes, and on a metered 3G connection a
     devtools-open user would pay for them. */
  productionBrowserSourceMaps: false,

  images: {
    /* No remote hosts on purpose: uploads (ID docs) are served only through the
       admin-gated route, and there is no CDN yet. Add `remotePatterns` in the
       same change that introduces object storage — never a bare `domains: ["*"]`,
       which turns /_next/image into an open image proxy anyone can use to
       launder traffic through our server. */
    remotePatterns: [],

    /* Modern formats first. AVIF is ~30-50% smaller than JPEG at the same quality
       and every Android Chrome since 85 supports it; Next falls back to WebP then
       the original for anything older. This is the single biggest byte win the
       day avatars/intro-video thumbnails become real images (today the storefront
       renders initials, so it costs nothing to have this ready). */
    formats: ["image/avif", "image/webp"],

    /* Device widths trimmed to what Tunisian phones actually report. The default
       list runs to 3840px (4K desktop); generating and caching those variants for
       a market that is overwhelmingly 360-430px CSS-wide is wasted CPU on the
       VPS and, worse, risks serving a 2048px image to a phone that only needed
       640px because the widths bracket badly. */
    deviceSizes: [360, 414, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],

    /* Cache an optimised image for 30 days minimum. Image optimisation is CPU
       work on the same box that serves the pages; under a viral spike we do not
       want to be re-encoding the same avatar for every visitor. */
    minimumCacheTTL: 60 * 60 * 24 * 30,

    /* SVGs are never optimised, they are passed through — a hostile SVG is a
       script. Explicitly off (also the default) because the day someone lets
       tutors upload an avatar, this is the line that stops stored XSS. */
    dangerouslyAllowSVG: false,
  },

  experimental: {
    // Verification doc uploads (ID/diploma images or PDFs) exceed the 1MB default.
    serverActions: { bodySizeLimit: "12mb" },
  },

  /* NOT set: `experimental.optimizePackageImports`. It only rewrites imports from
     node_modules barrels, and this app has no icon/UI library in its dependencies
     (the whole UI is local + Tailwind). It would be a no-op here; the real client
     bundle problem is architectural — see SCALABILITY.md §Frontend. */
};
export default nextConfig;
