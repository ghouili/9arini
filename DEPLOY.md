# Deploying Tnajem to a VPS

Since the backend split there are **two processes**, not one:

| process | port | holds |
| --- | --- | --- |
| `@tnajem/web` — Next.js | 3000 | no database credentials at all |
| `@tnajem/api` — Fastify | 4000 | `DATABASE_URL`, `AUTH_SECRET`, `MAIL_*`, the ID scans |

Two ways to run them. **§A** is plain Node behind nginx with the Postgres already
on your VPS — the recommended shape, and what the rest of this document assumes.
**§B** is `docker compose`, which is also how the test suite runs. Steps marked
**(you)** need your server/accounts.

> **Two things will bite you if you skip them.** §7 (the ID-document purge cron —
> `/privacy` already promises it to every tutor) and §3's `STORAGE_DIR` (must be a
> **persistent** volume, or every ID scan vanishes on redeploy).

---

## 0. Local sanity check (you)
```
npm run typecheck    # every workspace + e2e/
npm run build        # builds BOTH apps; dev is lenient, the prod build is strict
npm run test         # API unit tests, then Playwright
```
Commit `package-lock.json` (run `npm install` once) for reproducible installs.

## 1. VPS prerequisites (you)
- Ubuntu/Debian VPS with **Node 22** (`nvm install 22` or NodeSource) and
  **Postgres 18 running**. Node 22 is what both Dockerfiles pin; 20 will probably
  work but is not what anything is tested on.
- Get the code on the box: `git clone …`, then `npm ci` **at the repo root** — this
  is a workspaces monorepo, and installing inside `apps/web` will not link
  `@tnajem/shared`.

## 2. Database (you)
```
sudo -u postgres psql -c "CREATE DATABASE tnajem;"
# (optional dedicated role instead of the superuser:)
# sudo -u postgres psql -c "CREATE ROLE tnajem LOGIN PASSWORD 'strongpass'; ALTER DATABASE tnajem OWNER TO tnajem;"
```
`packages/db/sql/0000_init.sql` is a real baseline — an empty database is fully
created by `npm run db:sql` (§4). You do not need to load a dump first.

## 3. Environment — one `.env` at the repo root

Both processes read the repo-root `.env` (and `.env.local`, which wins). A real
environment variable beats both — that is deliberate, so systemd, a container or
CI can configure the API without editing a file.

```
# ── Required by the API ────────────────────────────────────────────────────
DATABASE_URL=postgresql://tnajem:strongpass@127.0.0.1:5432/tnajem   # NO ?schema=public
AUTH_SECRET=<run: openssl rand -hex 32>
ADMIN_EMAILS=you@example.com               # who may approve tutors at /admin/verifications
STORAGE_DIR=/var/lib/tnajem/storage        # PERSISTENT, ABSOLUTE — see below
CRON_SECRET=<run: openssl rand -hex 32>    # protects /cron/purge — see §7
CORS_ORIGINS=https://tnajem.tn,https://www.tnajem.tn
TRUSTED_PROXIES=127.0.0.1                  # the web tier's address — see below
API_PORT=4000
API_HOST=127.0.0.1                         # loopback only; nginx is the front door

# ── Required by the web app ────────────────────────────────────────────────
API_URL=http://127.0.0.1:4000              # server-side only, NEVER NEXT_PUBLIC_
NEXT_PUBLIC_SITE_URL=https://tnajem.tn     # canonical origin

# ── Login e-mail (without this, nobody outside dev can log in) ─────────────
OTP_CHANNEL=email
MAIL_HOST=smtp.example.com
MAIL_PORT=465
MAIL_USER=...
MAIL_PASS=...
MAIL_FROM_ADDRESS=no-reply@tnajem.tn
MAIL_FROM_NAME=Tnajem

# ── Database tuning (optional — the defaults are right for a single VPS) ───
# DB_POOL_MAX=10   # postgres.js pool size PER NODE PROCESS. Default 10.
# DB_PREPARE=1     # server-side prepared statements. Set to 0 ONLY with PgBouncer.
# DB_SSL=require   # force TLS (auto: on for a remote host, off over loopback)

# ── Payments: LEAVE UNSET ──────────────────────────────────────────────────
# PAYMENTS_ENABLED=1
```

