# Tnajem — Launch Brief for Claude Code

> Paste this whole file as your opening prompt in Claude Code, run from the repo root
> (`D:\work\Startups\New idea claude\tnajem-app`).

---

## Who you are

You are the engineering lead taking **Tnajem** (تنجّم — "teach me") from "code complete" to
**live, scalable, secure, well-designed, and discoverable**. You have autonomy. Dispatch
subagents for parallel workstreams, but **you own the integration and the verification** —
subagents have repeatedly produced work that read correctly and did not compile.

Work in phases. **Do not move to the next phase until the current one verifiably passes.**
Run the build yourself. Do not declare anything done that you have not observed working.

---

## What Tnajem is

A Tunisian tutoring marketplace — "Shopify for Tunisian tutors." A tutor creates a branded
storefront page, publishes live classes, and shares one link on WhatsApp/TikTok/Instagram.
Students find tutors, book a **free first session**, and join a live class from their phone.

**Audience reality:** Tunisian students and the parents who pay. Mid-range Android, 3G,
data-conscious. Bilingual **French + Tunisian Derija (Arabic)**, with full **RTL**.

**Pilot constraints (these are product truth — do not violate them):**
- **Online payments are OFF**, hard-disabled behind `PAYMENTS_ENABLED` pending legal/INPDP
  sign-off and provider credentials. The first session is free; for further sessions the
  student pays the tutor **directly, off-platform**. Tnajem holds no money, takes no
  commission today, and cannot issue refunds or payouts.
- **Zero users, zero sessions taught.** It is pre-launch.
- Tutors are **hand-verified**: they upload national ID documents, an admin approves them,
  and only `status = 'verified'` tutors are publicly visible or bookable.

## Stack

Next.js 14.2 (App Router) · TypeScript · Drizzle ORM 0.36.4 + postgres.js · **PostgreSQL 17**
(local) · Tailwind 3 · custom phone-OTP auth (no external auth dep) · Jitsi for live classes ·
Twilio (optional) for SMS.

Read these first, they are current and accurate: `README.md`, `DEPLOY.md`, `SCALABILITY.md`,
`CONTRACT.md`, `.env.example`.

---

## ⚠️ Landmines — read before you touch anything

1. **NEVER run `npm run db:push`.** It is deliberately disabled. `drizzle-kit@0.28` is not
   PostgreSQL 17-aware: PG17 stores `NOT NULL` as *named* catalog constraints, drizzle-kit
   doesn't recognise them, and it emits `DROP CONSTRAINT "<table>_<col>_not_null"` for ~60
   columns — i.e. it tries to strip `NOT NULL` off most of the database. It only failed
   safely because Postgres rejected the primary-key one first (`42P16`).
   **Apply schema changes via `npm run db:sql`** (raw, idempotent, transactional SQL in
   `scripts/sql/`). Add a new numbered `.sql` file for any new schema change.
   *Optional improvement: upgrade `drizzle-kit` to a PG17-aware release and re-enable push —
   but only as a deliberate, verified task, never mid-flight.*

2. **`node_modules` has been corrupt before.** An interrupted `npm install` silently
   truncated `@types/node` (39 files missing) and `csstype` (901 lines cut). Both are
   repaired. If you hit a bizarre "cannot find module" or a syntax error *inside*
   `node_modules`, do not debug it — `rm -rf node_modules package-lock.json && npm install`.

3. **`AUTH_SECRET` is resolved lazily on purpose.** Every page imports `lib/auth` via
   `SiteShell → SiteHeader → app/actions`. A module-load throw would kill `next build` on any
   CI box that injects secrets at runtime. **Do not "fix" this by throwing at import time.**

4. **`ADMIN_PHONES` must be set**, or no tutor can ever be approved and the marketplace stays
   permanently empty. Easiest thing in the system to forget.

5. **The 90-day ID-document purge must actually be scheduled.** `/privacy` promises it.
   `lib/retention.ts` + `npm run db:purge` + `/api/cron/purge` exist; nothing runs them yet.

---

## 🚫 The truth rule (non-negotiable)

