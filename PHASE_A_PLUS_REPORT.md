# Phase A+ · UI polish + trust follow-ups — report

Branch `phase-a-plus`, created from `ui/option-a` @ `cbbe4ad`. One agent. There's one commit per task, plus one U1 follow-up found while writing this report.

**Result: 9 of 9 tasks done. None were BLOCKED.**

- P1–P3 and U1–U3 were each reproduced first by a test that failed on the old code.
- P4 was reproduced by a test that failed on the old build.
- U2 was reproduced by a test that failed on the old code.
- U4 was **not reproduced**; §6 explains why. A test now pins the behaviour.
- U5 is a clean-up task and has no failing test.

## 1 · Tasks

| ID | Status | Commit | Proving test |
|---|---|---|---|
| P1 | done | `3b84129` | `apps/api/test/contact-info.test.ts` › "P1 — a platform's handle, a half-spelled number, and nothing more": 7 failed before; the file is now 141/141 |
| P2 | done | `d4ac5a3` | `apps/api/test/explore-search.test.ts` ("'Ben Ali' → 0 results", "'Ali' does not find him", "'maths' finds him", "the slug finds him", …): 4 of 7 failed before; now 8/8 |
| P3 | done | `390f376` | `apps/api/test/audit-append-only.test.ts` (UPDATE / DELETE / TRUNCATE refused, the FK carve-out, "a failed audit insert on approve: the request fails and the tutor stays pending"): 5 of 6 failed before; now 6/6 |
| P4 | done | `595c4b3` | `e2e/pilot-tag.spec.ts` (`/fr` and `/ar` with ALLOW_MINORS unset show the tag; with ALLOW_MINORS=1 there is no tag): 2 of 3 failed on the pre-P4 build; now 3/3 |
| U1 | done | `e3a253f`, then `e6ca68e` | `e2e/ui-a-plus.spec.ts` U1 ("the payment note is blue50, and 'Bientôt' opens its line", "the pilot banner is blue50", "every rendered payment sentence is a block that starts with its tag"): 3/3 failed before; now 3/3 |
| U2 | done | `46907a0` | `e2e/ui-a-plus.spec.ts` › "signed out on a tutor page: exactly ONE ochre button in view": before, the list was `['Créer ma page','Réserver la séance']`; now it is exactly `['Réserver la séance']` |
| U3 | done | `ae6831a` | `e2e/ui-a-plus.spec.ts` U3 (Pour les profs "EN DIRECT" is not green; the dashboard "En direct" is not green and has a rose dot): 2/2 failed before; now 2/2 |
| U4 | done: not reproduced, pinned | `ac4c5e0` | `e2e/ui-a-plus.spec.ts` › "390x844, scrolled to the bottom: the last content element ends above the bar" |
| U5 | done | `ce43c05` | `ar: typeof fr` compiles; the FR/AR parity guardrail is green; `git check-ignore .claude/` matches |

Two commits only change the screenshot harness:

- `b03480a` adds `UI_SHOTS_DIR`.
- `b752844` makes `npm run ui:shots-a` run only the page captures. The cash-out capture now needs `E2E_PAYMENTS_ON=1`.

**`e6ca68e` (U1 follow-up).** When I listed every green background for §4, I found the dashboard's "Mes packs" icon tile still green. U1 had already made the identical storefront pack tile blue, so this commit makes the dashboard tile blue too. `npm run verify` was green afterwards.

## 2 · Before / after counts

