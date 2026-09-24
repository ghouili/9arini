# Phase A · Trust blockers · Report

Branch `launch-hardening`, from `8523ef3` to the final commit listed in §11. It is pushed and has **not** been merged to `main` or deployed.
Evidence per lane is in `phase-a-logs/l1.md` … `l6.md`. The independent check is in `phase-a-logs/verification.md`.

## 1 · Verdict

**28/28 DONE · 0 BLOCKED · 0 NOT-REPRODUCED.**

- **A18** counts as one ID. It covers 13 field fixes and two Derija passes. Items 3 and 4 are covered by A24, and item 5 by A10.
- **Tests: 0 failures.** The suite went from 662 tests at baseline (340 API + 322 Playwright) to 952 (575 API + 377 Playwright) (§3).
- **Verification.** A fresh agent that wrote none of the code re-ran the §4 gate and did 12 revert proofs. All 12 held.
- **Discrepancies.** The verifier found 12, none of them high. Eight are fixed as `phase-a/verify-fix` commits and D3 was already fixed (`d42589f`). D5, the migration numbering, is recorded in §9, and two need a decision from you (§7).
- **Integration fixes.** Merging the lanes needed 13 `phase-a/integrate` commits, all listed in §5. Three of them fixed product defects that no lane could see alone:
  - the cancel outcome disappeared when you cancelled your last booking;
  - the class page promised a free session that the booking then refused;
  - a message could be reported through the public no-account endpoint.

## 2 · Tasks

| ID | Finding | Status | Commit | Proving test (API = `apps/api/test/`, e2e = `e2e/`) |
|---|---|---|---|---|
| A1 | 1 contact mask leaks the handle | DONE | `f85ae25` (+`604a21e`) | API `contact-info.test.ts` › "A1 — maskContactInfo removes the whole handle or number" |
| A2 | 2 conversations never close | DONE | `bbb4d4c` | API `messages-route.test.ts` › "A2 …"; e2e `thread-closed.spec.ts` |
| A3 | 6 welcome says the tutor can call | DONE | `ac1e926` | e2e `zero-contact-copy.spec.ts` |
| A4 | 7 new-pack says WhatsApp/mail | DONE | `440cfb9` | e2e `zero-contact-copy.spec.ts` |
| A5 | 9 `/tarifs` "toujours offerte" | DONE | `96f52bd` | API `free-first-advertising.test.ts`; e2e `free-first-copy.spec.ts` |
| A6 | 10 free first session every time | DONE | `ef0b105` (+`ae3ab70`) | API `free-first-once.test.ts` (incl. concurrency), `free-first-shown.test.ts` |
| A7 | 11 every error = "déjà cette place" | DONE | `d779046` | API `booking-errors.test.ts` |
| A8 | 12 re-booking reuses the stale row | DONE | `8ba2f26` | API `rebooking.test.ts` (a)(b)(c) |
| A9 | 13 class page finds tutor by name | DONE | `6a24cf0` (+`48b987f`) | API `class-tutor-link.test.ts`; e2e `class-tutor-link.spec.ts` |
| A10 | 14 verification card mixes rounds | DONE | `46bf145` | API `verification-rounds.test.ts` |
| A11 | 15 old photos never deleted | DONE | `c4eccf8` | API `avatar-erasure.test.ts`, `storage-prefix.test.ts` |
| A12 | 16 placeholder support link | DONE | `dbda8a5` | e2e `zero-contact-copy.spec.ts`; §4.3 grep |
| A13 | 4 minor replaces guardian e-mail | DONE | `5b84f03` | API `a13-guardian-lock.test.ts`; e2e `security-access.spec.ts` |
| A14 | 5 a minor can open a tutor page | DONE | `511e86f`, `8855248` | API `a14-tutor-age.test.ts` |
| A15 | approval ignores the Décret declaration | DONE | `99e0d71` | API `approve-declaration.test.ts` |
| A16 | reviews open 1 min in; "EN DIRECT" forever | DONE | `44d1f35` | API `reviews-live.test.ts`; e2e `live-ended.spec.ts` |
| A17 | role check lost on dashboards | DONE | `a3e84e5` | API `a17-role-dashboard.test.ts`; e2e `role-guard.spec.ts` |
| A18 | 16 misplaced fields + Derija | DONE | `27b1834` `8d5445d` `11e11e8` `b831652` `923e5d2` `ac17714` `99a574c` `6e0d11b` `b01a196` `24632ba` `9d437e7` `c54cdf1` `63827f5` `1872bfa` `23ddd30` | API `l5-*.test.ts` (one per item), `l6-derija.test.ts`; e2e `l5-fields.spec.ts` |
| A19 | `/privacy` and `/terms` overpromise | DONE | `d998693` (+`d2ffe7f`) | API `legal-truth.test.ts`; e2e `legal-truth.spec.ts` |
| A20 | sanitiser deletes after a lone `<` | DONE | `bf5e2fe` | API `message-text.test.ts`; e2e `message-text.spec.ts` |
| A21 | cancel messages always "40 %" | DONE | `6bf1fe0` (+`cc7165d`) | API `cancel-outcome.test.ts`; e2e `cancel-outcome.spec.ts` |
| A22 | one payment story | DONE | `9520b3b` (+`aafc699` `d42589f` `309142a`) | API `payment-story.test.ts`; e2e `payment-story.spec.ts` |
| A23 | 17 tutors' full names | DONE | `c308a8e` | API `a23-tutor-name.test.ts` (13 endpoints); e2e `tutor-name.spec.ts` |
| A24 | adult-only pilot | DONE | `79a2256` (+`c6edcfc` `f851890`) | API `a24-adult-pilot.test.ts`, `age.test.ts` |
| A25 | plan copy + pilot grants | DONE | `8e84c2b` | API `plan-grants.test.ts`; e2e `plans.spec.ts` |
| A26 | verified tutors: rename, resubmit | DONE | `222f764` | API `verified-rename-resubmit.test.ts` |
| A27 | parent survives erasure in consent | DONE | `cc98352` | API `consent-erasure.test.ts` |
| A28 | admins can't remove reported content | DONE | `1da1983` | API `moderation-hide.test.ts` |

