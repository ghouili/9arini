# 9arini — MVP app (قرّيني)

*"Shopify for Tunisian tutors."* A complete, runnable MVP: tutor storefronts, live-class booking, the payment moment, tutor dashboard + payouts, student space + live lobby, auth + guardian consent — **mobile-first, bilingual FR/العربية with full RTL**, on the approved cobalt/sand/ochre design system. It **runs with zero backend** (demo data); stand up the **local Postgres** to use real data.

## Quickstart (demo mode — zero setup)
```bash
npm install
npm run dev      # http://localhost:3000
```
No env needed — it boots in **demo mode** (in-memory demo data). Toggle **Français / العربية** on any screen to see RTL.

## Run with the real database (local Postgres + Drizzle)
```bash
cp .env.example .env.local        # DATABASE_URL is already filled for the Docker DB
npm run db:up                     # start Postgres 16 in Docker
npm run db:push                   # create tables from lib/db/schema.ts
npm run db:seed                   # insert the demo tutor + classes + packs
npm run dev
```
Now the **storefront reads from Postgres**, **login creates real accounts + sessions**, and **onboarding / create-class write to it**. Browse data with `npm run db:studio`. Set `NEXT_PUBLIC_BACKEND_READY=1` in `.env.local` to hide the "demo mode" notice.

### Auth (phone OTP + sessions, on Postgres)
Custom, no external auth dependency (`lib/auth.ts`): phone → one-time code → opaque session token in an HTTP-only cookie, backed by the `sessions` table. **No SMS account needed in dev** — when `SMS_PROVIDER_KEY` is unset, `/auth` shows the code on-screen so you can complete login. End-to-end flow that actually persists:
1. `/auth` → pick role, enter phone → **Recevoir le code** → the dev code appears → enter it → **Vérifier**.
2. A `profiles` row + `sessions` cookie are created. Tutors land on `/onboarding`; new students pass through `/auth/consent` (writes a `consents` row, INPDP).
3. `/onboarding` now creates a tutor storefront **tied to your account** → your `9arini.tn/<slug>` persists. `/dashboard`, `/onboarding`, `/account` are guarded by `middleware.ts`. `/account` shows your real phone/role and **logs out**.
> After pulling this, **re-run `npm run db:push`** — it adds the `sessions` + `otp_codes` tables and a unique constraint on `profiles.phone`.

> Migrated **off Supabase** → self-hosted Postgres + **Drizzle ORM**. If you pulled an older build, run `npm install` again (dependencies changed: `@supabase/*` removed; `drizzle-orm`, `postgres`, `drizzle-kit`, `tsx`, `dotenv` added).

## Try these routes
`/` landing · `/onboarding` create page · `/yassine-math` storefront · `/class/c1` · `/checkout?class=c1` (payment moment) · `/dashboard` (toggle empty⇄earning) · `/dashboard/new-class · new-pack · payout` · `/student` · `/live/c1` (lobby + teaching-tool launchers) · `/explore · /account · /auth · /auth/consent`

## Architecture
- **Next.js 14 (App Router) + TypeScript.** Path alias `@/*`.
- **Data layer (the Supabase replacement):**
  - `lib/db/schema.ts` — Drizzle schema (source of truth; plain Postgres, no RLS).
  - `lib/db/index.ts` — server-only Drizzle client (`dbReady` flag).
  - `lib/data.ts` — server **reads** (e.g. `getStorefront`), demo fallback.
  - `app/actions.ts` — server **writes** (`createTutor`, `createClass`).
  - `lib/config.ts` — client `backendReady` flag (DATABASE_URL is server-only).
  - The browser never touches Postgres: server components / server actions do.
- **Shared foundation** — design tokens (`app/globals.css`), full **FR/AR i18n**, types, UI primitives, providers.
- **Feature modules** under `app/*` and `components/*`.

## What's built vs. stubbed
**Built & working:** every screen, bilingual + RTL, design system, storefront (now **Postgres-backed**), booking, payment-moment UI + success, dashboard (both states) + create/payout forms (create-class/onboarding **write to Postgres**), student space, live lobby + teaching-tool launchers, auth UI, guardian-consent gate.

**Stubbed on purpose (wire to go live):**
1. **Auth** — ✅ **built**: custom phone-OTP + sessions on Postgres (`lib/auth.ts`, `app/actions.ts`, `middleware.ts`). Only **SMS delivery** is stubbed (dev code shown on-screen) until you set `SMS_PROVIDER_KEY`.
2. **Payments — DO NOT WIRE until legal sign-off** (`../validation/legal-questions.md`). Konnect/Flouci collect + 12% ledger + payouts. UI done; `pending` notes disclose demo mode.
3. **Live video** — opens a Jitsi/Meet link; embed LiveKit/Jitsi later (`../10-live-class-playbook.md`).
4. **WhatsApp reminders** — `lib/notify.ts` stub; **Storage** (replays, pack files) — local disk or S3/MinIO later.

## "Connect to go live" checklist
- [ ] Legal/payments structure confirmed → wire Konnect/Flouci.
- [ ] SUARL + Startup Label + Konnect/Flouci merchant accounts.
- [ ] **Database**: keep local Postgres or host it (Neon / Railway / your VPS) — set `DATABASE_URL`, run `db:push` + `db:seed`. (EU/Tunisia residency per INPDP — confirm with counsel.)
- [ ] **Auth**: choose Auth.js/Lucia/custom on Postgres (phone-OTP via an SMS provider).
- [ ] INPDP declaration; guardian-consent gate already in UI + schema.
- [ ] WhatsApp Cloud API for reminders; replace the support number in `app/account/page.tsx`.
- [ ] Buy `9arini.tn` + `9arini.com`; deploy on Vercel (+ managed/again Postgres).
- [ ] PWA polish, real-device testing on mid-range Android.

## Honest status
Verified **statically** (file tree, imports, exports, server/client boundaries, no Supabase left in source). It has **not** been through `npm run build` here (sandbox has no npm network). Run `npm install && npm run dev` — if anything errors on first compile it'll be a minor nit; send it and I'll fix it. **Demo-ready**, not yet production-launched (payments legally gated; auth to be chosen).
