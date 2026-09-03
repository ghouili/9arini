# Prompt for Claude Code — VERIFY the pricing work, then finish it

> Paste this whole file as your prompt in Claude Code, from the repo root.

---

## Read this first

You were previously given a brief to align the platform with a new pricing model.
**I cannot see any changes.** Either the work wasn't done, or it was done somewhere I'm not
looking, or it was reported as done without being done.

**Do not defend the previous work. Do not assume it happened. Prove it from evidence, or prove
it didn't.** An honest "it was never done" is a useful answer. A false "it's all complete" is
not, and I will check.

---

# PART 1 — VERIFY (evidence only, no self-report)

Do all of this before changing a single line.

## 1.1 — What actually changed on disk?

```bash
git status
git log --oneline -20
git diff HEAD~5 --stat        # adjust the range as needed
```

- Are there uncommitted changes? Which files?
- Do any recent commits mention pricing, tarifs, commission, or plans?
- **If `git status` is clean and no commit touches these files, the work was not done.
  Say so plainly and move to Part 2.**

## 1.2 — Do the required artefacts exist?

```bash
ls app/[locale]/tarifs/ 2>/dev/null || echo "MISSING: /tarifs page does not exist"
```

Report a simple table: **exists / does not exist** for each of these:
- `app/[locale]/tarifs/page.tsx`
- A link to `/tarifs` in `components/SiteFooter.tsx`
- A link to `/tarifs` from `/pour-les-profs`

## 1.3 — Grep for values that MUST BE GONE

Search the whole repo — `app/`, `components/`, `lib/`, and `.md` docs:

```
"88 %"   "88%"   "12 %"   "12%"
"Sans carte bancaire"   "sans carte"   "بلا كارت"   "من غير كارت"
"aucun abonnement"   "Aucun"   "بلا اشتراك"   "والو"
"Les retraits arrivent"   "Retirer mes gains"   "اسحب أرباحي"
```

**Report every hit with file:line and the surrounding line of text.**
Any hit = the work is incomplete.

## 1.4 — Grep for values that MUST EXIST

```
"10 %"  "10%"  "Essentiel"  "Prestige"  "29"  "59"  "99"  "tarifs"
```

**Report what you find and what is missing.**

## 1.5 — Check the rendered page, not the source

Start the dev server. Load `/fr/pour-les-profs` and `/fr/tarifs` in a real browser (Playwright,
Puppeteer, browser MCP — whatever you have). **Screenshot them and LOOK at the images.**

Does the rendered page show the old numbers or the new ones? Source code that says the right
thing but renders the wrong thing usually means a stale `.next` cache or an unrestarted dev
server — check that too.

## 1.6 — Report the verdict

State it in one line, honestly:

> **"The pricing work was [fully done / partially done / not done at all]."**

Then list exactly what exists and what doesn't. **Then continue to Part 2 and do the rest.**

---

# PART 2 — THE FINAL SPEC (this supersedes everything before it)

## 2.1 — The plans

| Plan | Price/month | Price/year | For |
|---|---|---|---|
| **Gratuit** | 0 TND | 0 | New tutor. Page, 1 class, booking, reviews. |
| **Essentiel** | 29 TND | 290 (2 months free) | 15–20 students. Up to 5 classes, SMS/WhatsApp reminders, basic stats. |
| **Pro** | 59 TND | 590 | 20–35 students. Unlimited classes, featured in /explore, sell materials, full stats. |
| **Prestige** | 99 TND | 990 | 35+ students. Top placement, lesson replays, priority verification (48h), priority support. |

## 2.2 — The tutor pays TWO things (state both, always together)

> **10% on each paying student** — charged **only** on payments Tnajem actually processes.
> **Plus a monthly subscription** (see plans above).

If a student pays the tutor directly, hand to hand, **Tnajem takes nothing and never invoices
for it.** The first session is always free — no commission on it.

Never show the commission without the subscription, or the subscription without the commission.
A tutor who discovers the second one later will feel misled.

## 2.3 — What is TRUE TODAY vs COMING (do not blur this)

**TODAY:** payments are OFF (`PAYMENTS_ENABLED` disabled). Tnajem processes nothing, so
commission collected = **0 TND**, and every plan is **free during the pilot**.

**LATER:** plans go live at the prices above, and 10% applies to processed payments.

Future pricing may be shown **only if unmistakably labelled as future.** Never imply money is
taken today. Never promise "0% forever."

## 2.4 — Copy changes (do these everywhere they appear)