| | Before (baseline, `cbbe4ad`) | After (`phase-a-plus`) |
|---|---|---|
| `npm run verify` | green | green: **0 contrast failures, 0 guardrail violations** |
| API tests (`npm run test:api`) | 575 / 575 | **622 / 622** |
| Playwright (`npm run test`) | 381 / 381 | **391 / 391** |
| axe, the same 62 routes as Option A | 62/62, 0 serious/critical | **62/62, 0 serious/critical**, 0 manual-rule failures (skip link, targets ≥ 44 px, no text < 13 px) |
| `db:check` (schema.ts vs the database) | 31 migration files (`0000`–`0030`) | green: 32 files, 30 tables, 286 columns |
| Contrast audit rows for the new styles | none | 5 new rows: pilot tag (FR + AR), `.note-info` text, `.note-info` icon, `.tag-live` label, `.tag-live` dot |
| Green boxes that were neither Vérifié nor success | 13 | **0** (listed in §4) |
| Ochre buttons in view, signed out on `/fr/yassine-math` | 2 | **1** |
| Green buttons (`btn-green` / `variant="green"`) | 4 | **0**; the class and the variant are deleted |
| Green "live" or pilot chips | 3 | **0** |
| Dead admin link strings (FR + AR) | 24 lines | **0** |
| `admin_actions` rows an app query can UPDATE, DELETE or TRUNCATE | all of them | **none**. The only exception is the FK's own "actor → NULL" when a profile is deleted |
| Admin actions whose audit write could fail silently | all (`auditAdmin` swallowed the error) | **none**: it rethrows, and 12 route paths write the action and its row in one transaction (§6) |

The gate on `phase-a-plus` (build → verify → API → Playwright on scratch ports) printed `GATE PASS`. §7 has the result after the merge.

## 3 · P1: the filter table, pasted

Output of `detectContactInfo` + `maskContactInfo` from `packages/shared/src/contact-info.ts`. "Stable" means that re-scanning the output finds nothing, so a second pass doesn't eat more text.

| Input | Masked output | Stable |
|---|---|---|
| `snap: amine.ben` | `[masqué]: [masqué]` | yes |
| `snapchat amine.ben` | `[masqué] [masqué]` | yes |
| `mon insta: amine.ben` | `mon [masqué]: [masqué]` | yes |
| `ajoute moi sur tiktok amine_tn` | `ajoute moi sur [masqué] [masqué]` | yes |
| `whatsapp vingt-quatre 555 666` | `[masqué] [masqué]` | yes |
| `appelle: vingt quatre, 555, 666` | `appelle: [masqué]` | yes |
| `wa: 24 555 666` | `[masqué]: [masqué]` | yes |
| `mon insta c'est @amine.ben` | `mon [masqué] c'est [masqué]` | yes. Before, "c'est" became "c'[masqué]", because `est @amine.ben` was read as an e-mail |
| `2024-2025` | `2024-2025` (unchanged) | yes |
| `x = 24 555` | `x = 24 555` (unchanged) | yes |
| `le cours coûte 45 TND` | `le cours coûte 45 TND` (unchanged) | yes |
| `rdv à 14h30` | `rdv à 14h30` (unchanged) | yes |
| `si x < 5 alors y > 2` | `si x < 5 alors y > 2` (unchanged) | yes |
| `chapitre 3.2.1` | `chapitre 3.2.1` (unchanged) | yes |
| `page 216` | `page 216` (unchanged) | yes |
| `snap de la leçon` | `snap de la leçon` (unchanged) | yes |

How the new rules decide:

- **Handle after a platform name.** A platform name now also masks the handle that follows it, within the next 3 tokens. A handle is ASCII word characters or dots, 3 or more long, containing `.`, `_` or a digit. The first word after `platform:` also counts.
- **"snap" and "wa".** These are also ordinary words, so they count as a platform only when such a handle follows.
- **Phone numbers half in words.** A run that mixes number words (FR or AR) with digit groups is treated as a phone number when it adds up to at least 8 digits.
- **E-mails with a space before `@`.** These count as an e-mail only when a known TLD follows.

## 4 · U1: every green box, and the decision

I grepped `green50`, `bg-green*`, `var(--green)` backgrounds and green classes across `apps/web`.

**Changed to blue: information, a selected state, or decoration**

