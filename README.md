# Tnajem — تنجّم

*"Shopify for Tunisian tutors."* Every verified tutor gets a public storefront at `tnajem.tn/<slug>` — their live classes, their packs, their **real** reviews — and a link they can paste on WhatsApp, TikTok or Insta. Students book a seat; the first session is free.

Mobile-first, bilingual **FR / العربية with full RTL**, on the cobalt/sand/ochre design system.

---

## Quickstart

```bash
npm install
cp .env.example .env.local     # set DATABASE_URL (+ AUTH_SECRET)
npm run db:push                # create tables from lib/db/schema.ts
npm run db:seed                # optional: one demo tutor for local dev
npm run dev                    # http://localhost:3000
```

You need a **Postgres** running (local install, or a free Neon DB — no Docker; the `db:up` script is gone). Browse the data with `npm run db:studio`.

**Without `DATABASE_URL`** the app still boots **in development** on in-memory fixtures (`lib/demo.ts`), so you can see every screen with zero setup. That fallback is **hard-disabled in production**: a prod boot with no database throws (`DatabaseNotConfiguredError` in `lib/data.ts`) and serves the 500 page instead of inventing a tutor. See *Demo mode* below.

---

## What the app actually does

**Auth — phone OTP, no external provider.** `lib/auth.ts`: phone → 6-digit code → opaque session token in an HTTP-only cookie, backed by the `sessions` + `otp_codes` tables. SMS goes out via Twilio (`lib/sms.ts`, provider-agnostic) when `TWILIO_*` is set; **in dev, with no SMS credentials, the code is shown on-screen** so you can complete login. Never in production.

**Guardian consent (INPDP).** A minor is routed to `/auth/consent` before they can use the app; signing writes a `consents` row. `?next=` is carried through the whole flow (auth → consent → wherever they were going), behind an open-redirect guard.

**Tutors are hand-verified — one by one.** `/onboarding` creates the storefront (status `draft`), `/onboarding/verify` uploads identity documents, and a human approves or rejects in `/admin/verifications` (gated by `ADMIN_PHONES`). **Only `status = "verified"` tutors are public** — on `/explore`, on `/[slug]`, and in the sitemap. Everyone else 404s.

**Reviews are real.** One review per (student, class), writable only by a student who actually booked it, only after the class started (`createReview` in `app/actions.ts`). `tutors.rating` / `students_count` are recomputed from the `reviews` / `bookings` tables. **A tutor with no reviews shows "Nouveau" — never a fabricated star score.** A tutor with no published class shows an honest empty state, not a broken booking button.

**Free first session.** `classes.is_free_first` — booking it takes a seat and creates a `booking`, no money involved.

**Live classes — Jitsi, one room per class.** `lib/live.ts` derives the room from the class id (`https://meet.jit.si/tnajem-<classId>`), so tutor and student always compute the same URL and the "Rejoindre" button is never blank. A tutor can override it with their own Zoom/Meet/Jitsi link via `classes.meet_url`.

**Payments — OFF.** Nothing in this app moves money. `lib/payments.ts` is a provider-agnostic scaffold (Konnect / Flouci adapters, both stubs) behind a master switch: `paymentsEnabled()` is true **only** when `PAYMENTS_ENABLED=1`. While off, every adapter method throws and the tutor balance is a real `0` — we never fabricate earnings. Do not flip it until counsel signs off **and** the provider contract + webhook signature verification exist.

**ID-document retention.** `/privacy` promises identity documents are deleted at most **90 days** after the verification decision. That promise is kept by `lib/retention.ts` — but **only if the purge is actually scheduled**. Run it as a cron: `npm run db:purge`, or `POST /api/cron/purge` with a `CRON_SECRET` bearer token. **See DEPLOY.md — this is a launch blocker, not a nice-to-have.**

**Notifications.** In-app `notifications` rows are the always-on channel; SMS is best-effort on top (`lib/notify.ts`). WhatsApp reminders are **not** built.