### ❌ REMOVE completely: "Sans carte bancaire"
Every variant, both locales: `Sans carte bancaire`, `sans carte`, `بلا كارت`, `من غير كارت`.
Delete the phrase; rewrite the sentence so it still reads naturally. Do not leave a dangling
separator (`·`) behind.

### 🔄 REPLACE: "Aucun abonnement" / "aucun abonnement"
The old line implied the student never pays. The truth is: **no lock-in, you pay right before
the session, and the first one is free.**

**FR:**
> Sans engagement. Tu paies juste avant chaque séance — ou au mois, si tu préfères.
> La 1ère séance est toujours offerte.

**Derija:**
> بلا التزام. تخلّص قبل كل حصة — ولا بالشهر، كيف ما تحب.
> أول حصة ديما بلاش.

Short variants where space is tight:
- FR: `Sans engagement · 1ère séance offerte`
- AR: `بلا التزام · أول حصة بلاش`

### 🔄 REPLACE: every 88/12 split → **90/10**
Update the income-anchor arithmetic on `/pour-les-profs` so the numbers actually add up.

### 🔄 UPDATE: the tutor-facing fee statement
**FR:**
> Gratuit pendant le pilote.
> Ensuite : 10 % sur chaque élève payant, uniquement sur les paiements traités par Tnajem,
> plus un abonnement à partir de 29 TND/mois.
> Ton élève te paie en main propre ? On ne prend rien.

**Derija:**
> فابور في فترة التجربة.
> من بعد : 10 % على كل تلميذ خلّص، كان على الخلاص اللي يعدّي من Tnajem،
> زائد اشتراك من 29 دينار في الشهر.
> التلميذ خلّصك في يدك؟ ما ناخذو والو.

### 🔄 FIX: the FAQ answer saying "12 %" → **10%**, and add the subscription.

## 2.5 — Build `/tarifs` (if it doesn't already exist)

`app/[locale]/tarifs/page.tsx`, following the existing routing pattern.

- Four plan cards, **Pro** highlighted as the popular choice
- **Both** costs stated together and equally prominently: subscription **and** 10%
- A prominent honest banner:
  **"Gratuit pendant le pilote — aucune de ces offres n'est encore facturée."**
  **"فابور في فترة التجربة — ما زال ما نفوترو حتى خطة."**
- One line on the commission: 10%, only on payments Tnajem processes, first session free
- A short comparison: **Preply 18–33%, Wyzant 25% + 9%, GoStudent ~35%** — cite as published
  rates, **invent nothing**
- Linked from the footer and from `/pour-les-profs`
- Strings in **both** locales (`ar: typeof fr` is enforced — a missing key won't compile)

## 2.6 — Dashboard

- `components/DashboardSidebar.tsx` — gate the payout link behind `paymentsEnabled`
- Delete the dead payout strings from `lib/i18n.ts` (grep first to confirm nothing renders them)
- Nothing may imply a withdrawal is possible while payments are off

---

# PART 3 — PROVE IT THIS TIME

Do not report success on any item you have not re-measured.

1. `npx tsc --noEmit` clean · `npm run build` green
2. **Re-run every grep from 1.3 — expect ZERO hits.** Paste the actual command output.
3. **Re-run every grep from 1.4 — paste the output.**
4. `git diff --stat` — paste it. This is the proof that files changed.
5. **Restart the dev server, clear `.next`,** then screenshot at **320, 380, 768, 1280**:
   `/fr/tarifs`, `/ar/tarifs`, `/fr/pour-les-profs`, `/ar/pour-les-profs`, `/fr` — and
   **LOOK at every image.**
6. Confirm FR/AR key parity programmatically; report the counts.
7. Confirm: no page claims Tnajem takes money today · no page promises "0% forever" ·
   no page says "Sans carte bancaire" · every tutor-facing fee mention states **both**
   the 10% and the subscription.

**Final report must contain:**
- The Part 1 verdict (was it done before? honestly)
- `git diff --stat` output
- The before/after grep output
- The screenshots
- Anything you could not complete, and why

---

## Guardrails

- **Truth rule:** no invented numbers, no fabricated social proof, no payment claim that isn't
  true today. Future pricing must be labelled as future.
- **Don't break RTL** — logical CSS properties only, never `left`/`right`/`ml-`/`mr-`.
- **Don't break FR/AR parity** — every new string in both locales.
- **No new npm dependencies** for the app.
- **If you cannot do something, say so.** Do not report it as done.