## 3 · Counts

| Point | API | Playwright | Failures |
|---|---|---|---|
| Baseline, `a8bf133` (the spec expected 486; the suite had grown since) | 340 | 322 | 0 |
| After the L1 merge | 400 | 332 | 0 |
| After the L2 merge, with 5 e2e specs corrected (§5) | 443 | 337 | 0 |
| After the L3 merge, with 1 product fix and 2 specs corrected | 487 | 352 | 0 |
| After the L4 merge | 508 | 354 | 0 |
| After the L5 merge, with 1 spec corrected | 542 | 369 | 0 |
| After L6 and the integration fixes, `ae3ab70` (re-run by the verifier) | 570 | 377 | 0 |
| **Final**, after the verification fixes | **575** | **377** | **0** |

Every row is a full `npm run test` after a fresh-DB `db:sql` + `db:check` and `npm run verify`. There are two exceptions:
- **After L2:** the single spec corrected after the full run (`tutor.spec.ts`, a stray control character in the regex) was re-run alone: 8/8.
- **After L5:** likewise `l5-fields.spec.ts` (a `networkidle` wait): 15/15.

The raw gate logs are in the session scratchpad and are not committed.

## 4 · §2 must-not-break: every item holds

| §2 item | Proven by | Holds |
|---|---|---|
| Atomic seat booking and release | e2e `seat-claim.race.spec.ts` (16 simultaneous claims on the last seat), `api-seat-claim.spec.ts`, `cancellation.spec.ts` ("concurrent cancels write exactly ONE ledger row"); API `booking-errors.test.ts` (double submit) | yes |
| The server refuses past classes, unverified tutors and suspended tutors | e2e `past-class.spec.ts`, `api-seat-claim.spec.ts`; **API `suspended-tutor-booking.test.ts` (new, D7)** | yes |
| Guardian consent is checked on the server for minors | API `a24-adult-pilot.test.ts` (with `ALLOW_MINORS=1`, month-aware); e2e `security-access.spec.ts`, `privacy-consent.spec.ts` | yes |
| ID scans use AES-GCM and a 10-minute link bound to one admin; every read is audited | API `doc-security.test.ts`; e2e `admin.spec.ts` | yes |
| The admin gate fails closed; approve/reject/block are audited; a rejection needs a reason | API `admin.test.ts`; e2e `journey-admin.spec.ts` | yes |
| The 90-day purge deletes the file first; erasure anonymises, deletes files first and waits for live bookings | e2e `privacy-retention.spec.ts`, `deletion.spec.ts`; API `avatar-erasure.test.ts`, `consent-erasure.test.ts` | yes |
| Cancellation: 47h59 is late, 48h00 is free, on server time | API `cancellation.test.ts` › "THE BOUNDARY — 47h59m / 48h00m / 48h01m" | yes |
| Africa/Tunis on any server | API `time.test.ts`; e2e `timezone.spec.ts`, which the verifier also ran with both servers in UTC: 5/5 | yes |
| No contact field reaches the other party through the API | API `contact-info.test.ts` (`contactFieldPaths`); e2e `zero-contact.spec.ts`, `guardian.spec.ts` | yes |
| No invented ratings, counts or reviews; no rating JSON-LD without rows | API `standing.test.ts`; e2e `tutor.spec.ts`, `standing.spec.ts` | yes |
| Three locks keep demo data out of production | guardrail 6 (the build swap); **API `demo-locks.test.ts` (new, D8)**: the preflight start lock and the `demoEnabled` runtime gate | yes, and all 3 are now proven |
| Schema and migrations match column for column | **`npm run db:check` now compares `schema.ts` with the DB (D9)**: 30 tables, 286 columns, NOT NULL included | yes |