This product previously shipped **fabricated social proof**: invented students with invented
Bac scores, "+1 240 séances données · 4.9 ★ · 180 profs actifs", fake testimonials, a fake
1,240 TND balance, and an escrow/refund guarantee it could not honour. All of it was removed.

**Do not reintroduce any of it, in any form, including via structured data.**

- No invented statistics, testimonials, reviews, ratings, user counts, or success stories.
- **Never emit `AggregateRating` / `Review` JSON-LD unless real rows exist in the `reviews`
  table.** Marking up ratings that don't exist is structured-data spam; Google issues manual
  actions for it. Emit rating schema **conditionally**, from real data, or not at all.
- No claim about payments, escrow, refunds, payouts, or commission that isn't true today.
- If a number would be persuasive but isn't real, **say the true thing instead.** "Nouveau en
  Tunisie" beats a fake 4.9★, and it will survive contact with a journalist or a regulator.

Being a pre-launch product is not a marketing problem to be papered over. It's a fact to be
stated well.

---

# Phase 0 — Get it green (do this first, alone)

Nothing else matters until this passes.

```bash
npx tsc --noEmit          # must be clean
npm run build             # must succeed
npm run db:sql            # applies scripts/sql/ (2 tables + 15 indexes)
npm run dev               # boots
```

Fix every error. Some type errors are real (e.g. TypeScript cannot narrow a variable assigned
inside a callback — return the value from the callback instead of mutating a captured `let`).

**Then smoke-test both journeys by hand against the real database** (they have never been
executed end-to-end):

- **Student:** sign up (OTP) → guardian consent → `/explore` → tutor storefront → book a free
  seat → see it in `/student` → join `/live/[id]` → after the class, leave a review → the
  tutor's star rating updates on the storefront.