**`API_URL` must not be `NEXT_PUBLIC_`.** The browser never calls the API; the web
server does, from inside the box. Prefixing it would bake a private address into
the client bundle and invite someone to "fix" it by exposing port 4000 publicly.

**The web app has no `DATABASE_URL` and must not be given one.** If you find
yourself adding it, something has been ported backwards.

**`ADMIN_EMAILS`, not `ADMIN_PHONES`.** Login is e-mail OTP; most admin profiles
have no phone number at all, so a phone allow-list rejects every admin — which
previously showed up as a 403 on every identity-document view. `ADMIN_PHONES` is
still read when `OTP_CHANNEL=sms`, which is not the shipped configuration.

**`AUTH_SECRET` is a hard requirement in production.** It is the key every OTP hash
is derived from (`sha256(identifier:code:AUTH_SECRET)`), so a deploy that forgets
it would ship auth whose hashes an attacker can precompute from a default string
that is public in this repo. It resolves **lazily** (on the first OTP hash, not at
module load) *by design*: every page's server bundle imports auth, so a
module-load throw would kill `next build` on any box that injects secrets at
runtime. The API is stricter — `assertBootConfig()` **refuses to start** without it
in production, because Fastify has no build step to protect. If you see
*"FATAL CONFIG: AUTH_SECRET is not set"*, that check is doing its job.

**`CORS_ORIGINS` is an exact allow-list and the API refuses to start without it in
production.** Never `*`, and never reflect the request's `Origin` header — the
credentials here are cookies, and reflecting the origin hands any site on the
internet the ability to make authenticated requests as the logged-in user.

**`TRUSTED_PROXIES` decides whether the OTP rate limiter works.** `clientIp()` keys
`otp:req:ip` (10 per 10 min) and `otp:vfy:ip` (30 per 15 min). Now that the browser
talks to nginx and Next rather than to the throttling process, that key survives
two hops, and there are exactly two ways to get it wrong:

- **unset** → the API sees the web server's address for every user. All traffic
  collapses into **one bucket**: one attacker exhausts the limit for the entire
  internet. This is the *safe* failure — degraded, but unforgeable — and it is what
  you get by default in production.
- **`true`** → `X-Forwarded-For` becomes attacker-controlled and the per-IP limiter
  is bypassed by rotating a header. **Strictly worse than not splitting at all.**

So list **specific addresses** — the web tier's, and nothing else.

**`DB_POOL_MAX` (default 10)** is the pool size of **one Node process**. What
Postgres sees is `workers × DB_POOL_MAX`. Stock Postgres allows 100 connections,
3 reserved for superusers, and you want ~10 spare for psql/backups/the purge cron
— so keep the product **under ~87**. One API process at the default = 10; a
2-worker pm2 cluster = 20. Both are comfortable. If you raise the worker count,
**lower `DB_POOL_MAX`**. Raising the pool is *not* how you scale: a Postgres
backend is a forked process (~5-10MB), and throughput peaks around 2-4× CPU cores
of concurrently active queries. When 87 stops being enough the answer is
**PgBouncer**, not a bigger number (SCALABILITY.md §2).

**`DB_PREPARE`** — leave it on (the default). Prepared statements are a real win
on the hot point-lookups (`sessions.token`, `tutors.slug`). Set **`DB_PREPARE=0`
in the same change that introduces PgBouncer in transaction-pooling mode**, and
not before: a prepared statement lives on a server connection the next transaction
may not be handed back, so PgBouncer + prepare is a source of intermittent
"prepared statement does not exist" errors.

