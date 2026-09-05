# Tnajem — تنجّم

*"Shopify for Tunisian tutors."* Every verified tutor gets a public storefront at `tnajem.tn/<slug>` — their live classes, their packs, their **real** reviews — and a link they can paste on WhatsApp, TikTok or Insta. Students book a seat.

Mobile-first, bilingual **FR / العربية with full RTL**, on the cobalt/sand/ochre design system.

---

## Layout

This is an **npm-workspaces monorepo**. The browser talks to `apps/web`; only `apps/api` and the migration runner hold database credentials.

```
apps/web        Next.js 14 (App Router). Server components + server actions.
                Owns NO database: every action is a one-hop fetch to the API.
apps/api        Fastify. Owns the schema, the session table, the rate limiter,
                the admin allow-list and the identity documents.
packages/db     Drizzle schema, createDb() factory, sql/ migrations, retention.
packages/shared Pure: DTOs, validators, the OTP hash, mail/sms transports.
tools/ui-audit  Contrast / a11y / keyboard / no-JS harness.
e2e/            Playwright. One suite, two configs (host and Docker).
```

The split is a **boundary, not a rewrite**: every server action kept its exported
signature, so no page or component moved. `apps/web/lib/api.ts` is where the hop
happens, and its header lists the five rules that make it behaviour-preserving.

---

## Quickstart

### Docker — the whole stack, nothing installed

```bash
export AUTH_SECRET=$(openssl rand -hex 32)   # required; no default
docker compose up -d --build
curl -sf localhost:3000/fr                   # the web app
curl -sf localhost:4000/health               # {"ok":true,"db":true,...}
```

`db` → `migrate` (runs once) → `api` → `web`. Postgres is published on host port
**15432**, not 5432, so it cannot collide with a local install; override with
`DB_PUBLISHED_PORT`.

### Native — two processes

```bash
npm install
cp .env.example .env            # DATABASE_URL, AUTH_SECRET, STORAGE_DIR (absolute)
npm run db:sql                  # apply packages/db/sql/ — idempotent, transactional
npm run db:seed                 # optional: one demo tutor for local dev
npm run dev:api                 # Fastify on :4000
npm run dev                     # Next on :3000
```

You need a **Postgres 18** running. Browse the data with `npm run db:studio`.

> **Never run `npm run db:push`.** It is deliberately blocked (the script exits 1).
> drizzle-kit 0.28 is not PG18-aware and generates `DROP CONSTRAINT` for roughly
> sixty `NOT NULL` columns. Schema changes go in a numbered file under
> `packages/db/sql/`. `packages/db/sql/0000_init.sql` is the baseline, so a fresh
> database is created by `db:sql` alone.

**Without `API_URL`** the web app still boots **in development** on in-memory
fixtures (`apps/web/lib/demo.ts`), so you can see every screen with zero setup.
That fallback is **hard-disabled in production** — see *Demo mode* below. Note the
condition is `API_URL`, not `DATABASE_URL`: the web app no longer has one, and
leaving the old check in place would have emptied the catalogue silently the day
the credential was removed.

---

## What the app actually does

**Auth — e-mail OTP, opaque sessions.** `OTP_CHANNEL=email` (the default): address →
6-digit code → a `randomBytes(32)` token in an HttpOnly cookie, backed by the
`sessions` + `otp_codes` tables. Nothing is signed; both processes validate the
same row, which is exactly what let the API be extracted incrementally. Mail goes
out over SMTP (`packages/shared/src/mail.ts`, nodemailer) when `MAIL_*` is set.
**In dev with no provider the code is shown on-screen**; in production that path
**fails closed** — returning it unconditionally would make a `MAIL_*`-less deploy
an account-takeover oracle. An SMS channel exists (`OTP_CHANNEL=sms`, Twilio) but
is not the shipped configuration.

**Guardian consent (INPDP).** A minor is routed to `/auth/consent` before they can
use the app; signing writes a `consents` row. `?next=` is carried through the whole
flow (auth → consent → wherever they were going), behind an open-redirect guard.

**Tutors are hand-verified — one by one.** `/onboarding` creates the storefront
(status `draft`), `/onboarding/verify` uploads identity documents, and a human
approves or rejects in `/admin/verifications` — gated by **`ADMIN_EMAILS`**, not
`ADMIN_PHONES`: login is e-mail, and most admin profiles have no phone number at
all. **Only `status = "verified"` tutors are public** — on `/explore`, on
`/[slug]`, and in the sitemap.

