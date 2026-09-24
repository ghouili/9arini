# UI Option A "Clair" · Report

Branch `ui/option-a`, from `launch-hardening` at `d8821ce`. It is pushed and has **not** been merged or deployed.
References: `../UI_options/Tnajem_UI_A_clair.png` (target) and `Tnajem_UI_0_actuel.png` (before).

**Verdict: 10/10 DONE · 0 BLOCKED.** That covers S0 and A1–A9, plus one small a11y fix found along the way. `verify` is green with 0 contrast failures. API tests pass 575/575 and Playwright 381/381: the 377 existing tests plus 4 new colour assertions, 0 failures. axe finds 0 serious or critical issues on 62 FR and AR routes.

> **How it was run.** Your own dev servers were running on :3000 (`next dev`) and :4000 (the API in `tsx`). A normal `npm run test` would have reused your :4000 API and built into the `.next` your dev server uses, so nothing ran there. All the work happened in a separate git worktree. Every gate ran against a production build on **:4100 (API) and :3310 (web)**, with the same environment `playwright.config.ts` gives its servers, and it reached them through the suite's own `E2E_BASE_URL`/`E2E_API_URL` seam.
>
> Two databases were used, and neither is your `tnajem`: `tnajem_ui_a` for the gates, and `tnajem_ui_shots` for the screenshots (freshly migrated and seeded each time). Your servers and data were never touched.

## 1 · Tasks

| ID | Status | Commit | Files touched |
|---|---|---|---|
| S0 | DONE | `e30d13c`, `34eadc7` | `e2e/visual/option-a.capture.ts`, `e2e/visual/visual.config.ts`, `package.json` (`npm run ui:shots-a`), `.gitignore` |
| A1 | DONE | `49ae666` | `globals.css`, `tailwind.config.ts`, `app/[locale]/page.tsx`, `ExploreClient.tsx`, `tools/ui-audit/contrast.mjs`, `e2e/ui-option-a.spec.ts` |
| A2 | DONE | `dae7e8c` | `globals.css` |
| A3 | DONE | `42bf5db` | `globals.css`, `ui.tsx`, `SiteHeader.tsx`, `LocaleToggle.tsx`, `DashboardSidebar.tsx` and 16 screens (§3), `pour-les-profs/page.tsx`, `contrast.mjs`, `e2e/ui-option-a.spec.ts` |
| A4 | DONE | `8ca72e7` | `globals.css`, `ui.tsx` (`<Verified pill>`), `StorefrontView.tsx`, `contrast.mjs` |
| A5 | DONE | `398a20c` | `globals.css` (`.tag-*`), `ui.tsx` (`<Tag>`), `PaymentStory.tsx`, `TarifsInner.tsx`, `ExploreClient.tsx`, `StorefrontView.tsx`, `TutorStanding.tsx`, `OnboardingInner.tsx`, `VerifyInner.tsx`, `admin/plans/page.tsx`, `contrast.mjs` |
| A6 | DONE | `6d68789` | `ExploreClient.tsx` |
| A7 | DONE | `e9195d7` | `TarifsInner.tsx` |
| A8 | DONE | `44e4fb6` | `pour-les-profs/page.tsx` |
| A9 | DONE | `fe8ef14` | `StorefrontView.tsx`, `globals.css` (`.field`, `.linklike`, `.adm-tabs`), new `components/admin/AdminTabs.tsx`, the 4 `admin/*/page.tsx` |
| fix | DONE | `772d52b` | `StorefrontView.tsx`: "Prix du prof" goes from 12 px to 13 px, the one axe manual-rule failure. It dates from Phase A A18.8, not from this pass |

**What each task did, in one line:**
- **A1:** the page is flat `--bg`, with no gradients; `body{min-height:100%}` stops the background tiling per viewport on Explore; the home band and the Explore filter header use the new `--band`; the blue hero radial is gone.
- **A2:** `--sh-s` is the soft shadow, and cards keep their 1 px `--line`.
- **A3:** see §3.
- **A4:** `.verified` is `--green-btn` with a white 2 px ring. On the tutor hero it's a pill reading "Vérifié" / "متثبّت منّو", the home page's existing Derija spelling, added to both dictionaries.
- **A5:** new `.tag-soon` (with the clock icon), `.tag-neutral` and `.tag-success`.
- **A6:** one avatar style, `.avatar`, everywhere.
- **A7:** "Convient à" is `--ink2`, "+ 10 %" is neutral, the saving stays green, and the tags are `.tag-soon`.
- **A8:** headline lines 1–2 are `--ink`, only the 100 % line is `--green-ink`, and the cobalt wash and glow became warm.
- **A9:** one empty state on the tutor page, a plain report link, `.field{display:block}` (the real cause of the cramped forms: `<Field>` renders an inline `<label>`), and one shared row of 4 admin tabs.