| # | Where | Was | Now | Why |
|---|---|---|---|---|
| 1 | Tutor page sidebar, payment note (`StorefrontView`) | `.trust` green50, Shield | `.note-info`, Info icon | information |
| 2 | Tarifs "Gratuit pendant le pilote" banner (`TarifsInner`) | `.trust` | `.note-info`, Info icon | information |
| 3 | Admin Plans "Les paiements sont désactivés" banner | `.trust` | `.note-info`, Info icon | information |
| 4 | Payout page note (`dashboard/payout`) | `.trust` | `.note-info`, Info icon | information |
| 5–6 | The two ID-upload notes (`VerifyInner`) | `.trust` | `.note-info`; Shield and Lock kept | information about protection |
| 7 | Class page, free first session callout (`.cd-callout`) | green50 / green-ink | blue50 / blue700 | information |
| 8 | Checkout cancellation rule (`.ck-cancel`) | green50 / green-ink | blue50 / blue700 | information |
| 9 | New class, "1re séance offerte" checkbox when selected | green border and fill | cobalt | a selected state is blue |
| 10 | Dashboard free-session switch when on | green | cobalt | a selected state is blue |
| 11 | Account, phone row icon tile | green50 | blue50 | decoration, not success |
| 12 | Storefront pack icon tile (`.sf-pack-ic`) | green50 | blue50 | decoration |
| 13 | Dashboard "Mes packs" icon tile (`e6ca68e`) | green50 | blue50 | decoration, same as #12 |

**Changed in U3 (not boxes, but green)**

- The dashboard "En direct" chip (was `chip-free`), the Pour les profs mock "EN DIRECT" and the live room pill are now `.tag-live`: paper and ink, with a rose dot that pulses only when motion is allowed.
- The Pour les profs pill "Pilote — 0 % aujourd'hui" is now `.tag-neutral`.
- These four buttons are now `btn-primary`: cash-out (dashboard), cash-out (payout page), admin "Approuver" and the consent form submit.

**Kept green, because it is "Vérifié" or a real success**

| Where | Why it stays |
|---|---|
| `.verified` badge and the Vérifié pill | verified |
| `.tag-success`: admin Plans row for a verified tutor | verified |
| Onboarding "page créée" panel (`OnboardingInner`, green50 with green border) | success confirmation |
| Student page, the cancel outcome flash (`role="status"`) | success confirmation |
| `ProgressSteps` completed step (`bg-green-btn`) | completed |
| Dashboard "Terminé" onboarding step chip | completed |
| `VerifyInner` accepted file (the ID-front card, `.dz[data-filled]`) | an upload that succeeded |
| Admin verifications, the empty queue icon tile | "all caught up" |
| Dashboard link-copy button, its "copié" moment | momentary success feedback |
| Checkout success badge | payment succeeded |
| Pour les profs, the "Ton tarif — 100 % pour toi" feature tile | the real-saving green, the same meaning as the /tarifs saving; see open item 1 |

**Green that is not a box** (text or icon colour; left as is):

- the "Gratuit" price text (`.cd-free`, `.sf-free`, the dashboard `isFree` column);
- check icons in feature lists (Tarifs, sign-up, onboarding, upgrade, the Pour les profs hero note);
- the Tarifs yearly saving;
- the checkout amount and note;
- the class-tools "Rejoindre" icon;
- the approved-avatar text, the report "envoyé" text, the student success text;
- the confetti;
- the Pour les profs headline line "Tu gardes 100 %" (Option A, A8);
- the mint-to-green gradients in the Pour les profs illustration.

**"Bientôt" layout**

`PaymentStory`'s root is now a block (`.payment-story`), so `[◷ Bientôt] Tu paies en ligne, via Tnajem, avant la séance.` always starts its own line: in the sidebar note, in "Comment ça se passe", on the home page and on Pour les profs. Rules inside `.note-info` target direct children only, so a nested tag keeps its own colours.

## 5 · Screenshots

The shots stack is `ui:shots-a` on a clean, freshly seeded scratch database, pointed at `ui-a-plus/after/` (26 files). The screenshots are local-only and gitignored, as in the Option A pass.

