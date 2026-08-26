# 9arini — UI/UX Master Brief for Claude Code

> Paste this entire file as your opening prompt in Claude Code, run from the repo root
> (`D:\work\Startups\New idea claude\9arini-app`). Work through it in order. Do not skip Phase 0.

---

## Your mission

Fix every UI/UX defect in this platform **permanently and verifiably**, then keep iterating
until you can *prove* — with measurements, not opinions — that it passes. You are not done when
the code looks right. You are done when the exit criteria in Phase 6 all measurably pass.

**The standard:** a Tunisian parent opens a tutor's WhatsApp link on a 3-year-old Android over
3G, in Arabic, in daylight. Everything must be legible, fast, and obviously trustworthy.

---

## ⛔ Guardrails — things that are ALREADY EXCELLENT. Do not "improve" them.

A prior audit verified these programmatically. Breaking them is a regression, not a refactor.

1. **RTL is architecturally correct.** Zero hardcoded physical `left`/`right`/`margin-left`
   properties in components or CSS. The `--fd → --fa` font-token swap plus the global
   `letter-spacing: normal` under `[dir="rtl"]` (`globals.css:341-342`) is the *right* fix.
   **Never** add `ml-`, `mr-`, `pl-`, `pr-`, `text-left`, or physical CSS properties. Logical
   properties only (`margin-inline-start`, `padding-inline-end`, `text-align: start`).
2. **FR/AR parity is exact.** All 21 page-local `copy = { fr, ar }` objects have identical key
   sets; zero `t.X.Y` references resolve to nothing; zero hardcoded French strings in JSX or in
   `aria-label`/`placeholder`/`title`. **Any string you add must be added to BOTH locales.**
3. **`prefers-reduced-motion` is honored** via a global backstop (`globals.css:350-358`) that
   correctly exempts the loading spinner. Keep that exemption.
4. **No fabricated data.** No invented ratings, testimonials, session counts, or tutor names in
   the UI *or* in JSON-LD. `aggregateRating` is emitted only when real reviews exist
   (`[slug]/page.tsx:174-181`). Storefront shows "Nouveau" instead of fake stars. **Keep it that
   way.** If a number would look persuasive but isn't real, say the true thing instead.
5. **Design tokens.** Every value comes from `globals.css` `:root`. Do not hardcode a hex, a
   px radius, or a shadow anywhere. If you need a new value, add a token.

---

## PHASE 0 — Build the measurement harness FIRST

**Do not fix anything until you can measure it.** Otherwise you will "fix" contrast by eye and
be wrong. Create `scripts/ui-audit/` with:

**a) `contrast.mjs`** — parses the real token values out of `app/globals.css` `:root`, then
computes WCAG 2.1 contrast ratios for every foreground/background pair actually used in the app.
Output a table: pair, ratio, required (4.5 normal / 3.0 large / 3.0 UI component), PASS/FAIL.
Exit code 1 if any FAIL. This file is the source of truth for Phase 1 — not your judgement.

**b) `shots.mjs`** — Playwright (add as a devDependency; it is a dev tool, that's fine).
For each of these routes: `/fr`, `/ar`, `/fr/pour-les-profs`, `/ar/pour-les-profs`, `/fr/explore`,
`/ar/explore`, `/fr/yassine-math`, `/ar/yassine-math`, `/fr/auth`, `/fr/onboarding`,
`/fr/onboarding/verify`, `/fr/dashboard`, `/fr/student`, `/fr/checkout`, `/fr/terms`,
`/fr/privacy`, `/fr/nonexistent-404`
— capture full-page screenshots at **320, 380, 768, 1280** px wide, into
`scripts/ui-audit/shots/<route>-<width>.png`. Then **actually LOOK at every screenshot** with the
Read tool. You cannot audit a UI you have not seen.

**c) `nojs.mjs`** — loads each public route with **JavaScript disabled** and asserts that the
`<h1>`, the sub-headline, and the primary CTA are all *visible* (non-zero opacity, in the DOM,
not `display:none`). This catches the reveal-animation bug class permanently.

**d) `a11y.mjs`** — runs `@axe-core/playwright` on every route above, in both locales. Output
violations grouped by impact. Exit code 1 on any serious/critical.

Add to `package.json`: `"ui:audit": "node scripts/ui-audit/contrast.mjs && node scripts/ui-audit/nojs.mjs && node scripts/ui-audit/a11y.mjs"`.

**The dev server must be running** (`npm run dev`) for b/c/d. Start it yourself.

---

## PHASE 1 — Contrast (CONFIRMED FAILURES, measured)

These ratios were computed from your actual tokens. All fail WCAG 2.1 AA.