## 2 · Counts, before and after

| | Before (`d8821ce`) | After (`772d52b`) |
|---|---|---|
| `npm run verify` | green: 79 contrast pairs, 0 FAIL; 0 guardrail violations | green: **95** contrast pairs (16 added for the new tokens, states and tags), 0 FAIL; 0 guardrail violations |
| API (`npm run test:api`) | 575 / 575 | 575 / 575 |
| Playwright (`npm run test`) | 377 / 377 | **381 / 381** (+4 in `e2e/ui-option-a.spec.ts`) |
| axe (`tools/ui-audit/a11y.mjs`, 62 FR+AR routes) | — | 0 serious/critical, 0 manual-rule failures |

```
BEFORE  === HEAD d8821ce
  79 pairs checked — 0 FAIL, 4 advisory below 3.0
  OK — zero WCAG AA contrast failures.
  ok    0 physical left/right declarations in app/ or components/
  ok    55 bilingual copy objects, 1079 keys per locale, key sets identical
  0 guardrail violation(s)
# tests 575 · # pass 575 · # fail 0
Running 377 tests using 1 worker — 377 passed (2.9m)

AFTER   === HEAD 772d52b
  95 pairs checked — 0 FAIL, 4 advisory below 3.0
  OK — zero WCAG AA contrast failures.
  ok    0 physical left/right declarations in app/ or components/
  ok    56 bilingual copy objects, 1085 keys per locale, key sets identical
  0 guardrail violation(s)
# tests 575 · # pass 575 · # fail 0
Running 381 tests using 1 worker — 381 passed (3.0m)
a11y: 62/62 routes scanned - 0 serious/critical axe, 0 manual-rule failure(s)
```

`34eadc7` came after that gate. It touches only the screenshot harness, which the suite never runs, and it typechecks.

**The new assertions** (`e2e/ui-option-a.spec.ts`):
- the body's `backgroundImage` is `none`, and its colour is `--bg` on `/fr/explore` and `/ar`;
- the body covers the full scroll height, which guards the Explore cut-off;
- the header's "Tableau de bord" is a transparent button with a cobalt label and a cobalt border;
- the selected language is cobalt on blue50;
- the current sidebar item is cobalt on blue50 with a cobalt border.

## 3 · Every `btn-ink` (A3): file, new class, why

`.btn-ink` and its `Button` variant are **deleted**, so `grep btn-ink` finds only a comment and an untouched audit row.

| File | Button | New | Why |
|---|---|---|---|
| `SiteHeader.tsx` | "Tableau de bord", "Mes cours" | `btn-outline` (new) | a way in, not an action |
| `LocaleToggle.tsx` | selected language | blue50 + cobalt | a state (the `onBlue` variant is unchanged) |
| `DashboardSidebar.tsx` | current item | blue50 + cobalt + cobalt border | a state |
| `messages/page.tsx` | "Trouver un prof" | primary | the screen's main action (spec) |
| `messages/[id]/page.tsx` | "Retour aux messages" | primary | the only action on the "not found" card |
| `guardian/threads/[id]/page.tsx` | "Retour" | primary | same |
| `guardian/page.tsx` | "Oui, retirer mon accord" | the **rose destructive pill** (the house style of `DeleteAccount` / `ClassActions`) | a destructive confirm; the palette puts those in rose |
| `checkout/CheckoutInner.tsx` | "Voir mes cours" | primary | the success screen's main action |
| `ReportButton.tsx` | "Envoyer" | primary | the report form's submit |
| `account/DeleteAccount.tsx` | "Annuler la suppression" | primary | the pending-deletion card's main action |
| `dashboard/ClassActions.tsx` | "Déplacer la séance" | primary | the reschedule form's confirm (its sibling "Retour" is ghost) |
| `onboarding/VerifyInner.tsx` | "Retour au tableau de bord" | primary | the only action on the submitted screen |
| `admin/*` (×4) | "Se connecter" (signed out) | primary | the only action |
| `admin/accounts` | "Chercher" | primary | main action (spec) |
| `admin/moderation` | "Traité" / "Retirer le document" / "Approuver" | primary | each card's main action; their alternatives ("Classé sans suite" and the reject buttons) are already ghost |
| `admin/plans` | "Attribuer" | primary | the row's action |
| `dashboard/new-class/page.tsx` | "Voir les offres" (in the plan-limit alert) | ghost | secondary; "Publier" is the screen's action |
| `dashboard/page.tsx` (×2) | "Voir ma vitrine" | ghost | navigation, beside ghost "Modifier" / in the header |
| `app/[locale]/page.tsx` | "Commence à enseigner →" (the "Tu es prof ?" card) | ghost | the home page's main action is "Trouve ton prof" |
| `dashboard/AvatarUpload.tsx` | "Choisir une photo" | ghost | optional; the dashboard's main action is elsewhere |