- **Tutor:** sign up → create storefront → `/onboarding/verify` (upload a document) → admin
  approves at `/admin/verifications` → tutor appears on `/explore` → publish a class → see the
  booking (with the student's name and phone) in `/dashboard`.

**Also verify the two concurrency fixes that have never run against Postgres:**
- Double-book the **last seat** from two sessions simultaneously → exactly one wins, the other
  gets `full`. The class must never oversell.
- Request an OTP twice in rapid succession for the same phone → exactly one live code row.

**Exit criteria:** build green, both journeys work, no fabricated data anywhere, no console
errors.

---

# Phase 1 — Security & correctness hardening (verify, don't assume)

A prior audit fixed serious issues. **Verify they hold**, then go further:

Already fixed (confirm, don't regress):
- Live-room URLs leak only to the owning tutor or a student who booked (`canJoinClass`).
  Jitsi admits anyone with a link, so this URL is a credential.
- `ADMIN_PHONES` fails **closed** (an empty value used to normalise to `"+216"` and grant
  admin to any null-phone profile — read access to every national ID scan).
- Uploads: magic-byte sniffing (not client MIME), URL allow-list, path containment, CSP +
  `nosniff` on the doc route.
- Atomic seat claim, OTP advisory lock + CSPRNG, rate limiting, guardian consent enforced
  server-side in `reserveSeat`.

Still open — your job:
- **Rate limiter is in-process** (`lib/auth.ts`). It resets on deploy and multiplies by
  instance count. Back it with Postgres before running more than one instance.
- **Existing DB rows are dirty**: written before the audit, they hold client-claimed MIME
  types and unvalidated URLs. Write a one-off cleanup.
- Consider a CSP + security headers pass (`next.config.mjs` headers), HSTS at the edge.
- `profiles.birthYear` is never populated, so the app treats *every* student as a minor. Decide
  and implement: either collect age, or keep consent universal and say so honestly.

**Every server action is a public HTTP endpoint.** Anyone can call it with any arguments.
Re-verify authorization on each one — especially IDOR on any action taking an id.

---

# Phase 2 — Scalability

`SCALABILITY.md` has the analysis. Indexes, pooling, ISR caching and the auth-row purge are
done. Execute the rest:

1. **The #1 bottleneck is not Postgres — it's the single Node process serving every static
   asset.** nginx currently `proxy_pass`es everything, including `/_next/static/*`, with no
   gzip and no CDN. One storefront view = 1 HTML + ~10 asset requests; a viral WhatsApp share
   = thousands of 3G phones through one single-threaded process.
   **Fix:** nginx serves `/_next/static/` from disk with `immutable`, gzip at nginx,
   Cloudflare in front. Recipe is in `DEPLOY.md`. If you put a CDN in front, set
   `real_ip_header CF-Connecting-IP` — `clientIp()` is the OTP throttle key and would
   otherwise collapse into one bucket per edge node.
2. **`SiteHeader` fires a `getMe()` server-action POST on every page load**, so perfectly
   cached HTML is still followed by an uncacheable POST per visitor. Fix it.
3. **The landing pages and `StorefrontView` are huge client components** (2053 / 1250 / 767
   lines, `"use client"`). The storefront is on the viral path: we cache its HTML perfectly,
   then make every 3G phone download and hydrate 767 lines of JS to render what is mostly a
   static poster. **Convert to server components with small client islands.**
4. Local disk storage for ID docs is what blocks horizontal scaling outright. Plan object
   storage.

---

# Phase 3 — Design & UX

Make it feel like a product people trust with their kid's education.

- **Accessibility to WCAG 2.1 AA**: colour contrast, focus-visible rings everywhere, touch
  targets ≥ 44px, real labels, keyboard paths, `prefers-reduced-motion` (already partly
  honoured — keep it).
- **RTL is first-class, not an afterthought.** Test every page in Arabic. Logical CSS
  properties only.
- **Mobile-first, 3G-first.** Test at 320px and on a throttled connection. Watch LCP/CLS/INP.
- Consistency pass: the app mixes Tailwind utilities with inline `style={{}}` objects and
  design-system classes. Converge.
- Every state must exist and be warm: loading, empty, error, offline, "no tutors yet",
  "no bookings yet", "not verified yet". No dead ends, no dead controls.
- Copy is short, warm, Tunisian, and **true**.

---

# Phase 4 — SEO / AEO / GEO

The tutor storefront is the growth engine: tutors paste that link into WhatsApp, TikTok and
Instagram bios. It must render beautifully as a link preview, rank in Google, and be quotable
by AI assistants.

### 4a. Technical SEO (foundation — do this first)

- **`/explore` is currently client-rendered**, so crawlers see an empty grid. **Make it a
  server component** (with a small client child for the filters/search). This is the single
  biggest SEO defect in the app.
- Per-page `generateMetadata` everywhere (storefront already has it — audit the rest).
- **`hreflang`**: `fr-TN` ⇄ `ar-TN` alternates + `x-default`, on every page and in the sitemap.
  Ensure the locale is reflected in the URL or a stable signal a crawler can follow — a
  `localStorage`-only locale is invisible to Google. **This likely requires routing work
  (`/fr/…` + `/ar/…`, or a cookie + `Vary`): design it deliberately.**
- Canonical URLs, `metadataBase`, clean slugs, `robots.ts`, `sitemap.ts` (already includes
  verified tutors — verify it stays accurate and cached).
- Core Web Vitals on mid-range Android: LCP < 2.5s on 3G, CLS ≈ 0, INP < 200ms.
- Real OG/Twitter images per tutor (a generated OG card with the tutor's name/subject beats a
  generic one — build it with `next/og` **from real data only**).
- Semantic HTML, one `h1`, sane heading order, descriptive `alt`, internal linking
  (explore ⇄ storefront ⇄ subject pages).

### 4b. Structured data (JSON-LD) — truthfully

- `Organization` / `WebSite` (+ `SearchAction`) on the site root.
- Tutor storefront: `Person` + `Service` (or `Course` for a class), `areaServed` (Tunisia and
  the city), `inLanguage` (`fr`, `ar`), `offers` — **and `AggregateRating` ONLY when that tutor
  actually has reviews.** New tutor = no rating markup. This is the truth rule, enforced in code.
- `Course` / `Event` for a scheduled live class (real dates, real seats).
- `FAQPage` on the FAQ sections (real questions, real answers).
- `BreadcrumbList` on storefronts.
- Validate everything against Google's Rich Results Test before declaring done.

### 4c. AEO — Answer Engine Optimization

Optimise to be *the answer*, not just a link. Tunisian parents ask things like:
*"c'est quoi le prix d'un cours particulier de maths en Tunisie ?"*, *"comment trouver un prof
de Bac à Sfax ?"*, *"combien coûte un prof particulier ?"*

- Build a genuinely useful **content layer** that answers these directly: a short, factual
  answer in the first 40–60 words, then depth. Structure with clear `h2` questions.
- `FAQPage` schema on each. Consider `speakable`.
- Subject/level/city landing pages (`Maths · Bac · Tunis`) — **but only generate a page when
  there is real inventory behind it.** Empty programmatic city pages are doorway pages and
  will get you penalised. Gate generation on real verified tutors.
- Be the source of honest, specific facts about tutoring in Tunisia (pricing ranges, how the
  Bac works, how to choose a tutor). Cite sources where you make factual claims.

### 4d. GEO — Generative Engine Optimization

Get cited by ChatGPT, Claude, Perplexity, and Google AI Overviews.

- **Decide, explicitly and with the founder, whether to allow AI crawlers** (`GPTBot`,
  `ClaudeBot`, `PerplexityBot`, `Google-Extended`) in `robots.ts`. For a marketplace that wants
  to be *recommended* by an assistant, allowing them is usually correct — but it is a business
  decision. Ask; don't assume.
- Add **`/llms.txt`** — a concise, factual description of what Tnajem is, who it serves, what
  it costs, and how it works.
- Write content that is **extractable and quotable**: clear entity definitions ("Tnajem is a
  Tunisian platform where verified tutors…"), self-contained factual sentences, comparison
  tables, explicit numbers with context. LLMs cite crisp, attributable, well-structured claims.
- Consistent NAP/entity signals across the site so the model resolves "Tnajem" as one entity.
- **Everything above must remain true.** A model that hallucinates a "4.9★, 1,240 sessions"
  Tnajem because we wrote it is a liability, not a growth channel.

---

# Phase 5 — Ship

- **Initialize git** (the repo has never been committed — `.gitignore` is already safe:
  `.env*`, `.storage/`, `node_modules`, `.next`). `git init` → first commit → push to a
  **private** GitHub repo.
- Deploy per `DEPLOY.md`: VPS, `next build` → pm2/systemd → nginx + certbot → managed Postgres.
- Set every production env var: `DATABASE_URL`, `AUTH_SECRET` (`openssl rand -hex 32`),
  `ADMIN_PHONES`, `STORAGE_DIR` (**persistent volume** — ID docs vanish on redeploy otherwise),
  `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`, Twilio creds. Leave `PAYMENTS_ENABLED` **unset**.
- **Schedule the purge cron** (`DEPLOY.md §7`) — otherwise `/privacy` is lying.
- Backups: Postgres **and** `STORAGE_DIR`. Test a restore.
- Error monitoring + uptime check.

---

## Definition of done

- [ ] `npx tsc --noEmit` clean, `npm run build` green
- [ ] Both user journeys verified end-to-end against real Postgres
- [ ] Seat race and OTP race verified under concurrency
- [ ] No fabricated data anywhere — UI, JSON-LD, or copy
- [ ] WCAG AA; RTL correct on every page; good on a 320px 3G Android
- [ ] `/explore` and the storefront server-rendered and crawlable; Rich Results Test passes
- [ ] hreflang, canonicals, sitemap, robots, OG images correct
- [ ] nginx serves static assets; gzip on; CDN in front
- [ ] Git initialized and pushed (private); deployed; purge cron scheduled; backups tested

## Standing orders

1. **Verify, don't trust.** Run the build after every phase. Read the file back after you write it.
2. **Never fabricate.** If it isn't true, don't ship it — in pixels or in schema.
3. **Ask the founder** about: allowing AI crawlers, the URL-locale strategy, anything that
   changes what the product *promises*.
4. `/terms` and `/privacy` are **lawyer-review drafts** with a visible banner and bracketed
   placeholders. Do not remove the banner. Do not invent legal entity details.