An unverified tutor's storefront returns **200, not 404**, and renders a branded
not-found body with `robots: noindex`. That is deliberate: Next 14 renders a
runtime `notFound()` client-side only, so the 404 path shipped a 6-byte body — a
white screen on a slow connection.

**Reviews are real.** One review per (student, class), writable only by a student
who actually booked it, only after the class started. `tutors.rating` /
`students_count` are recomputed from the `reviews` / `bookings` tables. **A tutor
with no reviews shows "Nouveau" — never a fabricated star score, and no
`AggregateRating` JSON-LD is emitted unless real rows exist.**

**Free first session.** Per class, `classes.is_free_first`. Booking takes a seat
and creates a `booking`; no money is involved anywhere.

**Seats cannot be oversold.** The claim is a single atomic statement
(`update ... where seats_taken < seats returning`), plus a `unique(class_id,
student_id)` index so one student cannot drain a class by racing themselves.
`e2e/seat-claim.race.spec.ts` fires 16 simultaneous claims at the last seat and
asserts exactly one wins.

**Live classes — Jitsi, one room per class.** `packages/shared/src/live.ts` derives
the room from the class id, so tutor and student always compute the same URL. A
tutor can override it with their own link via `classes.meet_url`.

**Payments — OFF.** Nothing in this app moves money.
`packages/shared/src/payments.ts` is a provider-agnostic scaffold (Konnect /
Flouci adapters, both stubs) behind a master switch: `paymentsEnabled()` is true
**only** when `PAYMENTS_ENABLED=1`. While off, every adapter method throws and the
tutor balance is a real `0` — we never fabricate earnings.

**ID-document retention.** `/privacy` promises identity documents are deleted at
most **90 days** after the verification decision. That promise is kept by
`packages/db/src/retention.ts`, reached through `GET|POST /cron/purge` on the API
with a `CRON_SECRET` bearer token (or `npm run db:purge` by hand). **If it is not
scheduled, the page is lying.** See DEPLOY.md §7.

**Notifications.** In-app `notifications` rows are the always-on channel; SMS is
best-effort on top. WhatsApp reminders are **not** built. There is no `/messages`
route yet.

---

## Architecture notes

- **Postgres + Drizzle, no RLS**: authorization is enforced in the API's route
  handlers, never in the database.
- **Every domain refusal is HTTP 200** with `{ ok: false, error: "<code>" }`. 400
  means the request shape failed zod at the boundary; 500 means unhandled. The
  client branches on those strings, so a status code would break the contract.
- **Cookies, not tokens in localStorage.** The session cookie is HttpOnly,
  `SameSite=Lax`, and `Secure` in production. A JWT in localStorage would be
  XSS-readable — strictly worse. The browser only ever talks to `apps/web`, which
  reads the token out of the API's JSON response and sets the cookie itself
  (`apps/web/lib/auth.ts::adoptSession`), so the cookie is **host-only** — no
  `Domain` attribute, which is the tighter option. `COOKIE_DOMAIN` on the API side
  configures the `Set-Cookie` the API sends on its *own* responses; through the
  server-side proxy that header is discarded, so it does nothing today. It starts
  mattering the moment a browser calls `api.tnajem.tn` directly — at which point
  the web writer has to grow the same `Domain` or the two will disagree.
- **`TRUSTED_PROXIES` is load-bearing.** It keys the per-IP OTP limiter now that
  the browser no longer talks to the throttling process. Unset in production the
  API trusts nothing and every request shares one bucket (degraded but
  unforgeable); `true` would let anyone bypass the limiter by rotating
  `X-Forwarded-For`. Set it to the web tier's address, never to a boolean.
- **`AUTH_SECRET` resolves lazily, on purpose.** Every page imports auth, so
  throwing at module load would kill `next build` on any host that injects secrets
  at runtime. It logs and continues at build time; the API refuses to *start*
  without it in production.
- `middleware.ts` guards `/dashboard`, `/student`, `/onboarding`, `/account`,
  `/live` and bounces guests to `/auth?next=…`.

## Routes