---

## Architecture

- **Next.js 14 (App Router) + TypeScript.** Path alias `@/*`. Postgres + **Drizzle** (no Supabase — it was removed; there is no `supabaseReady` flag and no `lib/config.ts` / `backendReady` flag either).
- `lib/db/schema.ts` — Drizzle schema, the source of truth. Plain Postgres, no RLS: **authorization is enforced in the server layer**, not the database.
- `lib/db/index.ts` — server-only client. `dbReady` is false when `DATABASE_URL` is unset.
- `lib/data.ts` — server **reads** (`getStorefront`, `getPublicTutorRefs`). Owns the demo-vs-production gate.
- `app/actions.ts` — server **writes** (`verifyOtp`, `createTutor`, `createClass`, `bookClass`, `createReview`, …) + reads that need the session.
- `lib/demo.ts` — dev-only fixtures. Inert in a production build.
- `middleware.ts` — route guards (`/dashboard`, `/student`, `/onboarding`, `/account`, `/live`), bounces guests to `/auth?next=…`.
- The browser never touches Postgres: server components and server actions do.

## Routes

`/` landing · `/pour-les-profs` tutor landing · `/explore` marketplace · `/<slug>` storefront · `/class/[id]` · `/checkout?class=<id>` · `/live/[id]` · `/dashboard` (+ `new-class`, `new-pack`, `payout`) · `/student` · `/onboarding` (+ `/verify`) · `/admin/verifications` · `/account` · `/auth` (+ `/consent`) · `/terms` · `/privacy`

There is **no** `/messages` route.

## Scripts

| script | what it does |
| --- | --- |
| `npm run dev` / `build` / `start` / `lint` | Next.js |
| `npm run db:push` | apply `lib/db/schema.ts` to the database |
| `npm run db:generate` / `db:migrate` | versioned migrations (use these in production) |
| `npm run db:studio` | Drizzle Studio |
| `npm run db:seed` | one demo tutor, **local dev only** (refuses to run with `NODE_ENV=production`) |
| `npm run db:purge` | delete expired ID documents. `-- --dry-run` to preview |

## Demo mode (development only)

With no `DATABASE_URL`, **in development**, `lib/data.ts` serves the fixtures in `lib/demo.ts` and any slug resolves to the demo storefront. Handy; also a loaded gun.

The demo tutor is described as *verified, 4.9★, 1,240 students*. None of it is real. So the gate is the **environment**, not the database:

- `demoEnabled === (process.env.NODE_ENV !== "production")`.
- In a production build the fixtures are **inert** (empty arrays; a zeroed, unverified, unrated storefront) — the fake rating isn't even in the bundle.
- `getStorefront()` **throws** in production when `dbReady === false`. It does not return `null`: a site-wide 404 storm would tell Google to deindex every real tutor page, while a 5xx honestly says "we are broken" — and pages us.

If production ever serves the 500 page on every storefront, the cause is a missing `DATABASE_URL`. That is the intended behaviour.

## Before real users

- [ ] **Schedule the ID-doc purge** (`CRON_SECRET` + a daily cron — DEPLOY.md §7). `/privacy` already promises it.
- [ ] `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_PHONES`, `NEXT_PUBLIC_SITE_URL` set; `STORAGE_DIR` on a **persistent volume**.
- [ ] Real SMS credentials (`TWILIO_*`) — otherwise nobody outside dev can log in.
- [ ] Leave `PAYMENTS_ENABLED` unset until legal sign-off. The payout UI is gated on it.
- [ ] INPDP declaration; EU/Tunisia data residency confirmed with counsel.
- [ ] Buy `tnajem.tn`; deploy per DEPLOY.md.

## Honest status

Verified **statically** — imports/exports, server/client boundaries, no Supabase and no `lib/config.ts` left in source. It has **not** been run through `npm run build` in this environment. Payments are legally gated and off. Everything else is wired to real data.
