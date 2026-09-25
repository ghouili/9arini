import { test, type Browser, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { seedAdmin, seedProfile } from "../support/seed";
import { loginAs } from "../support/session";
import { BASE_URL } from "../support/env";

/* UI Option A · S0 — before/after screenshots. NOT part of `npm run test`: the main
   config only matches *.spec.ts, and this file is *.capture.ts. Run it with

     npx playwright test -c e2e/visual/visual.config.ts            → ui-option-a/before/
     UI_SHOTS=after npx playwright test -c e2e/visual/visual.config.ts → ui-option-a/after/

   against a running production build (the usual webServer pair, or E2E_BASE_URL /
   E2E_API_URL). /fr/yassine-math is the tutor `npm run db:seed` creates.

   Full page, at desktop 1440×900 and phone 390×844. Signed-in pages get a session
   for a seeded account of the right role: a student for /messages, a tutor with no
   storefront yet for /dashboard (the "Crée ta vitrine" state), the pinned e2e admin
   for /admin. ui-option-a/ is gitignored. */

const OUT = resolve("ui-option-a", process.env.UI_SHOTS === "after" ? "after" : "before");

type Who = "anon" | "student" | "tutor" | "admin";
const PAGES: { name: string; path: string; who: Who }[] = [
  { name: "home", path: "/fr", who: "anon" },
  { name: "home-ar", path: "/ar", who: "anon" },
  { name: "explore", path: "/fr/explore", who: "anon" },
  { name: "tutor-page", path: "/fr/yassine-math", who: "anon" },
  { name: "tarifs", path: "/fr/tarifs", who: "anon" },
  { name: "pour-les-profs", path: "/fr/pour-les-profs", who: "anon" },
  { name: "auth", path: "/fr/auth", who: "anon" },
  { name: "signup-eleve", path: "/fr/signup/eleve", who: "anon" },
  { name: "messages", path: "/fr/messages", who: "student" },
  { name: "dashboard", path: "/fr/dashboard", who: "tutor" },
  { name: "new-class", path: "/fr/dashboard/new-class", who: "tutor" },
  { name: "admin-verifications", path: "/fr/admin/verifications", who: "admin" },
  { name: "404", path: "/fr/404-test", who: "anon" },
];

const VIEWPORTS = [
  { tag: "1440", width: 1440, height: 900 },
  { tag: "390", width: 390, height: 844 },
];

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

async function contextFor(browser: Browser, who: Who, viewport: { width: number; height: number }, ids: Record<Exclude<Who, "anon">, string>) {
  /* reducedMotion: the landing pages reveal their sections on scroll, and a full-page
     screenshot never scrolls — those sections came out EMPTY. Under reduced motion
     the Reveal components render in place (the same path a real visitor with that
     preference gets). */
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "reduce" });
  if (who !== "anon") {
    await loginAs(ctx, ids[who]);
    /* The header reads the readable role HINT cookie a real login sets (lib/auth.ts
       ROLE_HINT_COOKIE), not the session — without it a signed-in page shows the
       signed-out header ("Se connecter"), which is not what that user sees. */
    const u = new URL(BASE_URL);
    await ctx.addCookies([{ name: "tnajem_role", value: who === "student" ? "student" : "tutor", domain: u.hostname, path: "/" }]);
  }
  return ctx;
}

test("capture every Option A page at desktop and phone width", async ({ browser }) => {
  test.setTimeout(10 * 60_000);
  await mkdir(OUT, { recursive: true });
  const ids = {
    student: (await seedProfile({ role: "student", fullName: "Sarra Mejri", birthYear: 1999 })).id,
    tutor: (await seedProfile({ role: "tutor", fullName: "Yassine Kallel", birthYear: 1990 })).id,
    admin: (await seedAdmin()).id,
  };
  for (const vp of VIEWPORTS) {
    for (const p of PAGES) {
      const ctx = await contextFor(browser, p.who, vp, ids);
      const page = await ctx.newPage();
      await page.goto(p.path);
      await settle(page);
      await page.screenshot({ path: join(OUT, `${p.name}-${vp.tag}.png`), fullPage: true, animations: "disabled" });
      await ctx.close();
    }
  }
});