`/` landing · `/pour-les-profs` tutor landing · `/explore` marketplace · `/<slug>`
storefront · `/class/[id]` · `/checkout?class=<id>` · `/live/[id]` · `/dashboard`
(+ `new-class`, `new-pack`, `payout`) · `/student` · `/onboarding` (+ `/verify`) ·
`/admin/verifications` · `/account` · `/auth` (+ `/consent`) · `/terms` ·
`/privacy`

## Scripts

| script | what it does |
| --- | --- |
| `npm run dev` / `dev:api` | Next on :3000 / Fastify on :4000 |
| `npm run build` | builds both apps |
| `npm run start:standalone` | serves the web build (**`next start` does not work with `output:"standalone"`** — it listens and never answers) |
| `npm run typecheck` | every workspace + `e2e/` |
| `npm run test` | API unit tests, then the Playwright suite |
| `npm run test:e2e:docker` | the same Playwright suite against `docker compose` |
| `npm run db:sql` | apply `packages/db/sql/` — idempotent, transactional |
| `npm run db:studio` | Drizzle Studio |
| `npm run db:seed` | one demo tutor, **local dev only** (refuses with `NODE_ENV=production`) |
| `npm run db:purge -- --dry-run` | preview the expired-ID-document purge (the trailing `--` is required — npm eats the flag without it) |
| `npm run ui:audit` | contrast · guardrails · no-JS · a11y · keyboard |

## Testing

One suite, two deployments:

```bash
npx playwright test                                    # host: two node processes
docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d --build
npx playwright test --config=e2e/docker.config.ts      # the containers
```

Not a spec file differs between them — that is the point. The E2E overlay adds a
local SMTP sink so the OTP spec exercises the **real** production send path, and
bind-mounts `.e2e-storage` so the host seeder and the containerised API can see
the same identity documents.

The suite authenticates by minting a real session row and handing Playwright the
cookie (`e2e/support/session.ts`) — there is **no test-only endpoint** in the
production build. It refuses to run against any database that is not on this
machine.

## Demo mode (development only)

With no `API_URL`, **in development**, `apps/web/lib/data.ts` serves the fixtures
in `apps/web/lib/demo.ts` and any slug resolves to the demo storefront. Handy;
also a loaded gun.

The demo tutor is described as *verified, 4.9★, 1,240 students*. None of it is
real. So the gate is the **environment**, not the configuration:

- `demoEnabled === (process.env.NODE_ENV !== "production")`.
- In a production build the fixtures are **inert** (empty arrays; a zeroed,
  unverified, unrated storefront) — the fake rating is not even in the bundle.
- `getStorefront()` **throws** in production when there is no backend. It does not
  return `null`: a site-wide 404 storm would tell Google to deindex every real
  tutor page, while a 5xx honestly says "we are broken" — and pages us.

## Before real users

- [ ] **Schedule the ID-doc purge** (`CRON_SECRET` + a daily cron — DEPLOY.md §7).
      `/privacy` already promises it.
- [ ] `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAILS`, `NEXT_PUBLIC_SITE_URL`,
      `CORS_ORIGINS`, `TRUSTED_PROXIES` set; `STORAGE_DIR` on a **persistent
      volume** and **absolute** (the standalone server `chdir`s to its own
      directory).
- [ ] Real SMTP credentials (`MAIL_*`) — otherwise nobody outside dev can log in,
      and the API says so in its log rather than falling back.
- [ ] Leave `PAYMENTS_ENABLED` unset until legal sign-off. The payout UI is gated
      on it.
- [ ] INPDP declaration; EU/Tunisia data residency confirmed with counsel.
- [ ] Buy `tnajem.tn`; deploy per DEPLOY.md.

## Honest status

The backend separation is complete and gated. What has actually been run, not
inferred: `npm run typecheck` across every workspace, `npm run build` for both
apps, the API unit suite, and the Playwright suite **twice** — once against two
host processes and once against `docker compose`, 43 tests each, with no spec
edited between them.

Payments are legally gated and off. Guardian consent, the seat-claim race, the
admin document gate and the "no rating markup without real reviews" rule each have
a test that has been proven to fail when the guardrail is removed.

Not done: in-app messaging, tutor-side cancellation, storefront editing after
creation, parent accounts, and self-service account deletion.
