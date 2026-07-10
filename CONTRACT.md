# 9arini-app — build contract (read before adding code)

The shared foundation is DONE. Build features against it; **do not edit** the shared files (`app/globals.css`, `app/layout.tsx`, `lib/i18n.ts`, `lib/types.ts`, `lib/supabase.ts`, `lib/demo.ts`, `components/{icons,ui,LocaleProvider,LocaleToggle,BottomNav}.tsx`).

## Stack & conventions
- **Next.js 14 App Router + TypeScript.** Path alias `@/*` → repo root.
- Interactive pages/components → add `"use client"` at top. Pure presentational → no directive.
- **i18n:** `import { useLocale } from "@/components/LocaleProvider"; const { t, locale } = useLocale();` then `t.<namespace>.<key>`. RTL is automatic (provider sets `dir`). If you truly need a missing string, add it inline in FR + leave a `// TODO i18n` — do NOT edit `lib/i18n.ts`.
- **Styling:** use the global CSS classes (see globals.css) + inline styles for specifics. No Tailwind, no CSS files.
- **Layout:** wrap each screen in `<Frame>` (from `@/components/ui`). Mobile-first (~390px). Use `<StatusBar/>` at top of full screens.
- **Data:** import demo data from `@/lib/demo` (app runs with NO backend). Optionally enhance with Supabase via `@/lib/supabase` guarded by `supabaseReady`, always falling back to demo.
- **Icons:** `import { Star, Clock, ... } from "@/components/icons"`.
- **Primitives:** `import { Frame, StatusBar, Button, Card, Chip, Avatar, Field, Spinner, Verified } from "@/components/ui"`.

## Route ownership (disjoint — no overlaps)
| Module | Routes | Components folder |
|---|---|---|
| **A. Onboarding + Storefront** | `app/onboarding/page.tsx`, `app/[slug]/page.tsx` | `components/storefront/*` |
| **B. Class + Payment** | `app/class/[id]/page.tsx`, `app/checkout/page.tsx` | `components/checkout/*` |
| **C. Tutor dashboard** | `app/dashboard/page.tsx`, `app/dashboard/new-class/page.tsx`, `app/dashboard/new-pack/page.tsx`, `app/dashboard/payout/page.tsx` | `components/dashboard/*` |
| **D. Student + Live** | `app/student/page.tsx`, `app/live/[id]/page.tsx`, `app/explore/page.tsx` | `components/student/*` |
| **E. Auth + Home** | `app/page.tsx`, `app/auth/page.tsx`, `app/auth/consent/page.tsx`, `app/account/page.tsx`, `app/messages/page.tsx` | — |

## Cross-route links (use these exact hrefs)
- Storefront class card → `/class/<id>`; storefront CTA & class "book" → `/checkout?class=<id>`.
- Checkout success → `/student`. Dashboard cash-out → `/dashboard/payout`. Student upcoming → `/live/<id>`. Home → `/onboarding`, `/yassine-math`, `/auth`. BottomNav covers `/student /explore /messages /account`.

## Quality bar
Match the approved aesthetic in `../05-hero-mockups.html` (Sidi-Bou-Saïd cobalt + sand + ochre, Space Grotesk numerals, zellige header texture, generous radii). Every screen screenshot-worthy, bilingual, mobile-first. Include empty states and the payment moment's trust signals.
