# Phase A · Independent verification

Verifier: a fresh agent that wrote none of the Phase A code. I report findings and fix nothing.
Branch `phase-a/verify`, cut from `ae3ab70` (the merged `launch-hardening` head). Own worktree, own DB `tnajem_test_verify`
(created `--fresh`, then `npm run db:sql`), and own `STORAGE_DIR`. No env value was printed anywhere. I pushed nothing
and merged nothing. The main repo, its `.env` and the `tnajem` DB were not touched.

**Method for the revert proofs.** Most task commits no longer revert cleanly, because later lanes and `phase-a/integrate`
commits build on them. For each commit I first ran `git revert --no-commit <sha>`. When that applied, I restored the task's own test files
from HEAD, so the test was still there to fail. When it conflicted, I ran `git revert --abort` and reverted only the
product hunk by hand. Each proof below says which of the two it was. After every proof, the tree was restored
(`git revert --abort` / `git checkout -- <files>`), `git status --short` was empty, and the same test was re-run green.

---

## 1 · §4 final gate

### 4.1 Fresh DB → `db:sql` → `db:check` → `verify` → `test`

`npm run db:sql` on the freshly created `tnajem_test_verify`:
```
→ applying 0000_init.sql ... ok
  … (0001–0024) … ok
→ applying 0025_birth_month.sql ... ok
→ applying 0026_cancellation_ledger_rekey.sql ... ok
→ applying 0027_levels.sql ... ok
→ applying 0028_subject_codes.sql ... ok
→ applying 0029_content_moderation.sql ... ok
→ applying 0030_consent_phone_optional.sql ... ok
✓ Applied 31 file(s). Schema is up to date.
```
`npm run db:check`:
```
Database
  ✓ connection — PostgreSQL 18.1 on x86_64-windows
  ✓ migrations — 31 files through 0030_consent_phone_optional.sql: 30 tables and 37 added columns present
Document store
  ✓ put/get/stream/delete — sentinel round-tripped through the local driver
Mail
  ✓ SMTP login — connected and authenticated (nothing sent)
✓ OK, 1 warning(s)          (the warning: TRUSTED_PROXIES — missing; an env key, dev only)
```
`npm run verify`: **exit 0**. On a fresh worktree the first run exited 1, but only because guardrails 5 and 6 need a production
web build (`no production build under apps/web/.next`). That is an environment prerequisite, not a code failure. After
`npm run build -w @tnajem/web`, the run went green:
```
typecheck (api, web, db, shared, tsc -p e2e) → no errors · eslint . --max-warnings=0 → clean
79 pairs checked — 0 FAIL, 4 advisory below 3.0 · OK — zero WCAG AA contrast failures.
  ok    0 physical left/right declarations in app/ or components/
  ok    55 bilingual copy objects, 1079 keys per locale, key sets identical
  ok    0 hardcoded French aria-label / placeholder / title / alt values
  ok    0 raw hex colours outside apps/web/app/globals.css
  ok    9 btn/chip variant(s) present in the shipped stylesheet
  ok    14 fixture needle(s) absent from 378 built file(s)
  0 guardrail violation(s)
```
`npm run test` (API, then Playwright; `workers: 1`; ports 3000/3210/4000 free before the run):
```
API:        # tests 570 · # suites 132 · # pass 570 · # fail 0 · # cancelled 0 · # skipped 0
Playwright: Running 377 tests using 1 worker … 377 passed (4.1m)
exit=0
```
**Both thresholds are met: API 570 ≥ 570, Playwright 377 ≥ 377, 0 failures.**

Extra, for §2 "Africa/Tunis on any server": `E2E_SERVER_TZ=UTC npx playwright test --grep timezone` starts both servers in UTC →
`5 passed (49.6s)`. The main suite ran on a machine that is itself in Africa/Tunis, so on its own it proves nothing about another zone.

### 4.2 The A1 table through the REAL API

Setup: `npm run build -w @tnajem/api`, then `node dist/server.js` on :4000 with the env `playwright.config.ts` gives the API
(`NODE_ENV=development`, `STORAGE_DRIVER=local`, `ADMIN_EMAILS=e2e-admin@tnajem.invalid`, blank `MAIL_*`/`TWILIO_*`).
`/health` → `200 {"ok":true,"db":true,"storage":true,…,"tz":{"app":"Africa/Tunis",…}}`.
The script seeded, by SQL, a verified tutor, an adult student (birth 1995-06), a class 72 h out and a reserved booking. It minted
both sessions exactly as `e2e/support/session.ts` does (random 32-byte token, `sha256` in `sessions.token_hash`, cookie
`tnajem_session`). Then: `POST /threads` as the tutor, each input sent as the **tutor** via `POST /threads/:id/messages`, and
`GET /threads/:id` as the **student**. The stored body was read straight from `messages.body`.