**`DB_SSL`** is auto-detected from the host and normally needs no value: TLS is
required when the database host is remote, and skipped over loopback (a default
local Postgres does not offer TLS, and forcing `require` there is a guaranteed
connection error). **The heuristic cannot tell a private container network from
the open internet**, which is why `docker-compose.yml` sets `DB_SSL=0` explicitly —
without it the API came up, answered `/health` with `db:false`, and gave no reason
at all. Set `DB_SSL=require` if you move Postgres off the box.

**`DATABASE_URL` is not optional in production.** The API exits at boot without it.
The web app, which has none, throws from `getStorefront()` when no backend is
configured rather than returning `null`: a site-wide 404 storm would tell Google to
deindex every real tutor page, while a 5xx honestly says "we are broken".

**`NEXT_PUBLIC_SITE_URL`** feeds `metadataBase`, `robots.txt` and the sitemap. Set
it **per environment** — a staging box that leaves it at the default emits canonical
links and a sitemap pointing at production, and Google will happily index the wrong
origin.

**`PAYMENTS_ENABLED`** is the master switch in `packages/shared/src/payments.ts`.
**Only the exact string `1` turns payments on**; unset/empty = OFF, so an env typo
can never start moving money. Leave it unset until counsel signs off *and* the
provider contract + webhook signature verification exist. While OFF, every payment
adapter throws and the tutor balance is a real `0`.

