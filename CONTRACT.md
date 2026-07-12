# 9arini-app — build contract (read before adding code)

The shared foundation is DONE. Build features against it; **do not edit** the shared files (`app/globals.css`, `app/layout.tsx`, `lib/i18n.ts`, `lib/types.ts`, `lib/demo.ts`, `components/{icons,ui,LocaleProvider,LocaleToggle}.tsx`).

> **Stale-doc warning.** This file predates the Supabase → Postgres/Drizzle migration and the P1/P2 passes. Route ownership below is historical. When it disagrees with the code, the code wins.

## Stack & conventions
- **Next.js 14 App Router + TypeScript.** Path alias `@/*` → repo root.
- Interactive pages/components → add `"use client"` at top. Pure presentational → no directive.
- **i18n:** `import { useLocale } from "@/components/LocaleProvider"; const { t, locale } = useLocale();` then `t.<namespace>.<key>`. RTL is automatic (provider sets `dir`). If you truly need a missing string, add it inline in FR + leave a `// TODO i18n` — do NOT edit `lib/i18n.ts`.
- **Styling:** use the global CSS classes (see globals.css) + inline styles for specifics. No Tailwind, no CSS files.
- **Layout:** wrap each screen in `<Frame>` (from `@/components/ui`). Mobile-first (~390px). Use `<StatusBar/>` at top of full screens.
- **Data:** the app is backed by **local Postgres + Drizzle**. Server reads → `@/lib/data`; mutations → server actions in `@/app/actions`. Both are gated on `dbReady` (from `@/lib/db`). When `DATABASE_URL` is unset they fall back to the fixtures in `@/lib/demo` **in development only** — `demoEnabled` (in `lib/demo.ts`) is false in production, the fixtures are inert there, and `getStorefront()` throws rather than serve a fabricated tutor. **Any new `!dbReady` branch must check `demoEnabled` too**: a prod boot with no DB must produce an honest error/empty state, never demo data. *(Supabase is gone — `lib/supabase.ts` and `supabase/` were deleted; there is no `supabaseReady` flag.)*
- **Sensitive data:** tutor ID scans live under `STORAGE_DIR` + the `verification_docs` table. `/privacy` promises they are deleted **90 days after the verification decision** — that promise is kept by `lib/retention.ts` (`npm run db:purge`, or the cron route `/api/cron/purge`). If you add a new store of ID documents, it must be purged there too.
- **Icons:** `import { Star, Clock, ... } from "@/components/icons"`.
- **Primitives:** `import { Frame, StatusBar, Button, Card, Chip, Avatar, Field, Spinner, Verified } from "@/components/ui"`.

## Route ownership (disjoint — no overlaps)
| Module | Routes | Components folder |
|---|---|---|
| **A. Onboarding + Storefront** | `app/onboarding/page.tsx`, `app/[slug]/page.tsx` | `components/storefront/*` |
| **B. Class + Payment** | `app/class/[id]/page.tsx`, `app/checkout/page.tsx` | `components/checkout/*` |
| **C. Tutor dashboard** | `app/dashboard/page.tsx`, `app/dashboard/new-class/page.tsx`, `app/dashboard/new-pack/page.tsx`, `app/dashboard/payout/page.tsx` | `components/dashboard/*` |
| **D. Student + Live** | `app/student/page.tsx`, `app/live/[id]/page.tsx`, `app/explore/page.tsx` | `components/student/*` |
| **E. Auth + Home** | `app/page.tsx`, `app/auth/page.tsx`, `app/auth/consent/page.tsx`, `app/account/page.tsx` | — |

## Cross-route links (use these exact hrefs)
- Storefront class card → `/class/<id>`; storefront CTA & class "book" → `/checkout?class=<id>`.
- Checkout success → `/student`. Dashboard cash-out → `/dashboard/payout`. Student upcoming → `/live/<id>`. Home → `/onboarding`, `/explore`, `/auth`.
- **Auth redirects:** guarded routes bounce guests to `/auth?next=<relative-path>` (see `middleware.ts`). `/auth` honours `next` only when it is a safe **relative** path; guardian consent still takes priority for students. There is no `/messages` route — it was deleted.

## Quality bar
Match the approved aesthetic in `../05-hero-mockups.html` (Sidi-Bou-Saïd cobalt + sand + ochre, Space Grotesk numerals, zellige header texture, generous radii). Every screen screenshot-worthy, bilingual, mobile-first. Include empty states and the payment moment's trust signals.