```
POST /threads (as tutor) -> 200 {"ok":true,"threadId":"23433551-9b30-4290-8b4a-d1a110a8c671"}
GET /threads/:id (as student) -> 200, 10 messages, iAm=student, state=open
```
| # | Sent by the tutor | Stored in `messages.body` | Returned to the student | masked | forbidden substrings found |
|---|---|---|---|---|---|
| 1 | `wa.me/21624555666` | `[masqué]` | `[masqué]` | true | none |
| 2 | `https://wa.me/21624555666?text=salut` | `[masqué]` | `[masqué]` | true | none |
| 3 | `t.me/amine_tn` | `[masqué]` | `[masqué]` | true | none |
| 4 | `facebook.com/amine.ben` | `[masqué]` | `[masqué]` | true | none |
| 5 | `www.instagram.com/amine.ben/` | `[masqué]` | `[masqué]` | true | none |
| 6 | `216 24 555 666` | `[masqué]` | `[masqué]` | true | none |
| 7 | `+216 24 555 666` | `[masqué]` | `[masqué]` | true | none |
| 8 | `00216-24-555-666` | `[masqué]` | `[masqué]` | true | none |
| 9 | `wa . me / 216 24 555 666` | `wa . me / [masqué]` | `wa . me / [masqué]` | true | none |
| 10 | `mon insta c'est @amine.ben` | `mon [masqué] c'[masqué]` | `mon [masqué] c'[masqué]` | true | none |

`RESULT: 10/10 masked, 0 forbidden substrings stored or returned`. The send response's own `body` was checked too.
Cleanup: `rows left: {"profiles":0,"tutors":0,"classes":0,"bookings":0,"threads":0,"messages":0}`. I stopped the server I had
started (pid 3288), and nothing was left listening on :4000.

Supplementary probes outside the table, run through `maskContactInfo`, all masked and all fixed points: `wa.me/+21624555666`,
`https://api.whatsapp.com/send?phone=21624555666`, `24 555 666`, `24.555.666`, `2 4 5 5 5 6 6 6`, `t.me/amine_tn?start=1`,
`instagram.com/amine.ben`, `m.facebook.com/amine.ben` → `m.[masqué]`, `tel:+21624555666` → `tel:[masqué]`,
`snapchat.com/add/amine.ben`, `tiktok.com/@amine.ben`. The false-positive guards `x = 24 555`, `2024-2025`, `15h30 - 16h30` and
`Exercice 216, page 24` are left unchanged.

### 4.3 The forbidden-copy grep — **NOT empty** (see D1)
```
$ grep -rn "216XXXX\|toujours offerte\|te joindre\|Paiement en dinar" apps packages --exclude-dir=node_modules --exclude-dir=.next
apps/api/test/free-first-advertising.test.ts:10:   /tarifs said "La 1ʳᵉ séance est toujours offerte à l'élève" (AR: "ديما فابور")
apps/api/test/free-first-advertising.test.ts:48:  test("no « toujours offerte » (FR) and no « ديما فابور » (AR)", () => {
apps/api/test/free-first-advertising.test.ts:49:    assert.doesNotMatch(src, /toujours offerte/i);
apps/api/test/legal-truth.test.ts:159:      hasNot(c.fr, "te joindre", name);
apps/api/test/payment-story.test.ts:13:   "Paiement en dinar"; the tutor dashboard promised "Flouci et D17". D4: the
apps/web/app/[locale]/explore/page.tsx:48:    : "Parcours les profs … du primaire au Bac."; // phase-a lane L3 (A22): "Paiement en dinar" removed
grep exit: 0
```
Every hit is a test that asserts the string's absence, or a code comment. None of them is rendered copy.

### 4.4 `git log --oneline 8523ef3..HEAD` (73 commits)
```
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
```

---

## 2 · Revert proofs (12 task IDs; all 12 held)

The seven required IDs were A1, A2, A6, A7, A8, A23 and A24. **The five random IDs were drawn with `crypto.randomInt`** from the 35 other task IDs
(A3–A5, A9–A17, A19–A22, A25–A28, A18.1/.2/.6–.16, A18.derija, A18.derija-2). The draw was
`picked: A15, A18.10, A18.2, A17, A14`.

Every test command was `cd apps/api && npx tsx --import ./test/test-env.ts --test test/<file>.test.ts`, except A17, which also
ran `npx playwright test e2e/role-guard.spec.ts`.