| # | Pair | Ratio | Needs | Where |
|---|---|---|---|---|
| 1 | white on `--ochre` `#E0852E` | **2.78** | 4.5 | `.btn-primary` `globals.css:78` — **used 25×**, every primary CTA |
| 2 | white on `--ochre600` (hover) | 3.79 | 4.5 | same |
| 3 | white on `--green` `#1B9C6F` | 3.48 | 4.5 | `.btn-green` `globals.css:81`, `.chip-free`, pilot chip `pour-les-profs:715` |
| 4 | `--green` on `--green50` | **3.06** | 4.5 | "Nouveau" badge `ExploreClient.tsx:405` |
| 5 | `--green` on paper | 3.48 | 4.5 | `.sf-free` "Gratuite" 17px `StorefrontView.tsx:662`; "0 TND" `page.tsx:378` |
| 6 | `--ochre` on cream (large) | 2.60 | 3.0 | the highlighted word "**vérifié**" in the `<h1>`, `page.tsx:319` |
| 7 | `--green` on sand (large) | 2.84 | 3.0 | "Tu gardes 100 %" in the `<h1>`, `pour-les-profs:726` |

**How to fix — do this properly, not with a patch:**
Introduce **separate brand vs. accessible-text tokens.** `--ochre` and `--green` stay exactly as
they are for large decorative fills, borders, and illustrations — the brand must not change.
Add `--ochre-on-light` / `--green-on-light` (for text on cream/sand/paper) and
`--ochre-btn` / `--green-btn` (for solid buttons with white labels), tuned until `contrast.mjs`
passes. Suggested starting points: button ochre ≈ `#A85F14` (4.87:1), or keep the ochre fill and
switch the label to `color: var(--ink)` (5.98:1) — **test both and pick the one that looks
better in the screenshots**, then apply consistently.

Everything else already passes (`--muted` ≥4.62 on all five surfaces, `--ink2` ≥8:1,
white-on-cobalt 6.93, `--rose` 5.33). Do not touch those.

---

## PHASE 2 — Confirmed visual defects (seen in a live browser)

**1. The tutor-landing phone mockup is visibly broken** — `app/[locale]/pour-les-profs/page.tsx`
   - Card titles truncate mid-word: "Ta page d…", "Intégrales — ré…"
   - The floating "A" avatar overlaps the "1er cours offert" badge, covering the "1" so it
     literally renders as **"ler cours offert"**
   - The four floating avatars (A, S, M, R) collide with the phone's content
   - This is the hero of the page tutors share to recruit other tutors. It looks sloppy.
   - **Fix:** give the mockup enough width for its content (or shorten the strings), and move
     the floating avatars outside the card's content box so they can never overlap text.
     Verify at all four widths in the screenshots.

**2. `/pour-les-profs` renders INVISIBLE until JS hydrates** — `pour-les-profs/page.tsx:529`
   - `.lpp-reveal { opacity: 0 }` ships in the SSR HTML; `is-in` is only added by an
     `IntersectionObserver` in a `useEffect` (`:198-219`). The `<h1>`, eyebrow, sub-headline and
     primary CTA are all inside `<Reveal>` (`:713-747`).
   - On 3G that is a **blank hero** for the entire JS download+parse window, and a permanently
     blank page if the bundle fails.
   - Secondary bug: `threshold: 0.16` (`:215`) — a section taller than ~6× the viewport (very
     plausible at 320px in Arabic) can never reach 16% visibility and stays invisible **forever**.
   - **Fix:** render the final state server-side; animate only as a progressive enhancement
     (ship `is-in`, remove it in an effect before observing), or gate `opacity:0` behind
     `@media (scripting: enabled)`. Set `threshold: 0` and use `rootMargin` instead.
   - `page.tsx:294` has the same hard-fail shape — fix it too.
   - **`nojs.mjs` must pass for every public route after this.**

**3. Explore card has a stray square-cornered box** — `ExploreClient.tsx` (price/badge block)
   - A sharp-cornered rectangle inside an otherwise fully-rounded design. Reads as a rendering
     artifact. Use `var(--r-s)` or remove the border.

**4. "Nouveau" badge is near-illegible** — see Phase 1 #4.

---

## PHASE 3 — Accessibility (WCAG 2.1 AA)

- **No skip-to-content link** anywhere (`components/SiteShell.tsx`). Sticky header + nav on every
  page. WCAG 2.4.1. Add one, visible on focus, in both locales.
- **Unlabelled review textarea** — `app/[locale]/student/page.tsx:198`. No `<label>`, no
  `aria-label`. Every other input in the app is labelled; this is the one miss.
- **Touch targets < 44px:** `components/LocaleToggle.tsx:18` (40px),
  `components/SiteFooter.tsx:56` (40px), `admin/verifications/page.tsx:430` (~31px).
- **`<Spinner>` has no `role="status"`** — `components/ui.tsx:87`.
- **Heading order breaks** on auth/account/onboarding: page `<h1>` → footer `<h3>` with no
  `<h2>` (`SiteFooter.tsx:86,95,104`).
- **`role="menu"` without `menuitem` children** — `dashboard/page.tsx:271`. Make it a plain
  `<div>` or a correct listbox.