**`STORAGE_DIR` MUST be persistent, and MUST be absolute.** Tutors upload national
ID scans here (sensitive personal data under Tunisia's INPDP regime, Loi 2004-63).
On an ephemeral filesystem — a container layer, an instance without a mounted disk,
anything wiped on redeploy — the ID docs disappear on every deploy, which breaks
the admin review queue *and* leaves orphaned `verification_docs` rows pointing at
files that no longer exist. **Absolute** because Next's standalone `server.js`
`chdir`s to its own directory and CLI scripts run from whichever workspace invoked
them; a relative path resolved somewhere different three times in this project's
history, and each time the purge deleted rows while orphaning the files.
`storageBase()` now throws in production rather than guessing.

```
sudo mkdir -p /var/lib/tnajem/storage && sudo chown $USER /var/lib/tnajem/storage
sudo chmod 700 /var/lib/tnajem/storage
```

## 4. Migrate + build
```
npm run db:sql         # applies packages/db/sql/ (raw, idempotent, transactional)
npm run build          # both apps
```
**Do NOT run `npm run db:push`.** It is deliberately disabled (the script exits 1).
drizzle-kit 0.28 is not PostgreSQL 18-aware: PG17+ stores `NOT NULL` as *named*
catalog constraints, drizzle-kit doesn't recognise them, and it emits
`DROP CONSTRAINT "<table>_<col>_not_null"` for ~60 columns — i.e. it tries to strip
`NOT NULL` off most of the database. Schema changes go through the raw, idempotent,
transactional SQL files in `packages/db/sql/` via `npm run db:sql`; add a new
numbered `.sql` file for each change. (Re-enable push only as a deliberate,
verified task after upgrading drizzle-kit to a PG18-aware release.)

Every file is idempotent and replays cleanly, so re-running `db:sql` on a
half-migrated database is safe. There is **no migrations ledger** — idempotency is
the only guard, so keep it that way in every new file.

**Do NOT run `npm run db:seed` in production.** It publishes a demo tutor on
`/explore` and on a public storefront. The script refuses to run when
`NODE_ENV=production`; do not force it.

---

# §A — Plain Node behind nginx (recommended)

## 5. Run both processes

**pm2 (simplest):**
```
sudo npm i -g pm2
pm2 start "npm run start -w @tnajem/api"          --name tnajem-api
pm2 start "npm run start:standalone -w @tnajem/web" --name tnajem-web
pm2 save && pm2 startup                            # restart on reboot
```

> **`next start` does not work with `output: "standalone"`** — it logs *Ready*,
> binds the port, and never answers a request. Use `start:standalone`, which also
> copies in `.next/static` and `public/`; the standalone bundle ships without both.
> The standalone entry point is `.next/standalone/**apps/web**/server.js`, not the
> flat path every example assumes — `scripts/serve-standalone.mjs` locates it.

**systemd (alternative)** — two units. `/etc/systemd/system/tnajem-api.service`:
```
[Unit]
Description=Tnajem API
After=network.target postgresql.service
[Service]
WorkingDirectory=/home/USER/tnajem-app
ExecStart=/usr/bin/npm run start -w @tnajem/api
Restart=always
User=USER
[Install]
WantedBy=multi-user.target
```
`/etc/systemd/system/tnajem-web.service`:
```
[Unit]
Description=Tnajem web
After=network.target tnajem-api.service
[Service]
WorkingDirectory=/home/USER/tnajem-app
ExecStart=/usr/bin/npm run start:standalone -w @tnajem/web
Environment=PORT=3000
Restart=always
User=USER
[Install]
WantedBy=multi-user.target
```
`sudo systemctl enable --now tnajem-api tnajem-web`

Check both: `curl -sf 127.0.0.1:4000/health` must return `{"ok":true,"db":true,…}`.
**`db:false` with a 200 is a real failure** — the API is up and cannot reach
Postgres. The reason is in the API's log; it is not in the response body, because
`/health` is unauthenticated and a connection error carries the host, port and user.

## 6. nginx reverse proxy + HTTPS (you) — **do not `proxy_pass` everything** ⚠️

This is the **#1 bottleneck** (SCALABILITY.md §6). The naive config sends *every*
request to the single Node process — including `/_next/static/*`, which is
immutable, content-hashed, and something nginx can serve from disk at ~zero cost.
One storefront view is 1 HTML + **~10 asset requests**. A tutor pastes their link
into a WhatsApp group, three thousand phones open it, and that is **~30,000
requests** funnelled through one single-threaded Node process over slow 3G
connections that hold sockets open for a long time. Node falls over long before
Postgres does.

Three changes, all cheap, all before the pilot: **nginx serves the static assets**,
**nginx compresses**, **Cloudflare fronts the origin**.

`/etc/nginx/sites-available/tnajem`:
```nginx
server {
  server_name tnajem.tn www.tnajem.tn;
  # 15M, and the number is set by NEXT, not by nginx or the API.
  # There are three ceilings on a verification upload and they do not agree:
  #   Next   serverActions.bodySizeLimit = 12mb   (next.config.mjs) ← BINDING
  #   API    6 files x 8 MB = ~48 MB              (apps/api/src/server.ts)
  #   nginx  this line
  # The upload is a server action, so Next rejects first. Keep nginx comfortably
  # above 12mb so the rejection comes from the app with a message the UI can
  # show, rather than as a bare nginx 413. Raising this alone buys nothing.
  client_max_body_size 15M;

  # ── gzip (Node is NOT compressing for you) ─────────────────────────────────
  # Compression costs nginx microseconds and saves a mid-range Android on 3G
  # ~70% of the JS/CSS bytes. (text/html is not listed below because nginx always
  # compresses it once gzip is on — it cannot be added or removed from the list.)
  gzip              on;
  gzip_vary         on;                    # so caches key on Accept-Encoding
  gzip_proxied      any;                   # compress proxied responses too — the default is "off"
  gzip_comp_level   5;                     # 5 ≈ 95% of the savings of 9 at a third of the CPU
  gzip_min_length   1024;
  gzip_types text/plain text/css text/xml application/json application/javascript
             application/xml+rss image/svg+xml application/manifest+json;
  # (Optional, better: brotli — needs ngx_brotli, not in the stock Debian package.)

  # ── Static assets: served BY NGINX, never proxied ──────────────────────────
  # Everything under /_next/static/ is content-hashed by the build: the filename
  # changes whenever the bytes change, so it can be cached forever. `immutable`
  # tells the browser not to even send a revalidation request on reload.
  # NOTE: `alias` (not `root`), and note the apps/web/ segment — this is a
  # monorepo, and the build output is NOT at the repo root.
  location /_next/static/ {
    alias /home/USER/tnajem-app/apps/web/.next/static/;
    access_log off;
    expires 1y;
    add_header Cache-Control "public, max-age=31536000, immutable";
  }

  # apps/web/public/ holds six brand files (favicons, logo.png, og.png). They are
  # NOT content-hashed, so a SHORT TTL: `immutable` here would pin a stale logo in
  # every browser that ever loaded it, with no way to push a correction.
  location ~ ^/(favicon\.ico|favicon-32\.png|apple-touch-icon\.png|logo\.png|logo-white\.png|og\.png)$ {
    root /home/USER/tnajem-app/apps/web/public;
    access_log off;
    expires 1h;
    add_header Cache-Control "public, max-age=3600";
  }

  # ── Everything else → Next ─────────────────────────────────────────────────
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
    # (No `Upgrade`/`Connection: upgrade` headers: nothing here uses WebSockets in
    # production — the live class opens Jitsi in a NEW TAB, so that traffic never
    # touches this origin. Hardcoding them would only break upstream keep-alive.)
  }
}
```
`sudo ln -s … /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx`
Then HTTPS: `sudo certbot --nginx -d tnajem.tn -d www.tnajem.tn`.

> **Do NOT expose port 4000.** There is no `api.tnajem.tn` vhost above and that is
> deliberate: the browser never calls the API. Every request reaches it through the
> web app, which forwards the session cookie server-side. Publishing the API would
> add a second, publicly reachable authentication surface with a different CORS
> posture for exactly zero benefit — bind it to `127.0.0.1` (`API_HOST`) and leave
> it there. If a future feature genuinely needs direct browser access (a large
> upload bypassing the Next server, say), that is the change that also has to sort
> out `COOKIE_DOMAIN` on both writers and add the vhost — not a config tweak.

**Check it actually works** — the header must come from nginx, not Node:
```
curl -sI https://tnajem.tn/_next/static/… | grep -i cache-control
# → cache-control: public, max-age=31536000, immutable
curl -sH 'Accept-Encoding: gzip' -o /dev/null -w '%{size_download}\n' https://tnajem.tn/
```
If `nginx -t` passes but assets 404, the `alias` path is wrong — it must end in a
`/` and point at the real `apps/web/.next/static` of the build you are running.

> **X-Forwarded-For is a rate-limit key**, never an authz input. Keep the
> `proxy_set_header` line above *and* set `TRUSTED_PROXIES` (§3): the header now
> has to survive nginx → Next → Fastify, and either half missing collapses the
> per-IP OTP throttle into one shared bucket for the whole internet.

### Cloudflare in front (free tier) — do this too

nginx serving static from disk fixes the *CPU* cost; Cloudflare fixes the
*bandwidth and latency* cost, and it is the difference between a viral WhatsApp
link being a good day and an outage. Free tier is enough:

1. Move the domain's nameservers to Cloudflare, add an **A record → your VPS IP**,
   proxy status **Proxied** (orange cloud).
2. SSL/TLS mode: **Full (strict)** — you already have a real certbot certificate on
   the origin, so there is no reason to run anything weaker.
3. Caching → the `immutable` header above is what Cloudflare keys on: `/_next/static/*`
   is then served **from the edge**, and those ~10 asset requests per view never
   reach the VPS at all.
4. Turn on **Brotli** and **HTTP/3** (both one toggle) — this is also how you get
   Brotli without building `ngx_brotli`.
5. Leave **"Always Online"** off and do **not** add a cache rule for HTML: the
   storefront must be able to go dark within 60s of a rejection (see
   `apps/web/lib/cache.ts` / `revalidateTutor`). Caching HTML at the edge would put
   an uncontrollable second cache in front of that control.

**Ordering note:** with Cloudflare proxying, the client address arrives as
`CF-Connecting-IP`. Install Cloudflare's real-IP ranges
(`set_real_ip_from … ; real_ip_header CF-Connecting-IP;`) or every request will
appear to come from a Cloudflare address — same collapsed-throttle problem as
above, one bucket per Cloudflare edge node.

---

# §B — docker compose

```
export AUTH_SECRET=$(openssl rand -hex 32)
docker compose up -d --build
```

`db` (postgres:18.1-alpine, pinned) → `migrate` (its own service, runs **once**;
two API replicas racing `db:sql` is wrong even though every file is transactional)
→ `api` → `web`. Both app images are `node:22-slim`, **not alpine**: the lockfile
is generated on Windows and carries 97 `@esbuild` platform packages but zero
linux-musl ones, so `npm ci` on alpine installs no esbuild binary and the build
dies with a confusing exit 127. `sharp` has the same problem.

What to change before this is a production compose file rather than a local one:

- **Stop publishing `5432`.** The `db` service publishes `${DB_PUBLISHED_PORT:-15432}`
  so the E2E suite can seed from the host. Nothing outside the compose network
  should reach Postgres in production.
- **`DB_SSL=0` is a statement about the compose bridge**, where nothing leaves the
  machine. Point `DATABASE_URL` at another host and you must remove it.
- **`storage` is a named volume on purpose.** ID scans must survive a redeploy;
  `/privacy` promises 90 days, not "until we next ship". Back it up.
- Put nginx or Cloudflare in front for TLS and static caching — §6 applies
  unchanged, with `alias` pointing into the web container's mount or a copied-out
  `.next/static`.

The E2E overlay (`docker-compose.e2e.yml`) is **test-only** and must never be part
of a deploy: it bind-mounts a working directory over the storage volume, pins the
admin allow-list to a test identity, and points mail at a local sink.

---

## 7. Retention purge (documents, auth rows, closed accounts, expired plans) — **SCHEDULE THIS** ⚠️

One daily job, **four independent things swept**. Independent is the operative
word: each runs whether or not the others succeeded, because an expired grace
period must be honoured even if the document purge fails, and vice versa.

1. **ID documents past the 90-day window.** `/privacy` tells every tutor their
   identity documents are **deleted at most 90 days after the verification
   decision**. Until you add a cron, that promise is false, the ID scans sit on
   disk indefinitely, and that is an INPDP exposure with a paper trail pointing at
   our own privacy page.
2. **Expired `sessions` and `otp_codes`.** These grow by one row **per login** and
   **per OTP request**, forever — nothing else ever deletes them, and every login
   reads through the accumulated garbage. Deleting an expired row cannot log anyone
   out or invalidate a usable code: the auth layer already treats them as dead.
   (Indexed via `sessions_expires_at_idx` / `otp_codes_expires_at_idx`.)

3. **Accounts whose 30-day deletion grace has expired** (Step 15). Closing an
   account is a *request*, reversible for 30 days; this is the job that finally
   honours it. Without it, "supprimer mon compte" never deletes anything.
4. **Subscriptions past their expiry date** (Step 16). Bookkeeping only — the
   entitlement resolver already treats a past expiry as dead, so a night this does
   not run costs nobody an entitlement and gives nobody one. It flips the row's
   status so the one-active-grant index frees up and an admin is not shown an
   "active" plan that ran out in March.

`packages/db/src/retention.ts` implements the first two; `routes/moderation.ts` and
`lib/entitlements.ts` the last two. The CLI and the HTTP route each run **all
four**, and all four are idempotent, so overlapping runs are harmless. Pick **one**.

> **The endpoint moved.** It used to be `POST /api/cron/purge` on the *web* app.
> That route no longer exists — the web app owns no database. It is now
> **`GET|POST /cron/purge` on the API, port 4000**. An old crontab pointing at
> `https://tnajem.tn/api/cron/purge` will 404 every night, silently, while the
> privacy page keeps promising deletion. Check yours.

### Option A — HTTP route

`/cron/purge` accepts `GET` and `POST`, authenticates a `CRON_SECRET` bearer token
in constant time, and **refuses to run (503) if `CRON_SECRET` is unset** — it will
never expose an unauthenticated destructive endpoint. `?dryRun=1` previews without
deleting. The response body carries **counts only**; the tutor and document ids stay
in the server log, because anyone holding the token can call this and the ids are a
map of who uploaded what.

The API listens on loopback (§3, `API_HOST=127.0.0.1`), so the cron runs **on the
box**:
```
15 3 * * * curl -fsS -X POST http://127.0.0.1:4000/cron/purge \
  -H "Authorization: Bearer $CRON_SECRET" >> /var/log/tnajem-purge.log 2>&1
```
(`CRON_SECRET` is not in cron's environment by default — either inline the value or
add `CRON_SECRET=…` as a line at the top of the crontab.)

Under docker compose: `docker compose exec api node -e "fetch('http://127.0.0.1:4000/cron/purge',{method:'POST',headers:{authorization:'Bearer '+process.env.CRON_SECRET}}).then(r=>r.text()).then(console.log)"`

### Option B — systemd timer (running the CLI on the box)

`/etc/systemd/system/tnajem-purge.service`:
```
[Unit]
Description=Tnajem — purge expired ID documents (INPDP, 90 days)
After=network.target postgresql.service
[Service]
Type=oneshot
WorkingDirectory=/home/USER/tnajem-app
ExecStart=/usr/bin/npm run db:purge
User=USER
```
`/etc/systemd/system/tnajem-purge.timer`:
```
[Unit]
Description=Daily ID-document retention purge
[Timer]
OnCalendar=*-*-* 03:15:00
Persistent=true          # catch up if the box was off at 03:15
[Install]
WantedBy=timers.target
```
```
sudo systemctl daemon-reload
sudo systemctl enable --now tnajem-purge.timer
systemctl list-timers tnajem-purge.timer     # confirm the next run
npm run db:purge -- --dry-run                # confirm it finds what you expect
```
**The trailing `--` is required.** `npm run db:purge --dry-run` swallows the flag
and runs a **real purge** — that has already happened once here.

**Verify it actually ran** — check the log/journal after the first night. A purge cron
that silently fails is indistinguishable from one you never wrote.

---

## Notes
- Back up **Postgres** and the **`STORAGE_DIR`** folder together; the DB rows and
  the files on disk are two halves of one record. ID docs are served only via the
  admin-gated `/api/admin/doc/[id]` route on the web app — which is a **streaming
  pass-through that makes no access decision of its own**. The API decides, using
  `ADMIN_EMAILS`. Never serve them from the public web root.
- Schema changes: add a numbered file to `packages/db/sql/` and run `npm run db:sql`
  (idempotent, transactional). `db:push` is deliberately disabled — it is not
  PG18-safe (see §4).
- **Only verified tutors are public** (`/explore`, `/<slug>`, sitemap). Approve them
  at `/admin/verifications` — access is limited to the addresses in `ADMIN_EMAILS`.
- **Plans are granted by hand at `/admin/plans`**, same allowlist. There is no
  checkout: payments are off, so a grant hands out entitlements and bills nobody.
  While `PAYMENTS_ENABLED` is unset every tutor is on the `pilot` plan (no limits);
  **the day you set it, ungranted tutors drop to `gratuit` — one open class.**
  Move the tutors you mean to keep unlimited onto plans *before* flipping it.
  Every grant and revoke is written to `admin_actions`.
- An unverified tutor's storefront returns **200 with a branded not-found body and
  `robots: noindex`**, not a 404. Do not "fix" this: the 404 path renders
  client-side only in Next 14 and shipped a 6-byte body.
- Payments stay off (`PAYMENTS_ENABLED` unset) until legal/INPDP sign-off.