| ID · commit | How it was reverted | Test that must catch it | Reverted: result + failing line | Restored |
|---|---|---|---|---|
| **A1** · `f85ae25` | clean `git revert --no-commit`; test file restored from HEAD | `contact-info.test.ts` › "A1 — maskContactInfo removes the whole handle or number" | `# tests 108 · # pass 100 · # fail 8` — `not ok 1 - "wa.me/21624555666" leaks none of […]` · `error: '"wa.me/21624555666" -> "[masqué]/21624555666" still contains "24555666"'`; also `"216 24 555 666" -> "[masqué] 666" still contains "666"` | 108/108 |
| **A2** · `bbb4d4c` | conflicts (guardian.ts, messages.ts, index.ts) → by hand: the send gate in `POST /threads/:id/messages` put back to the old booking-cancelled-only check | `messages-route.test.ts` › "A2 — a closed conversation refuses new messages" | `# tests 13 · # pass 8 · # fail 5` — `not ok 1 - (a) the class ended more than THREAD_CLOSE_DAYS ago: both sides are refused` · `{"ok":true,"id":"a3cb34a8-…","body":"Tu es libre ce soir ?","masked":false}`; (b) consent withdrawn and the three (c) block cases fail the same way | 13/13 |
| **A6** · `ef0b105` | conflicts (bookings.ts, CheckoutInner.tsx; refactored by `ae3ab70`) → by hand: `freeFirstSeatFor` returns `classOffers`, the pre-A6 rule | `free-first-once.test.ts` | `# tests 7 · # pass 4 · # fail 3` — `not ok 1 - a second free-first booking with the same tutor is NOT free` · `expected: false actual: true`; `not ok 3 - CONCURRENCY … exactly one free` · `expected: 1 actual: 2`; `not ok 6 - the STUDENT cancels late → the free session is spent` | 7/7 |
| A6 (lock) | extra: only the `pg_advisory_xact_lock` line removed | same, `--test-name-pattern=CONCURRENCY` | `not ok 1 - CONCURRENCY: … exactly one free` · `expected: 1 actual: 2`. **The lock is load-bearing, as L3 claimed** | 7/7 |
| **A7** · `d779046` | conflicts (bookings.ts, fx.ts) → by hand: the catch goes back to an unconditional `return { ok: true, already: true }` | `booking-errors.test.ts` | `# tests 4 · # pass 2 · # fail 2` — `not ok 1 - a DB failure inside the transaction is a real failure, not { ok: true, already: true }` · `error: 'a failed booking answered "already booked": {"ok":true,"already":true}'`; `not ok 2 - a 23505 on a DIFFERENT unique key …` | 4/4 |
| **A8** · `8ba2f26` | conflict (bookings.ts) → by hand: reactivation `.set({ status: "reserved" })` only; `schema.ts` `bookingId .unique()` put back and the new key removed; **the DB rolled back** with 0026's own manual rollback on `tnajem_test_verify` (checked first: 0 bookings with >1 ledger row) | `rebooking.test.ts` | `# tests 3 · # pass 0 · # fail 3` — `(a) … is_free is now false` · `expected: false actual: true`; `(b) … judged on the NEW booking time` · `expected: 16 actual: 0`; `(c) … TWO ledger rows` · `expected: 2 actual: 1` | files restored; `npm run db:sql` re-applied 0026 (`→ applying 0026_cancellation_ledger_rekey.sql ... ok`); `pg_indexes` shows `cancellations_booking_id_cancelled_at_unique` again and no `cancellations_booking_id_unique` constraint; 3/3 |
| **A23** · `c308a8e` | conflicts in 6 files → by hand: every API call site of `publicTutorName` sends the full name again (`explore-map.ts`, `storefront.ts`, `bookings.ts` ×2, `classes.ts`) | `a23-tutor-name.test.ts` › "A23 · no student-facing endpoint sends the tutor's last name" | `# tests 12 · # pass 7 · # fail 5` — `not ok 1 - storefront (anonymous)` · `storefront sends the last name: {"tutor":{…"full_name":"Mohamed Ben Ali"…`; `explore sends the last name: [{…"full_name":"Mohamed Ben Ali"…`; the class page, the student dashboard and notifications fail the same way | 12/12 |
| **A24** · `79a2256` | 27 files, too entangled for a clean revert → by hand: `auth.ts` student `birth-date-required` / `adults-only` removed (A14's tutor gate kept), `needsConsent` back to year-only, and the `bookings.ts` A24 block removed | `a24-adult-pilot.test.ts` | `# tests 7 · # pass 2 · # fail 5` — `not ok 1 - a student at 17 years 11 months … is refused` · `expected: false actual: true`; `not ok 2 - the "J'ai déjà un code" path with no birth date is refused`; `not ok 1 - sign-in works; POST /bookings is refused even WITH a guardian consent on file`; `not ok 1 - a 17-year-11-month sign-up is accepted and owes a guardian consent` | 18/18 (with `age.test.ts`) |
| **A15** · `99e0d71` *(random)* | conflicts (admin.ts, verifications page) → by hand: approve gate `if (false && …)`, and `declarationCond = raw\`true\`` | `approve-declaration.test.ts` | `# tests 3 · # pass 1 · # fail 2` — `not ok 1 - no declaration at all → 4xx, and nothing changes` · `error: 'expected a 4xx, got 200: {"ok":true,"revalidate":{…}}'`; `not ok 2 - a declaration from an EARLIER round …` | 3/3 |
| **A18.10** · `99a574c` *(random)* | conflicts (classes.ts, index.ts, class-phase.ts modified later) → by hand: `duration_min` + `phase` removed from `GET /dashboard` | `l5-class-phase.test.ts` | `# tests 2 · # pass 1 · # fail 1` — `not ok 1 - upcoming, live, done and cancelled classes are told apart` · `+ undefined - 'upcoming'` | 2/2 |
| **A18.2** · `8d5445d` *(random)* | conflicts (misc.ts, schema.ts, and 0027→0030 renamed) → by hand: `guardianPhone: z.string()` required again | `l5-consent-phone.test.ts` | `# tests 2 · # pass 1 · # fail 1` — `not ok 1 - a consent with no phone is accepted and stores no phone` · `400 !== 200` | 2/2 |
| **A17** · `a3e84e5` *(random)* | one conflict (a classes.ts import line) resolved by dropping only A17's `Role` import; the rest reverted cleanly (the API `wrongRole` line and both layouts); test files restored from HEAD | `a17-role-dashboard.test.ts` **and** e2e `role-guard.spec.ts` | API: `# tests 4 · # pass 2 · # fail 2` — `not ok 1 - a student gets { wrongRole: 'student' }, never the create-your-storefront payload`. Playwright (both apps rebuilt from the reverted tree): `2 failed` — `a student opening /fr/dashboard lands on /fr/student …` · `Expected: 307 Received: 200`; `a tutor opening /fr/student lands on /fr/dashboard` · `Expected: 307 Received: 200` | API 4/4; Playwright rebuilt from the restored tree: `3 passed (47.7s)` |
| **A14** · `511e86f` *(random)* | clean `git revert --no-commit`; `a14-tutor-age.test.ts`, `log-pii.test.ts` and `e2e/journey-tutor.spec.ts` restored from HEAD | `a14-tutor-age.test.ts` | `# tests 6 · # pass 0 · # fail 6` — `not ok 1 - a prof sign-up at 17 years 11 months is refused, and no account is created` · `expected: false actual: true`; `not ok 1 - a student at 17 years 11 months cannot become a tutor` | 6/6 |

**No proof failed. Every named test fails without its fix and passes with it.** One weakness showed up: in the A1 proof, all 10
"the mask is a fixed point" invariant tests **still pass with the fix reverted** (`ok 2 - "wa.me/21624555666": the mask is
a fixed point` …). Only the substring tests catch the bug (D4).

Final state after all proofs: `git status --short` is empty, HEAD is `ae3ab70`, and ports 3000/3210/4000 are free.

---

## 3 · §2 must-not-break: every item on `ae3ab70`

All the tests named below were green in the §4.1 run (API 570/570, Playwright 377/377) unless a row says otherwise.

| §2 item | Test(s), as they ran | Holds? |
|---|---|---|
| Seat booking is atomic (no oversell; atomic release) | e2e `seat-claim.race.spec.ts` › "the last seat cannot be oversold, under 16 simultaneous claims", "a class that is already full accepts no further claims"; `api-seat-claim.spec.ts` › "the API cannot oversell the last seat under 8 concurrent students", "the same student double-submitting takes exactly one seat"; `cancellation.spec.ts` › "concurrent cancels write exactly ONE ledger row and release exactly ONE seat"; API `booking-errors.test.ts` › "a genuine concurrent double-submit is still idempotent: one seat, every answer ok" | yes |
| Server refuses past classes, unverified tutors, suspended tutors | `api-seat-claim.spec.ts` › "a class in the past cannot be booked", "an unverified tutor's class cannot be booked by direct id"; `past-class.spec.ts` › "a crafted booking for a past class is refused by the server"; `journey-admin.spec.ts` › "block → the account, its storefront and its classes stop…" | past + unverified: yes. **Suspended: only indirectly.** Blocking cancels the classes, and a cancelled class is refused. No test books a still-scheduled class of a tutor with `suspended_at` set, so the `tut.suspendedAt` guard in `POST /bookings` has no direct test (D7) |
| Guardian consent checked on the server for every minor's booking | API `a24-adult-pilot.test.ts` › "A24 · with ALLOW_MINORS=1 the guardian gate is intact (and month-aware)"; e2e `security-access.spec.ts` › "an account with no age on file needs consent to book, whatever its role"; `privacy-consent.spec.ts` › "…from the parent space: bookings stop, upcoming seats are released…" | yes |
| ID scans AES-GCM; 10-min signed link bound to one admin; every read audited | API `doc-security.test.ts` › "security: identity documents are encrypted at rest", "security: document links are short-lived and bound to one admin"; e2e `admin.spec.ts` › "security: every document read writes an audit row naming the admin and the request", "security: a document is not addressable by its id; links expire and open one document" | yes |
| Admin gate fails closed; approve/reject/block audited; rejection needs a reason | API `admin.test.ts` › "isAllowlistedAdmin — fails closed on every path"; e2e `journey-admin.spec.ts` › "queue → open the real uploaded ID → approve; the decision is audited…", "reject needs a reason, the tutor reads it, and it is audited" (`note-required`), "block → …" (asserts `account.block` / `account.unblock` audit rows) | yes |
| 90-day ID purge deletes the file before the row; erasure anonymises, files first, waits for a live booking | e2e `privacy-retention.spec.ts` › "91 days after a decision, accepted or refused, the scan is gone from storage", "what remains is the trace…", "inside the window… the scan stays"; `deletion.spec.ts` › "the account keeps no identity…", "nothing is erased while a class booked during the grace is still to come", "ID scans, shared materials and every photo size are deleted from storage…"; API `avatar-erasure.test.ts`, `consent-erasure.test.ts` | yes |
| Cancellation math 47h59 late / 48h00 free, server time | API `cancellation.test.ts` › "THE BOUNDARY — 47h59m / 48h00m / 48h01m" | yes |
| All times Africa/Tunis on any server | API `time.test.ts` › "Tunis time (this process runs in Africa/Tunis)"; e2e `timezone.spec.ts` (5 tests) in the suite, **and re-run with `E2E_SERVER_TZ=UTC`: 5 passed** | yes |
| No contact field reaches the other party through the API | API `contact-info.test.ts` › "contactFieldPaths — the structural guard for whole payloads"; e2e `zero-contact.spec.ts` › "a tutor's whole signed-in surface carries no student contact details", "a student's whole signed-in surface carries no tutor contact details"; `guardian.spec.ts` › "the tutor's phone and email are nowhere in the parent's whole surface" | yes |
| No invented ratings/counts/reviews; no AggregateRating/Review JSON-LD without rows | API `standing.test.ts` › "tutorStanding — reviews decide, nothing else"; e2e `tutor.spec.ts` › "a tutor with no reviews shows no rating markup" | yes |
| Three independent locks keep demo data out of production | `npm run verify` guardrail 6 "14 fixture needle(s) absent from 378 built file(s)" (the webpack swap to `demo-fixtures.empty.ts`) | **only 1 of 3 locks is proven.** No test covers the `NODE_ENV`/`TNAJEM_DEMO`/`API_URL` gate of `demoEnabled` (D8) |
| Schema and migrations match column for column | `npm run db:check` › "31 files through 0030…: 30 tables and 37 added columns present" | **Holds, but not because of db:check.** `db:check` only checks that the migrations' tables and columns exist in the DB; it never reads `schema.ts`. I compared the two directly with a throwaway script (drizzle `getTableConfig` over every `schema.ts` table vs `information_schema.columns`): `schema.ts tables: 30, columns: 286; DB tables: 30, columns: 286`, 0 missing on either side, 0 NOT NULL mismatches (D9) |

---

## 4 · Claims audit

| Claim (log) | What I did | Verdict |
|---|---|---|
| L1: "the §4.2 table, tutor → student: masked=true on all 10" | Re-ran it through the real API (§4.2) | **True**, byte-for-byte the same stored and returned bodies as L1 pasted |
| L2: "the API never sends the last name to student-facing endpoints" | Built and started the real API; seeded "Mohamed Ben Ali" (verified, one upcoming class, one real review); booked through `POST /bookings`; probed 13 endpoints | **True.** `GET /tutors/<slug>/storefront`, `/tutors/explore?q=Mohamed`, `?q=Ben%20Ali`, `?level=bac`, `/tutors/public-refs`, `/tutors/<slug>/reviews`, `GET /classes/<id>` (anonymous and as the booked student), `/student/dashboard`, `/notifications`: shown name "Mohamed B." or none. `/threads` and `/threads/<id>`: "Mohamed" (first name only). `/classes/<id>/join`: none. **0/13 contain "Ben Ali".** Residual: a search for the surname (`q=Ben Ali`) still *finds* the tutor, so the surname can be confirmed by inference. L2 flagged this for the founder (D10) |
| L3: "no payment timing other than 'avant la séance'" | Grepped the web for other timings and stories; read the payment scan test | Timing: true (no "après la séance", "au mois", "mensuel" or "directement" story in the rendered copy). **But `/tarifs` metadata still says "L'élève ne paie jamais Tnajem." / "التلميذ ما يخلّص حتى حاجة لـ Tnajem."**, which contradicts D4 (D2). **And `/dashboard/payout` renders "Portefeuille Flouci" under "Retraits prévus vers"**, because `lib/i18n.ts` is excluded from the A22 scan (D3) |
| L3: "the lock is load-bearing" | Removed only the advisory-lock line | **True**: the concurrency test fails (1 expected, 2 free) |
| L4: "hidden text never leaves the DB for a non-admin" | Read every `from(messages)` / `from(reviews)` in `apps/api/src` and `packages/db/src` | **True.** The only non-admin text reads are `messages.ts:264` and `guardian.ts:323` (`visibleMessageBody`) and `tutors.ts:303` (`visibleReviewText`), and the placeholder is swapped in inside the SQL `CASE`. The other reads are counts or ids. `moderation.ts` (raw text) sits behind `requireAdmin` |
| L5: "title 120 / duration 240 / seats 200 in one zod schema used by both form and route" | Read `packages/shared/src/class-input.ts`, `classes.ts:58-85`, `new-class/page.tsx` | **True.** `CLASS_LIMITS` = 120 / 240 / 200 in one `classLimitsSchema`; `POST /classes` calls `checkClassLimits`; the form imports `CLASS_LIMITS` + `checkClassLimits` (`maxLength`, `max`, a pre-submit check). `POST /classes` is the only class-writing route |
| L6: "/privacy and /terms make no false claim" | Read both FR halves against `thread-state.ts`, `erasure.ts`, `moderation-hide.ts`, `age.ts`, `free-first-entitlement.ts`, `bookings.ts`, `moderation.ts` (`230c16b`) | **Largely true.** The 5 §4 sentences are resolved; closing rules, adult-only pilot, first name + initial, moderation hide and the payments "Bientôt" label all match the code. Two small inaccuracies: terms §8 says a student sees "le prénom de son prof et l'initiale de son nom", but in a conversation the student sees the **first name only** (stricter, so no privacy harm; D12). The consent-form line "Ton parent recevra un e-mail pour confirmer" is untrue in the code (`POST /consent` sends no mail). It sits behind `ALLOW_MINORS` and describes Dm3; L6 flagged it (D11) |
| L2/`296d1ff`: "one ALLOW_MINORS switch everywhere" | Grepped `process.env.ALLOW_MINORS` | **True**: read only in `packages/shared/src/age.ts:49` (tests aside) |
| L1: A1 fixed-point invariant | Revert proof | The invariant tests are **vacuous** against finding 1 (D4) |

### Landmines (Phase A diff `8523ef3..HEAD`)
- **RTL**: 0 added `ml-/mr-/pl-/pr-/text-left/text-right/left-/right-/border-l/border-r/rounded-l/rounded-r/float-*` classes and 0 `left:`/`right:`/`margin-left`/`padding-right` declarations among the 1875 added `apps/web` lines. Guardrail 1: 0 physical declarations.
- **`<img>`**: 0 added. **Raw hex**: 0 added (guardrail 4: 0 outside `globals.css`).
- **FR/AR parity**: typecheck green (`ar: typeof fr`); guardrail 2: 55 page-local copy objects, 1079 keys per locale, identical.
- **`// LEGAL-REVIEW:`** is present on the changed consent/basis/retention wording in `privacy/page.tsx`, `terms/page.tsx`,
  `auth/consent/page.tsx`, `i18n.ts`, `SignupInner.tsx`, `age.ts`, `erasure.ts`, `admin.ts`, `0025` and `0030`. **Missing at one code site:**
  `packages/db/src/retention.ts:132`, where A26 changes *which* rounds the 90-day purge may take. The privacy page carries the marker; the
  retention code does not (D6).
- **No env value printed**: nothing in `phase-a-logs/*.md` matches a connection string or secret assignment. No added line prints
  `process.env.*`. `.env.example`, `DEPLOY.md` and the deploy workflow add only empty values or `${{ secrets.* }}`.
- **`apps/web` never touches the DB**: no added import of `@tnajem/db`, `postgres` or `drizzle` in `apps/web`. **`AUTH_SECRET`**: untouched by Phase A.
- **Migrations**: 0025–0030 are all additive in effect. They add nullable/defaulted columns, re-key an index (0026) and drop a NOT
  NULL (0030) and a default (0027). The only `DROP COLUMN` lines are in rollback comments. Each file carries a rollback note.

---

## 5 · DISCREPANCIES

1. **D1 · The §4.3 grep is not empty.** Where: `apps/api/test/free-first-advertising.test.ts:10,48,49`,
   `apps/api/test/legal-truth.test.ts:159`, `apps/api/test/payment-story.test.ts:13`, `apps/web/app/[locale]/explore/page.tsx:48`
   (a comment). **Severity: low**: every hit is an absence-assertion or a comment, and nothing is rendered. Evidence: §4.3 above,
   `grep exit: 0`. Fix: reword the explore comment (e.g. "the dinar-payment line removed"), and either exclude `apps/api/test` from
   the gate grep or build those needles from fragments in the tests.

2. **D2 · `/tarifs` metadata still tells the student they never pay Tnajem.** Where:
   `apps/web/app/[locale]/tarifs/page.tsx:40-41`, the `generateMetadata` description, i.e. the Google snippet and the WhatsApp/OG preview:
   FR "… et 10 % uniquement sur les paiements traités par Tnajem. **L'élève ne paie jamais Tnajem.**", AR "… **التلميذ ما يخلّص حتى حاجة لـ Tnajem.**".
   A25 (`8e84c2b`) edited this line and left the sentence. **Severity: medium.** It contradicts D4 ("the student pays online, through Tnajem,
   before the session") on a public page, and L3's log says this sentence was removed. The A22 source scan does not match
   "ne paie jamais Tnajem", and the e2e crawler checks visible text, not `<meta>`. Fix: drop the sentence in both locales. Add
   `/ne paie(nt)? jamais Tnajem|ما يخلّص حتى حاجة لـ Tnajem/` to `CONTRADICTIONS` in `payment-story.test.ts`, and have
   `e2e/payment-story.spec.ts` also check `meta[name=description]` and `og:description`.

3. **D3 · A payment provider is still named on a rendered page.** Where: `apps/web/lib/i18n.ts:123` `payout.wallet: "Portefeuille Flouci"`
   (AR `محفظة فلوسي`, `:325`), rendered unconditionally at `apps/web/app/[locale]/dashboard/payout/page.tsx:190` under
   "Retraits prévus vers". Also `i18n.ts:100` `cashout: "Retirer vers Flouci"` (rendered only when payments are on). **Severity: medium**
   (tutor-facing, labelled as future). A22 says Phase E decides the provider, D4 names Konnect/ClicToPay, and the A22 test
   "no web copy … names a provider" claims to catch `flouci` but excludes `lib/i18n.ts` (`EXCLUDED = [/lib[\\/]i18n\.ts$/]`). Fix: make
   the rail label generic ("Portefeuille électronique" / "محفظة إلكترونية") and the CTA "Retirer mes gains". Then narrow the exclusion
   so rendered `i18n.ts` keys are scanned too.

4. **D4 · The A1 fixed-point invariant tests cannot detect finding 1.** Where: `apps/api/test/contact-info.test.ts`, the ten
   "…: the mask is a fixed point" tests. **Severity: low**, because the "leaks none of" tests do catch the bug. Evidence: with `f85ae25` reverted, all 10
   invariant tests pass (`ok 2 - "wa.me/21624555666": the mask is a fixed point`), because the old detector does not recognise
   `[masqué]/21624555666` as contact info. The spec presented the invariant as a guard, and it proves nothing for these inputs. Fix: also assert
   that the mask removes every digit run of 6+ and every handle token from the input, or run the invariant through a stricter
   "raw digits/handle remaining" check.

5. **D5 · The reserved migration numbers were not kept exactly.** Where: A26's `tutors.pending_full_name` lives in
   `0029_content_moderation.sql`, the file reserved for A28 "only if needed". A18.2's phone change landed as `0030_consent_phone_optional.sql`
   after being written as `0027_consent_phone_optional.sql`. **Severity: low.** It is documented by `296d1ff`, the numbers are unique and
   `db:sql` is idempotent. Evidence: `ls packages/db/sql`, and the A18.2 revert conflict "renamed to 0030 in HEAD". Fix: none needed. Record it in
   `PHASE_A_REPORT.md`.

6. **D6 · A retention-logic change has no `// LEGAL-REVIEW:` marker at the code site.** Where: `packages/db/src/retention.ts:132-136`
   (A26: the 90-day purge now skips a tutor whose latest round is newer than the decision, so older scans wait for the newer decision).
   **Severity: low.** The privacy page carries the marker; Landmine 9 asks for it on every retention rule touched. Fix: add
   `// LEGAL-REVIEW: per-document retention clock (older rounds wait for the newest decision)`.

7. **D7 · §2 "the server refuses … suspended tutors" has no direct test.** Where: `apps/api/src/routes/bookings.ts:160`
   (`tut.suspendedAt → "unavailable"`). **Severity: low (pre-existing gap).** Evidence: no e2e or API test books a *scheduled* class
   of a tutor whose `suspended_at` is set. `journey-admin.spec.ts` blocks the tutor, which *cancels* the class first, so the status check
   answers instead. Fix: an API test that sets `tutors.suspended_at` on a verified tutor with a scheduled class and asserts
   `POST /bookings → { ok:false, error:"unavailable" }` and `seats_taken` unchanged.

8. **D8 · §2 "three independent locks keep demo data out of production" has only one proven lock.** Where: `apps/web/lib/demo.ts`
   (`demoEnabled`), `apps/web/next.config.mjs:24` (`!isProd && TNAJEM_DEMO === "1" && !API_URL`), `:103` (the webpack swap).
   **Severity: low (pre-existing gap).** Only guardrail 6 (the swap) is exercised. Nothing tests that a production `NODE_ENV`, an unset
   `TNAJEM_DEMO` or a set `API_URL` each keeps `demoEnabled` false. Fix: a unit test of the `demoActive` expression, table-driven over
   the three inputs.

9. **D9 · The §2 proof "schema and migrations match column for column (`npm run db:check`)" does not test what it says.**
   Where: `packages/db/bin/check.ts:140-190`. It parses the SQL files for `CREATE TABLE`/`ADD COLUMN` and checks those exist in the DB,
   but **never reads `schema.ts`**. Every lane cited it as proof that `schema.ts` matches. **Severity: low**, because the property holds today:
   my direct comparison found 30/30 tables and 286/286 columns, 0 missing on either side and 0 NOT NULL mismatches. Fix: add that comparison
   (drizzle `getTableConfig` vs `information_schema.columns`, plus nullability) to `db:check`, so a `schema.ts` drift fails the gate.

10. **D10 · Explore search still matches a tutor's surname.** Where: `apps/api/src/routes/tutors.ts:373` (`ilike(tutors.fullName, like)`).
    **Severity: low.** Disclosed by L2 as a founder decision; the API never sends the last name. Evidence: `GET /tutors/explore?q=Ben%20Ali`
    returns the "Mohamed B." card. Fix (if the founder wants D1 strict): match only the first name and the shown form, and update
    `past-class.spec.ts`, which searches by a two-word name.

11. **D11 · The consent form promises an e-mail that is never sent.** Where: `apps/web/lib/i18n.ts` consent `info`
    ("Ton parent recevra un e-mail pour confirmer." / "وليّك باش يوصلو إيميل باش يأكّد."), and `POST /consent` (`apps/api/src/routes/misc.ts`)
    has no `sendMail`. **Severity: low now, but high the day `ALLOW_MINORS=1`.** The text is the spec's own wording for A18.1 and is hidden
    while minors are off, yet the whole Playwright suite runs with it visible. L6 flagged it. Fix: before Phase D opens minors, either build Dm3's
    mail or change the line to what happens ("Ton parent pourra confirmer depuis son espace parent").

12. **D12 · Terms §8 overstates what a student sees of the tutor in a conversation.** Where: `apps/web/app/[locale]/terms/page.tsx`
    §8 ("un élève voit le prénom de son prof et l'initiale de son nom"). In `GET /threads` and `GET /threads/:id` the student sees the
    **first name only** (`publicDisplayName`; my probe: "Mohamed"). **Severity: low**: the real behaviour is stricter, so it does no privacy
    harm, but the sentence is not exact. Fix: "…le prénom de son prof (et l'initiale de son nom sur sa page)".

No other discrepancy was found. Every lane claim I tested reproduced: A1's table, A6's lock, the A23 name masking (13
endpoints), A28's hide path, the A18.16 limits, and the single `ALLOW_MINORS` read. Every revert proof held.
