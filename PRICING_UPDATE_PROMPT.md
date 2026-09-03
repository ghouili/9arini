# Prompt for Claude Code — Align the whole platform with the final pricing model

> Paste this as your prompt in Claude Code, from the repo root.

---

## The pricing model is now FINAL. This is the single source of truth.

Everything in the product, the docs and the metadata must match this table. Where it doesn't,
fix it. Where something says a number that isn't here, it is wrong.

### The plans (tutors are the paying customer)

| Plan | Price / month | Price / year | For |
|---|---|---|---|
| **Gratuit** | 0 TND | 0 | New tutor. Page, 1 class, booking, reviews. |
| **Essentiel** | 29 TND | 290 (2 months free) | 1–5 students. Up to 5 classes, SMS/WhatsApp reminders, basic stats. |
| **Pro** | 59 TND | 590 | 6–15 students. Unlimited classes, featured in /explore, sell materials, full stats. |
| **Prestige** | 99 TND | 990 | 15+ students. Top placement, lesson replays, priority verification (48h), priority support. |

### The commission

- **10%** — flat, all plans, all students.
- Charged **ONLY on payments that Tnajem actually processes.** If the student pays the tutor
  directly (cash, hand to hand), Tnajem takes nothing and never invoices for it.
- The **first session is always free** for the student. No commission on it.

### ⚠️ What is TRUE TODAY vs what is COMING — do not blur this

**TODAY (pilot):**
- Online payments are **OFF** (`PAYMENTS_ENABLED` disabled). Tnajem processes **nothing**.
- Therefore commission collected today = **0 TND**. The tutor genuinely keeps 100%.
- All plans are **free during the pilot**. Nobody is charged yet.

**LATER (when the BCT-compliant payment partnership exists):**
- Subscription plans go live at the prices above.
- 10% applies to payments processed through Tnajem.

**The rule:** the product may state future pricing as long as it is unmistakably labelled as
future. It must NEVER imply money is being taken today, and must never promise "0% forever."

---

## Your task

### PHASE 1 — Find every conflict

Grep the entire repo — including `.md` docs, `lib/i18n.ts`, every page-local `copy = {fr, ar}`
object, legal pages, metadata, and `llms.txt` — for:

```
88 %   88%   12 %   12%   commission   Commission   عمولة
"100 %"  "100%"  "tu gardes"  "تحتفظ"
"zéro commission"  "0 %"  "0%"  "aucune commission"
retrait  payout  "Retirer mes gains"  اسحب
abonnement  subscription  Pro  Plus  Premium  tarif  prix
```

**Report every hit with file:line before changing anything.** There are known conflicts:
- `/pour-les-profs` promises **"Tu gardes 100 %"** and **"0 % de commission"** — true today,
  false once payments launch. Needs a time qualifier, not deletion.
- A FAQ answer promises **"une commission de 12 %"** — the number is now **10%**.
- The income anchor block uses **88% / 12%** splits — now **90% / 10%**.
- `lib/i18n.ts` has dead payout strings (`"Les retraits arrivent sous 1–3 jours"`) — delete.
- `components/DashboardSidebar.tsx` renders "Retirer mes gains" unconditionally.

### PHASE 2 — Fix the copy

Rewrite so every claim is time-qualified and true. Suggested framing (adapt, keep it short):

**FR — tutor landing:**
> Gratuit pendant le pilote. Tu gardes 100 % de ce que tu gagnes.
> Plus tard : abonnement à partir de 29 TND/mois, et 10 % uniquement sur les paiements
> traités par Tnajem. Si ton élève te paie en main propre, on ne prend rien.

**Derija:**
> فابور في فترة التجربة. تحتفظ بـ 100 % من اللي تربحو.
> من بعد : اشتراك من 29 دينار في الشهر، و 10 % كان على الخلاص اللي يعدّي من Tnajem.
> كان التلميذ خلّصك في يدك، ما ناخذو والو.

Replace every 88/12 split with **90/10**. Update the income-anchor example arithmetic to match.

### PHASE 3 — Build the pricing page

Create **`/tarifs`** (FR) / **`/الأسعار`** or `/tarifs` with an Arabic locale, following the
existing routing pattern (`app/[locale]/tarifs/page.tsx`):

- The four plans as cards, Pro highlighted as the popular choice
- A prominent, honest banner: **"Gratuit pendant le pilote — aucune de ces offres n'est encore
  facturée."** / **"فابور في فترة التجربة — ما زال ما نفوترو حتى خطة."**
- The commission explained in one line: 10%, only on payments Tnajem processes, first session free
- A short comparison to make the value obvious — Preply 18–33%, Wyzant 25% + 9%, GoStudent ~35%.
  **Cite these as published rates, do not invent any competitor number.**
- Link it from the footer and from `/pour-les-profs`

Add the new strings to **both** locales. Key parity is enforced (`ar: typeof fr`) — a missing
Arabic key is a compile error, and that's deliberate.

### PHASE 4 — Fix the dashboard

- `components/DashboardSidebar.tsx` — gate the payout link behind `paymentsEnabled`
- Remove the dead payout strings from `lib/i18n.ts` (grep first to confirm nothing renders them)
- The dashboard must never imply a withdrawal is possible while payments are off

### PHASE 5 — Verify

1. `npx tsc --noEmit` clean, `npm run build` green
2. **Grep again** for `88`, `12 %`, `12%` in a pricing context — expect **zero** hits
3. Confirm FR/AR key parity programmatically; report the counts
4. Screenshot `/fr/tarifs` and `/ar/tarifs` at **320, 380, 768, 1280** and **look at them**
5. Confirm no page claims Tnajem takes money today
6. Confirm no page promises "0% forever"

**Report:** every conflict found (file:line), what you changed it to, and the screenshots.

---

## Guardrails

- **The truth rule stands.** No invented numbers, no fabricated social proof, no claim about
  payments that isn't true today. Future pricing must be labelled as future.
- **Don't break RTL** — logical CSS properties only, never `left`/`right`/`ml-`/`mr-`.
- **Don't break FR/AR parity** — every new string goes into both locales.
- **No new npm dependencies.**
- **Don't mark it done without reading the screenshots yourself.**