**Side by side.** Option A is on the left and Phase A+ on the right. One image per view, in `ui-a-plus/side-by-side/`:

| View | Side by side |
|---|---|
| Home | ![](ui-a-plus/side-by-side/home-1440.png) |
| Explore | ![](ui-a-plus/side-by-side/explore-1440.png) |
| Tutor page, desktop | ![](ui-a-plus/side-by-side/tutor-page-1440.png) |
| Tutor page, 390 | ![](ui-a-plus/side-by-side/tutor-page-390.png) |
| Tarifs | ![](ui-a-plus/side-by-side/tarifs-1440.png) |
| Dashboard | ![](ui-a-plus/side-by-side/dashboard-1440.png) |
| Pour les profs | ![](ui-a-plus/side-by-side/pour-les-profs-1440.png) |

- **Where the originals are:** Option A's own set is in `ui-option-a/after/` (a copy is in `ui-a-plus/option-a-after/`), and every page at 1440 and 390 is in `ui-a-plus/after/`.
- **Session dates differ.** The seeded class dates are relative to the day of the run (26 Sept vs 27 Sept); nothing on the pages changed there.
- **No pilot tag in the shots.** The shots stack runs with `ALLOW_MINORS=1`, as the suite does.
- **Pilot tag screenshots.** These come from the second server with the flag unset:
  - `ui-a-plus/after/pilot-home-1440.png`
  - `pilot-home-390.png`
  - `pilot-home-ar-1440.png`
  - `pilot-explore-1440.png`
  - `pilot-explore-ar-390.png`
- **Cash-out.** With payments on, the screenshots are `ui-a-plus/cashout-dashboard-1280.png` and `cashout-payout-1280.png` (ochre, no green).

## 6 · Notes per task

**P2: what Explore search matches now**

`GET /tutors/explore?q` matches:

- the first name (prefix);
- the displayed form (`Mohamed B` or `Mohamed B.`);
- the subject, including codes, labels and aliases, so `maths` finds "Mathématiques";
- the levels;
- the slug.

It never matches the last name. It no longer matches the bio either, because a tutor may write their full name there. `%` and `_` are searched as literal text.

**P3: migration `0031_admin_actions_append_only.sql`**

- **The trigger.** It refuses UPDATE, DELETE and TRUNCATE on `admin_actions`.
- **The one exception.** The foreign key's own `ON DELETE SET NULL` still works. An UPDATE that only sets `admin_profile_id` to NULL is allowed, and only when that profile no longer exists.
- **The migration itself.** It is idempotent and additive.
- **Manual rollback (also in the file header):**

  ```sql
  DROP TRIGGER IF EXISTS "admin_actions_append_only" ON "admin_actions";
  DROP TRIGGER IF EXISTS "admin_actions_no_truncate" ON "admin_actions";
  DROP FUNCTION IF EXISTS admin_actions_append_only();
  ```

- **Audit writes can't fail silently any more.** `auditAdmin` now logs `audit_write_failed` and rethrows.
- **Same transaction.** These routes now write the action and its audit row together:
  - approve and reject (two paths each);
  - block and unblock;
  - hide, and the report the hide closes;
  - report resolution;
  - plan grant and revoke;
  - avatar decision and takedown.
- **Test clean-up.** The API tests no longer delete audit rows (7 files).

**P4: the pilot tag**

- **Wording.** FR: "Pilote · réservé aux 18 ans et +". AR: "تجربة · للّي عمرهم 18 سنة وفوق". The Arabic uses the consent page's own Derija spelling of للّي.
- **Where it shows.** Beside the eyebrow on the home hero and on Explore, only while `ALLOW_MINORS` is not `1`.
- **Explore** reads the flag per request.
- **The home page** is prerendered, so `<PilotTag>` asks the new `GET /api/pilot` (no-store) after hydration. The row keeps the tag's height, so nothing shifts when it arrives.
- **Testing it.** The suite needs a server with the flag off, so `playwright.config.ts` starts a second web process from the same build on `:3212`.
- **Two servers on one build.** `serve-standalone.mjs` now copies the content-hashed `.next/static` with `force:false`. On Windows, two servers on one build used to collide (EBUSY killed the first).

