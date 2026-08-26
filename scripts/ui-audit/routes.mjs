/* Shared route + viewport config for shots.mjs / nojs.mjs / a11y.mjs.

   Every path here is LOCALE-BARE — the runners expand it across /fr and /ar, so a
   route can never be audited in one language and forgotten in the other. */

export const BASE = process.env.UI_AUDIT_BASE || "http://localhost:3111";
export const LOCALES = ["fr", "ar"];
export const WIDTHS = [320, 380, 768, 1280];

/* The dev-mode session sentinel. middleware.ts accepts it outside production, so
   the logged-in screens can be audited without standing up a real OTP flow. */
export const SESSION_COOKIE = { name: "tnajem_session", value: "demo", url: BASE };

/* `nojs: true`  → must render h1 + sub + CTA with JavaScript disabled.
   `sub` / `cta`  → the selectors nojs.mjs asserts on. `null` means "not applicable"
                    (a page that legitimately has no lead paragraph or no CTA). */
export const ROUTES = [
  // ── public: indexed, shared on WhatsApp, must survive a failed bundle ──
  { path: "/", name: "home", nojs: true, h1: "h1.web-h1", sub: "p.web-lead", cta: "main a.btn-primary" },
  { path: "/pour-les-profs", name: "pour-les-profs", nojs: true, h1: "h1.web-h1", sub: "p.web-lead", cta: "main a.btn-primary" },
  { path: "/explore", name: "explore", nojs: true, h1: "main h1", sub: "main h1 + p", cta: "main a.u-card-int, main a[href*=\"/\"]" },
  { path: "/yassine-math", name: "storefront", nojs: true, h1: "main h1", sub: "main .sf-bio", cta: "main a.btn-primary, main a.btn-green" },
  { path: "/terms", name: "terms", nojs: true, h1: "main h1", sub: "main p.web-lead", cta: null },
  { path: "/privacy", name: "privacy", nojs: true, h1: "main h1", sub: "main p.web-lead", cta: null },
  { path: "/nonexistent-404", name: "404", nojs: true, h1: "main h1", sub: "main p.web-lead", cta: "main a.btn-primary" },
  { path: "/auth", name: "auth", nojs: true, h1: "main h1", sub: null, cta: null },

  // ── logged-in product (session cookie) — screenshots + axe, no nojs contract ──
  { path: "/onboarding", name: "onboarding", auth: true },
  { path: "/onboarding/verify", name: "onboarding-verify", auth: true },
  { path: "/dashboard", name: "dashboard", auth: true },
  { path: "/dashboard/new-class", name: "dashboard-new-class", auth: true },
  { path: "/dashboard/new-pack", name: "dashboard-new-pack", auth: true },
  { path: "/dashboard/payout", name: "dashboard-payout", auth: true },
  { path: "/student", name: "student", auth: true },
  { path: "/account", name: "account", auth: true },
  { path: "/checkout", name: "checkout", auth: true },
  { path: "/class/c1", name: "class", auth: true },
  /* The live room and the admin verification queue are low-traffic but they are
     real screens, and both were touched by the Tailwind conversion — leaving
     them out of the harness would mean converting code nothing measures. */
  { path: "/live/c1", name: "live", auth: true },
  { path: "/admin/verifications", name: "admin-verifications", auth: true },
];

/** Expand the bare routes across both locales. */
export function expand(filter = () => true) {
  const out = [];
  for (const r of ROUTES.filter(filter)) {
    for (const locale of LOCALES) {
      out.push({ ...r, locale, url: `${BASE}/${locale}${r.path === "/" ? "" : r.path}` });
    }
  }
  return out;
}

/** Fail loudly if the dev server is not up — a silent 0-route run is worse than a crash. */
export async function assertServer() {
  try {
    const res = await fetch(`${BASE}/fr`, { redirect: "manual" });
    if (res.status >= 500) throw new Error(`status ${res.status}`);
  } catch (e) {
    console.error(
      `\n  x Cannot reach the dev server at ${BASE}.\n` +
        `    Start it first:  npm run dev -- -p 3111\n` +
        `    (or set UI_AUDIT_BASE to point somewhere else)\n`
    );
    process.exit(1);
  }
}