## 5 · Verification and integration

**The verifier** was a fresh agent on `ae3ab70`, with its own worktree and its own DB.
- **§4 gate:** API 570/570, Playwright 377/377.
- **A1 table through the real API:** 10 of 10 masked. Nothing forbidden was stored or returned (§10).
- **Revert proofs:** it reverted A1, A2, A6, A7, A8, A23 and A24, plus A15, A18.10, A18.2, A17 and A14, which it drew with `crypto.randomInt`. Every named test failed without its fix and passed with it again.
- **The A6 lock:** it also showed the lock is load-bearing. Without it, 2 concurrent bookings got 2 free seats.
- **Claims:** it probed 13 endpoints for "Ben Ali" and none contained it.
- **Early stop:** the agent was stopped by an API session limit after it had written its report and restored its tree. The orchestrator committed the report unchanged (`2b19179`).

| # | Discrepancy | Severity | Resolution |
|---|---|---|---|
| D1 | The §4.3 grep hit 3 tests and 1 comment | low | `15f600c`: needles assembled, comments reworded; the grep is now empty |
| D2 | The `/tarifs` meta description said "L'élève ne paie jamais Tnajem", contradicting D4 | medium | `309142a`: removed in FR and AR; the payment scan and the e2e crawler now check metadata |
| D3 | The payout preview named "Flouci" | medium | `d42589f` (found by the orchestrator in parallel): neutral labels; `i18n.ts` is now scanned |
| D4 | The A1 fixed-point tests passed even with A1 reverted | low | `604a21e`: a residue check; with the pre-A1 mask, 7 of the 10 fail |
| D5 | Migration numbering drifted (A26 is in 0029; A18.2's second "0027" became 0030) | low | Recorded here (§9). The numbers are unique and the migrations are idempotent |
| D6 | The retention change had no `LEGAL-REVIEW` marker in code | low | `0e1562b` |
| D7 | No direct test that a suspended tutor can't be booked | low | `dc04367`: new test, revert-proven |
| D8 | Only 1 of the 3 demo locks was tested | low | `99ed087`: start lock and runtime gate tested, both revert-proven |
| D9 | `db:check` never read `schema.ts` | low | `2a4b292`: real comparison; catches a deliberate NOT NULL drift |
| D10 | Explore search matches a surname, so a surname can be confirmed | low | **Your decision** (§7) |
| D11 | The consent form says "Ton parent recevra un e-mail", but none is sent | low now, high once minors open | **Before Phase D** (§7). The line is hidden while `ALLOW_MINORS` is off |
| D12 | Terms §8 overstated what a student sees in a conversation | low | `d2ffe7f`: now says "son prénom seulement" in a conversation |

**Integration fixes** made while merging, each gated:

| Commit | Fix |
|---|---|
| `c6edcfc` | Thread `student_is_minor` is month-aware |
| `1abb1a5` | 5 e2e specs updated to the new rules: A13 locks the guardian, A23 masks names |
| `8a7f694` | `tutor.spec` had a stray control character, written by the orchestrator's own edit |
| `cc7165d` | **Product:** the A21 outcome message vanished when the cancelled booking was the student's only one |
| `1439806` | `payment-story` signs in for checkout; `plans` grants a plan the pilot allows (A25) |
| `f851890` | The photo gate is month-aware; admins read escaped messages as typed |
| `48b987f` | The class page shows the chosen levels, never the legacy "Bac" |
| `296d1ff` | One `ALLOW_MINORS` switch; the second 0027 migration became 0030 |
| `aafc699` | Dead dictionary keys that told the old payment story are deleted |
| `d09b8af` | The admin-nav spec no longer waits for `networkidle` |
| `230c16b` | **Product:** a message can no longer be reported through the public no-account endpoint (L6 found it) |
| `ae3ab70` | **Product:** the class page and checkout no longer promise a free session the booking refuses (L6 found it) |
| `d42589f` | No provider named on the payout preview |

## 6 · FOUNDER defaults and judgment calls (all reversible)

- **Conversation closing:** `THREAD_CLOSE_DAYS = 7` after the class ends (`packages/shared/src/thread-state.ts`).
- **Class form limits:** title 120, duration 240 min, seats 200 (`packages/shared/src/class-input.ts`, one zod schema used by both the form and `POST /classes`).
- **Birthday month counts as a minor:** someone who turns 18 this month is an adult only from the 1st of next month, because the day is unknown. Fail-safe, marked `LEGAL-REVIEW` in `age.ts`.
- **Minors in Playwright:** `ALLOW_MINORS=1` is set for both Playwright servers, so the guardian/consent suite still proves §2. The default-off gate is proven by API tests.
- **Refused grants:** a grant that would lower pilot limits is refused with a reason (not applied silently). Gratuit and Essentiel are refused during the pilot.
- **A15:** approving without the declaration answers `422 declaration-missing`.
- **A28:** a hidden review keeps its rating. The anonymous review feed shows the placeholder in both FR and AR.
- **A13:** there is no admin "unlock guardian" tool. Support deletes the `guardian_links` row.
- **0027:** does not copy the untouched `'Bac'` column default into `levels`. Copying it would re-label every tutor "Bac".
- **Policy versions:** `PRIVACY_POLICY_VERSION` and `TERMS_VERSION` were bumped to 2026-09-24 by L6.
- **Payout labels:** "Portefeuille mobile" / "محفظة على التليفون" and "Retirer mes gains" replace Flouci.

## 7 · BLOCKED: none. Open points that need you

1. **D10, Explore search by surname.** `GET /tutors/explore?q=Ben Ali` finds "Mohamed B.". The surname is never sent, but it can be confirmed. Strict D1 means matching the first name and the shown form only.
2. **D11, consent e-mail (before Phase D).** The consent form line promises an e-mail that `POST /consent` doesn't send. Hidden while `ALLOW_MINORS` is off. Build Dm3's mail, or reword it, before opening minors.
3. **The site description says "du primaire au bac"** (Explore meta and elsewhere) during an adults-only pilot. This is positioning copy; your call.
4. **The admin audit log is not append-only.** The app role can UPDATE and DELETE `admin_actions`, and `auditAdmin` swallows write failures. Reported, not changed, as the spec asked.
5. **Retention periods are not set.** The code sets none for consent records, messages, hidden content or reports. The pages say "[Durée à fixer par l'avocat]", marked `LEGAL-REVIEW`.
6. **Guardian passages in `/privacy` and `/terms`** describe code that is off during the pilot. Rewrite them with Phase D (Dm1–Dm3). Guardians still cannot report a message (Dm2, finding 8).
7. **Counsel:** whether `/terms` needs a clause on payments during the pilot.

## 8 · New env vars for production (names only)

- **`ALLOW_MINORS`:** leave **unset**. Only `"1"` lets minors sign up and book. Read by both the API and the web server.
- **`NEXT_PUBLIC_SUPPORT_WHATSAPP`:** InnoviaBurst's support number, digits only (D5). It is baked in at build time, and the deploy workflow reads it from `secrets.NEXT_PUBLIC_SUPPORT_WHATSAPP`. Empty or invalid hides the support row.

Both are documented in `.env.example` and `DEPLOY.md`.

## 9 · Migrations (all applied by `npm run db:sql`, all idempotent)

| File | Task | What | Manual rollback (from the file header) |
|---|---|---|---|
| `0025_birth_month.sql` | A24, A14 | `profiles.birth_month` (nullable, 1–12) | drop the two constraints, then `DROP COLUMN birth_month` |
| `0026_cancellation_ledger_rekey.sql` | A8 | the ledger is unique on `(booking_id, cancelled_at)` instead of `booking_id`; no row changed | only while no booking has 2 rows: drop the new index, re-add `UNIQUE (booking_id)` |
| `0027_levels.sql` | A18.7 | `tutors.levels text[] default '{}'`, `classes.level`; the `'Bac'` default dropped from `tutors.level` | drop both columns; `SET DEFAULT 'Bac'` |
| `0028_subject_codes.sql` | A18.12 | student subjects mapped to codes; unmapped values kept as typed (on the dev DB: 1 profile with subjects, 0 unmapped) | no lossless inverse; map codes back to FR labels |
| `0029_content_moderation.sql` | A28, A26 | `hidden_at/by/reason` on messages and reviews; `tutors.pending_full_name` (A26 shares A28's file, D5) | drop those columns (un-hides content, loses pending renames) |
| `0030_consent_phone_optional.sql` | A18.2 | `consents.guardian_phone` becomes nullable (written as a second 0027, renumbered at merge) | fill NULLs, then `SET NOT NULL` |

## 10 · §4 final-gate outputs

**4.1: fresh DB, then `db:sql` → `db:check` → `verify` → `test`** (final run, commit in §11):
```
HEAD 15f600c
--- npm run db:sql (fresh tnajem_phasea_gate)
→ applying 0025_birth_month.sql ... ok
→ applying 0026_cancellation_ledger_rekey.sql ... ok
→ applying 0027_levels.sql ... ok
→ applying 0028_subject_codes.sql ... ok
→ applying 0029_content_moderation.sql ... ok
→ applying 0030_consent_phone_optional.sql ... ok
✓ Applied 31 file(s). Schema is up to date.
--- npm run db:check (fresh)
  ✓ DOC_ENCRYPTION_KEY — set, 32 bytes, seal/open round-trip OK
  ✓ connection — PostgreSQL 18.1 on x86_64-windows
  ✓ migrations — 31 files through 0030_consent_phone_optional.sql: 30 tables and 37 added columns present
  ✓ schema.ts — 30 tables and 286 columns match the database, NOT NULL included
✓ OK, 1 warning(s)
--- npm run verify
WCAG 2.1 AA contrast audit — tokens read from app/globals.css
  79 pairs checked — 0 FAIL, 4 advisory below 3.0
  NOTE  The advisory rows are WCAG 1.4.11 (non-text contrast) on hairline borders and
  OK — zero WCAG AA contrast failures.
  ok    0 physical left/right declarations in app/ or components/
  ok    55 bilingual copy objects, 1079 keys per locale, key sets identical
  ok    0 hardcoded French aria-label / placeholder / title / alt values
  ok    0 raw hex colours outside apps/web/app/globals.css
  ok    9 btn/chip variant(s) present in the shipped stylesheet
  ok    14 fixture needle(s) absent from 378 built file(s)
  0 guardrail violation(s)
--- npm run test
# tests 575
# pass 575
# fail 0
# cancelled 0
# skipped 0
Running 377 tests using 1 worker
  377 passed (4.2m)
```

**4.2: the A1 table through the real API.** The verifier built and started the API on :4000. A tutor sent each input; the student fetched the thread.

| # | Sent | Stored in `messages.body` | Returned to the student |
|---|---|---|---|
| 1 | `wa.me/21624555666` | `[masqué]` | `[masqué]` |
| 2 | `https://wa.me/21624555666?text=salut` | `[masqué]` | `[masqué]` |
| 3 | `t.me/amine_tn` | `[masqué]` | `[masqué]` |
| 4 | `facebook.com/amine.ben` | `[masqué]` | `[masqué]` |
| 5 | `www.instagram.com/amine.ben/` | `[masqué]` | `[masqué]` |
| 6 | `216 24 555 666` | `[masqué]` | `[masqué]` |
| 7 | `+216 24 555 666` | `[masqué]` | `[masqué]` |
| 8 | `00216-24-555-666` | `[masqué]` | `[masqué]` |
| 9 | `wa . me / 216 24 555 666` | `wa . me / [masqué]` | `wa . me / [masqué]` |
| 10 | `mon insta c'est @amine.ben` | `mon [masqué] c'[masqué]` | `mon [masqué] c'[masqué]` |

`RESULT: 10/10 masked, 0 forbidden substrings stored or returned`. The seeded rows were cleaned up and the server stopped.

**4.3: the forbidden-copy grep**
```
$ grep -rn "216XXXX\|toujours offerte\|te joindre\|Paiement en dinar" apps packages --exclude-dir=node_modules --exclude-dir=.next
$ echo $?
1
```

## 11 · `git log --oneline 8523ef3..HEAD` (83 commits before this report)
```
15f600c phase-a/verify-fix: the §4.3 forbidden-copy grep returns nothing
2a4b292 phase-a/verify-fix: db:check proves schema.ts matches the database, column for column
99ed087 phase-a/verify-fix: two more of §2's three demo-data locks have a test
dc04367 phase-a/verify-fix: §2 'suspended tutors cannot be booked' has a direct test
0e1562b phase-a/verify-fix: the retention rule A26 changed carries its LEGAL-REVIEW marker
d2ffe7f phase-a/verify-fix: /terms says what a student sees of their tutor in a conversation
604a21e phase-a/verify-fix: the A1 fixed-point tests now catch the leak they exist for
309142a phase-a/verify-fix: /tarifs' search snippet no longer says the student never pays Tnajem
2b19179 phase-a/verify: independent verification report
d42589f phase-a/integrate: the payout preview no longer names a payment provider
ae3ab70 phase-a/integrate: the class page no longer promises a free first session the booking will refuse
230c16b phase-a/integrate: a message can no longer be reported through the public no-account door
6e5f16d Merge phase-a/l6: /privacy and /terms describe the merged code (A19), Derija sweep
88955d6 phase-a/l6: lane log
23ddd30 phase-a/A18.derija-2: the Arabic in other lanes' files no longer reads like MSA
d998693 phase-a/A19: /privacy and /terms no longer promise what the code does not do
d09b8af phase-a/integrate: the admin-nav spec waits for the page, not for network idle
aafc699 phase-a/integrate: delete dead dictionary keys that still told the old payment story
296d1ff phase-a/integrate: one ALLOW_MINORS switch everywhere; every migration has its own number
48b987f phase-a/integrate: the class page shows the levels the tutor chose, never the legacy 'Bac'
786716b Merge phase-a/l5: fields & language (A18.1, .2, .6–.16, Derija)
f851890 phase-a/integrate: the photo gate is month-aware; admins read reported messages as typed
a5c915b Merge phase-a/l4: admin & privacy (A9, A10, A15, A26, A11, A27, A28)
1439806 phase-a/integrate: payment-story signs in for checkout; plans spec grants a plan the pilot allows
cc7165d phase-a/integrate: cancelling your only booking no longer hides what was retained
f869d5a phase-a/l5: lane log
ba6cd8d Merge phase-a/l3: booking & money (A7, A8, A6, A5, A21, A16, A22, A25)
1872bfa phase-a/A18.derija: the Arabic no longer reads like MSA or Algerian
8a7f694 phase-a/integrate: tutor.spec asserts the masked name as text (a stray control character had got into the regex)
63827f5 phase-a/A18.16: the class form and the server no longer disagree on the limits
c54cdf1 phase-a/A18.15: the admin plans page is no longer reachable from nowhere
1176718 phase-a/l5-tests: the A18.13/A18.14 admin fixtures no longer outlive their test run
1abb1a5 phase-a/integrate: five e2e specs assert the Phase A rules instead of the old ones
9d437e7 phase-a/A18.14: signed-in reports are no longer labelled "Signalement anonyme"
f0c9325 phase-a/l3: lane log
24632ba phase-a/A18.13: the account page no longer says "Rôle : Je suis prof"
8e84c2b phase-a/A25: a pilot tutor can no longer be cut down by an admin grant, and plan limits say "séances"
b01a196 phase-a/A18.12: a student's subjects are no longer saved half in French, half in Arabic
c6edcfc phase-a/integrate: a 17-year-old born late in the year is no longer marked adult on a new thread
740bd5b Merge phase-a/l2: identity & access (A24, A14, A13, A17, A23)
0df3d6d phase-a/l2: lane log
6e0d11b phase-a/A18.11: "Prochaine séance" no longer skips a full class to show a later one
9520b3b phase-a/A22: the site tells one payment story, and never as if it were live today
8855248 phase-a/A14: the ui-audit harness signs up with a birth date too (follow-up)
99a574c phase-a/A18.10: cancelled and finished classes no longer look live on the dashboard
c308a8e phase-a/A23: students no longer see a tutor's full name — "Mohamed B."
e2449d4 phase-a/l4: lane log
ac17714 phase-a/A18.9: a class's worksheet no longer opens to every student of the tutor
1da1983 phase-a/A28: reported messages and reviews can no longer stay up because admins had no way to take them down
923e5d2 phase-a/A18.8: a pack's price is no longer collected and then hidden from students
1b4e896 Merge phase-a/l1: contact & messaging (A1, A20, A2, A3, A4, A12)
369748e phase-a/l1: lane log
b831652 phase-a/A18.7: tutors are no longer all labelled "Bac" - they pick their levels
a3e84e5 phase-a/A17: a student opening /dashboard is no longer invited to create a storefront
44d1f35 phase-a/A16: reviews wait for the class to end, a cancelled class has no room, and a failed review says so
dbda8a5 phase-a/A12: the support row no longer opens WhatsApp on a placeholder number
cc98352 phase-a/A27: a parent's name, phone and e-mail no longer survive their own erasure in their child's consent record
5b84f03 phase-a/A13: a minor can no longer swap out the parent linked to their account
6bf1fe0 phase-a/A21: a cancel message no longer says "40 %" when nothing was retained
c4eccf8 phase-a/A11: a tutor's old photos can no longer outlive a replacement, a deletion or an erased account
440cfb9 phase-a/A4: a tutor is no longer told to send pack files by WhatsApp or e-mail
511e86f phase-a/A14: a minor can no longer open a tutor account
ac1e926 phase-a/A3: a student is no longer told their tutor can call them
11e11e8 phase-a/A18.6: a tutor can no longer tick a free first session that silently does nothing
222f764 phase-a/A26: a verified tutor can no longer rename unreviewed, nor vanish from Explore by resubmitting
96f52bd phase-a/A5: /tarifs and the WhatsApp preview stop promising a free session nobody offered
bbb4d4c phase-a/A2: a tutor can no longer keep messaging through a closed conversation
79a2256 phase-a/A24: a minor can no longer sign up or book during the adult-only pilot
8d5445d phase-a/A18.2: a parent's phone number is no longer demanded and stored for nothing
ef0b105 phase-a/A6: the free first session is given once per student per tutor, not every time
27b1834 phase-a/A18.1: a child is no longer made to declare they are their own parent
1ab076f phase-a/l5-setup: the route-test fixtures typecheck (sql is never null in the API)
99e0d71 phase-a/A15: a tutor can no longer be approved without the Décret 2015-1619 declaration for the round under review
bf5e2fe phase-a/A20: a maths message like 'si x < 5 alors' no longer arrives cut to 'si x'
8ba2f26 phase-a/A8: a re-booked seat is a new reservation, and every cancellation is on the ledger
46bf145 phase-a/A10: an admin can no longer approve a tutor against an old round's ID scan
d779046 phase-a/A7: a failed booking no longer tells the student they already have the seat
f85ae25 phase-a/A1: a student no longer receives the WhatsApp number or handle the filter claimed to hide
6a24cf0 phase-a/A9: a class page can no longer send a student to a namesake tutor's storefront
bef2007 phase-a/l4: npm run typecheck passes again on the route-test fixtures
9b34da8 phase-a/l1: typecheck is green again — fx.ts calls a nullable sql handle
b207ab0 phase-a/setup: route-test fixtures for DB-backed API tests
a8bf133 chore: server-side Sentry init
(then the commit that adds this report)
```