**U4: not reproduced**

- **What I checked.** The live page at 390×844, not a full-page screenshot.
- **Why it's fine.** The bar is `position: sticky; bottom: 0` and sits after the content in the page. While you scroll, it docks over whatever passes under it. Scrolled to the bottom, it rests below the last content element: grid bottom −204 px vs bar top −108 px. Nothing is out of reach, so no padding was added.
- **Why it looked broken.** A full-page screenshot draws the sticky bar mid-page, as in `tutor-page-390`, and that looks like an overlap.
- **The test** keeps the lowest visible content element above the bar.

**U5**

24 dead lines deleted (12 keys × FR/AR). `.gitignore` gains `.claude/` (nothing inside was deleted) and `ui-a-plus/`.

## 7 · Merge

The prompt's order: merge `ui/option-a`, then `phase-a-plus`, into `launch-hardening` with `--no-ff`. Then run the full suite again on the result, push the three branches, and don't touch `main`.

- **Tree.** `launch-hardening` (`d8821ce`) is the merge base of both branches, so the merged tree is the `phase-a-plus` tree.
- **How.** The merge is built and tested in a separate worktree, with its own install, fresh scratch database and scratch ports. Your checkout is moved to the tested commit (fast-forward) only after the gate passes.
- **Result:** see the commit that follows this report on `launch-hardening`.

## 8 · Open items

1. **Greens that need your call:**
   - **The "Gratuit" chip** on a student's booked class (`chip-free`, a solid green fill). It's a price label, not a success.
   - **The first of the three "3 choses" tiles on the home page** (green / blue / ochre decorative set).
   - **The dashboard unread-notifications dot** (green; a state would be blue).
   - **The Pour les profs "100 % pour toi" tile**, kept as the "real saving" green.

   None is a box of information, so U1 left them.
2. **Two ochre buttons on the dashboard with payments on.** With `PAYMENTS_ENABLED=1`, the dashboard's bottom block shows the full-width "Retirer mes gains" right above "Créer une classe", both ochre (`ui-a-plus/cashout-dashboard-1280.png`). U3 asked for the cash-out to be `btn-primary`, so the two now compete. One of them should step down to outline. That's your call; it isn't visible while payments are off.
3. **P1 limits.** The filter is a deterrent, not a guarantee:
   - a plain word after a platform with no `.`, `_`, digit or colon (`insta amineben`) is not masked, though the platform name is;
   - "vingt et un" (with "et") is not parsed as a number;
   - new spellings will keep appearing.
4. **P2 trade-off.** Search no longer looks inside bios. A student who types a word that only appears in a bio now gets no result. That's deliberate, since a bio can contain a surname.
5. **P3 limits:**
   - **Only against the app, not the owner.** The trigger stops the app and any accidental statement, but a database *owner* can still `ALTER TABLE … DISABLE TRIGGER`. For real tamper-resistance in production, the app should connect as a role that doesn't own the table (a Stage 6 / VPS item).
   - **One audit is still outside the transaction.** The consent guardian-change refusal writes its audit row separately; it now fails loudly instead of silently.
6. **U4 was not reproduced** (§6). If you saw the overlap on a real phone, send the model and browser: the test pins what I measured.
7. **CI starts one more server.** `playwright.config.ts` now also starts a third server on `:3212`, so that port must be free in CI too.
8. **Still open from Phase A (`PHASE_A_REPORT.md` §7):**
   - the D11 consent e-mail;
   - retention periods;
   - the headline "du primaire au Bac" sitting beside an 18+ pilot tag (your D12 decision kept the headline).
9. **Derija wording.** A native speaker should read the pilot tag's Arabic once: "تجربة · للّي عمرهم 18 سنة وفوق".