**Also in A3:**
- The step numbers (dashboard "Comment ça marche", the `/pour-les-profs` stepper) went from near-black to cobalt.
- `.side-nav .active` became blue50 + cobalt.
- The no-storefront dashboard's checklist "Créer ma page" is **ghost**, because the hero card holds the one ochre button.

## 4 · Screenshots

The harness is `npm run ui:shots-a`; set `UI_SHOTS=after` for the after set.
- **Coverage:** 13 pages × 2 widths, full page, in `ui-option-a/before/*.png` and `ui-option-a/after/*.png`. The folder is gitignored and local only.
- **Data:** both sets use the same freshly seeded database.
- **"Before"** was taken from a clean build of `d8821ce`.
- **Reduced motion:** captures use it, because the home page's scroll-revealed sections were blank in full-page shots.

| Page | Before | After |
|---|---|---|
| Home | ![](ui-option-a/before/home-1440.png) | ![](ui-option-a/after/home-1440.png) |
| Explore | ![](ui-option-a/before/explore-1440.png) | ![](ui-option-a/after/explore-1440.png) |
| Tutor page | ![](ui-option-a/before/tutor-page-1440.png) | ![](ui-option-a/after/tutor-page-1440.png) |
| Tarifs | ![](ui-option-a/before/tarifs-1440.png) | ![](ui-option-a/after/tarifs-1440.png) |
| Dashboard | ![](ui-option-a/before/dashboard-1440.png) | ![](ui-option-a/after/dashboard-1440.png) |

The remaining pages, at `-1440` and `-390`: `home-ar`, `pour-les-profs`, `auth`, `signup-eleve`, `messages`, `new-class`, `admin-verifications` and `404`. `/ar` mirrors correctly, and no physical `left`/`right` was introduced (guardrail 1 counts 0).

## 5 · Seen but not changed

1. **Green outside "Vérifié" and success.** The palette reserves green for those two meanings, but three uses remain:
   - the dashboard's "En direct" phase chip (`chip-free`);
   - the `/pour-les-profs` pill "Pilote — 0 % aujourd'hui" and the "EN DIRECT" chip in its phone mock;
   - the dashboard's `btn-green` cash-out button, which renders only when payments are on.

   None were in a task. Rose would clash with "Annulée", so they need a decision.
2. **`chip-sand` survives in one place:** the dashboard's "Terminée" phase label. It's a past, inactive state, and grey keeps it distinct from blue "À venir".
3. **Two ochre buttons on a screen (header + hero)** remain for signed-out visitors, e.g. the header's "Créer ma page" plus the `/tarifs` hero's "Crée ta page de prof". The rule is one per card or section, and the header is its own section, but it's worth a look.
4. **The Gratuit card on `/tarifs`** (`.tf-base`) has a cream fill, which now matches the page. It still reads as a card through its border.
5. **The home "Tu es prof ?" card** keeps its light blue gradient wash. It is a card, not a page band.
6. **Dead copy keys:** the admin pages' old `toVerifications` / `toAccounts` / `toModeration` / `toPlans` strings are no longer rendered, since `AdminTabs` has its own short labels. They're left in place (no copy changes); delete them when convenient.
7. **Audit rows left as they were:** `contrast.mjs` still has rows for `.btn-ink` and "h1 line 2" in blue. They test token pairs and still pass. The audit was only added to, never edited ("don't touch the audit").
8. **Wrong labels in commit messages:** three labels in the A3 commit message are approximate ("Confirmer le déplacement", "Voir ma page", the home "Pour les profs" CTA). §3 has the real ones.
9. **On the dev box:** two scratch databases, `tnajem_ui_a` and `tnajem_ui_shots`, and the worktree `.claude/worktrees/ui-option-a`. Drop them when done.