- **Body text at 11.5–12.5px** is used widely (metalines, helps, chips). Raise the floor to 13px.
- Keyboard-only pass: tab through every interactive element on every route. Every one must have
  a visible focus ring and a sane tab order. No traps.

---

## PHASE 4 — Performance on 3G

- **Both locales load all three font families** — `app/[locale]/layout.tsx:10-12, 84`. A French
  visitor downloads IBM Plex Sans Arabic (4 weights) they will never see; an Arabic visitor
  downloads Plus Jakarta Sans (**5 weights**) + Space Grotesk (3). ≈200–300KB wasted on first
  paint. **Split the `variable` classes by locale** and drop Plus Jakarta to 3 weights.
- **`middleware.ts:26-33` redirects `/` → `/fr`** — a full extra RTT (~0.5–1s on 3G) on the URL
  people actually type. Rewrite instead of redirect for the root.
- **`StorefrontView.tsx` (749 lines, `"use client"`)** is the WhatsApp-link entry point — the
  single most-loaded page. Convert to a **server shell + small client island**, exactly the
  pattern `/explore` already uses (`ExploreClient` receives SSR'd `initial`). This is the highest-
  value perf change in the app.
- Other heavy client components: dashboard 1048 lines, pour-les-profs 905, verify 784. Lower
  priority (logged-in / lower traffic) but note them.
- Everything else is already lean — 6 runtime deps, no icon library, `public/` = 204KB, no
  `<img>` anywhere, `next.config.mjs` well tuned. Don't add dependencies.

---

## PHASE 5 — Consistency & polish

- **Styling idiom is split.** `/` (197 Tailwind utils, 0 inline styles) and `/explore` (263/0)
  were rebuilt in the modern idiom. The logged-in product was not: dashboard **115** inline
  `style={{}}` objects, student 60, onboarding/verify 54, onboarding 41, live 29, auth 25,
  account 21, class/[id] 21. Same tokens, same logical properties — so it is a maintainability
  problem, not a visual one, but design changes currently have to be made twice.
  **Convert the logged-in screens to the Tailwind idiom**, one file per commit, screenshotting
  before/after to prove zero visual change.
- **`.grid` in `globals.css:247` collides with Tailwind's `grid` display utility** (already
  flagged in-file). Rename it before it causes a real bug.
- Audit spacing/type rhythm across the logged-in screens against the landing pages. They should
  look like the same product.

---

## PHASE 6 — Exit criteria (you are NOT done until every line passes)

Run `npm run ui:audit` plus the screenshot pass. All must be true:

- [ ] `contrast.mjs` exits 0 — **zero** WCAG AA failures
- [ ] `a11y.mjs` exits 0 — **zero** serious/critical axe violations, both locales, all routes
- [ ] `nojs.mjs` exits 0 — every public route shows h1 + sub + CTA with JS disabled
- [ ] Screenshots captured at 320/380/768/1280 for all 17 routes × both locales, **and you have
      read every one** — no overflow, no overlap, no truncated text, no collision
- [ ] Arabic screenshots are a correct mirror at every width; no physical CSS properties added
- [ ] FR/AR key parity still exact (re-verify programmatically; report the counts)
- [ ] `npx tsc --noEmit` clean, `npm run build` green
- [ ] Keyboard-only: every route fully operable, visible focus, no traps
- [ ] No hardcoded hex/px/shadow outside `globals.css` in any file you touched
- [ ] No fabricated data introduced anywhere, including JSON-LD
- [ ] Lighthouse mobile (throttled 3G, `/fr/yassine-math`): **Performance ≥ 80, Accessibility = 100**

---

## PHASE 7 — Iterate until validated (this is the part that matters)

**Loop, do not one-shot:**

1. Run the full harness. Record the failures.
2. Fix the highest-severity failure.
3. **Re-run the harness.** Read the new screenshots.
4. If anything regressed, revert that change and try a different fix.
5. Repeat until Phase 6 is 100% green.

**Rules for the loop:**
- **Never mark something fixed you have not re-measured.** "Should be fine now" is not a result.
- If a fix trades one failure for another, say so explicitly and ask me rather than guessing.
- Commit after each green iteration, so a regression is one `git revert` away.
- If you cannot make a criterion pass, **stop and report it** with what you tried. Do not lower
  the bar, do not delete the test, and do not quietly skip a route.

**Final deliverable — a report containing:**
- The before/after contrast table (real numbers)
- A list of every defect fixed, with file:line
- Anything you deliberately did NOT fix, and why
- The final harness output showing all-green
- 3–5 before/after screenshot pairs of the biggest visual improvements

---

## One last thing

The visual foundation here is genuinely good — the storefront and the Arabic RTL are better than
most shipping products. **You are polishing something that works, not rescuing something broken.**
Do not redesign. Do not introduce a new visual language. Do not add a UI library. Fix the
measurable defects, make the logged-in screens match the quality of the landing pages, and prove
it with numbers.
