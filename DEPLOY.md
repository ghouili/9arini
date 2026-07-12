# Deploying 9arini to a VPS — no Docker

Plain Node deploy: `next build` → run with **pm2** (or systemd) behind an **nginx**
reverse proxy, using the **Postgres already on your VPS**. Steps marked **(you)**
need your server/accounts.

> **Two things will bite you if you skip them.** §7 (the ID-document purge cron —
> `/privacy` already promises it to every tutor) and §3's `STORAGE_DIR` (must be a
> **persistent** volume, or every ID scan vanishes on redeploy).

---

## 0. Local sanity check (you)
```
cd 9arini-app
npm run build      # dev is lenient; the prod build is strict — fix/paste any errors
```
Commit `package-lock.json` too (run `npm install` once) for reproducible installs.

## 1. VPS prerequisites (you)
- Ubuntu/Debian VPS with **Node 20** (`nvm install 20` or NodeSource) and **Postgres running**.
- Get the code on the box: `git clone …` (or `scp` the folder), then `cd 9arini-app && npm ci`.

## 2. Database (you)
```
sudo -u postgres psql -c "CREATE DATABASE qarini;"
# (optional dedicated role instead of the superuser:)
# sudo -u postgres psql -c "CREATE ROLE qarini LOGIN PASSWORD 'strongpass'; ALTER DATABASE qarini OWNER TO qarini;"
```

## 3. Environment — create `.env.local` on the VPS
```
# --- Required ---
DATABASE_URL=postgresql://admin:admin@127.0.0.1:5432/qarini   # NO ?schema=public
AUTH_SECRET=<run: openssl rand -hex 32>
ADMIN_PHONES=+216XXXXXXXX                  # who may approve tutors at /admin/verifications
NEXT_PUBLIC_SITE_URL=https://9arini.tn     # canonical origin
STORAGE_DIR=/var/lib/9arini/storage        # PERSISTENT volume — see below
CRON_SECRET=<run: openssl rand -hex 32>    # protects /api/cron/purge — see §7

# --- SMS (without this, nobody outside dev can log in) ---
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxx    # or TWILIO_FROM=+1...

# --- Database tuning (optional — the defaults are right for a single VPS) ---
# DB_POOL_MAX=10   # postgres.js pool size PER NODE PROCESS. Default 10.
# DB_PREPARE=1     # server-side prepared statements. Set to 0 ONLY with PgBouncer.
# DB_SSL=require   # force TLS (auto: on for a remote host, off over loopback)

# --- Payments: LEAVE UNSET ---
# PAYMENTS_ENABLED=1
```

**`AUTH_SECRET` is a hard requirement in production.** It is the key every OTP hash
is derived from (`sha256(phone:code:AUTH_SECRET)`), so a deploy that forgets it
would ship auth whose hashes an attacker can precompute from a default string that
is public in this repo. `lib/auth.ts` resolves it **lazily** (on the first OTP
hash, not at module load) *by design*: every page's server bundle imports
`lib/auth`, so a module-load throw would kill `next build` on any box that injects
secrets at runtime (CI build, `docker build`, runtime-env platforms). Instead, with
`NODE_ENV=production` and `AUTH_SECRET` unset/empty the process **logs a
`FATAL CONFIG` line on boot** and then **throws on the first login attempt** — every
login fails loudly, before a single code is ever minted with the insecure default,
but the build and static-page generation are unaffected. If you see
*"FATAL CONFIG: AUTH_SECRET is not set"* in the logs, that check is doing its job —
generate one with `openssl rand -hex 32` and restart.

**`DB_POOL_MAX` (default 10)** is the pool size of **one Node process**. What
Postgres sees is `workers × DB_POOL_MAX`. Stock Postgres allows 100 connections,
3 reserved for superusers, and you want ~10 spare for psql/backups/the purge cron
— so keep the product **under ~87**. One process at the default = 10; the
recommended 2-worker pm2 cluster = 20. Both are comfortable. If you raise the
worker count, **lower `DB_POOL_MAX`**. Raising the pool is *not* how you scale: a
Postgres backend is a forked process (~5-10MB), and throughput peaks around
2-4× CPU cores of concurrently active queries. When 87 stops being enough the
answer is **PgBouncer**, not a bigger number (SCALABILITY.md §2).

**`DB_PREPARE`** — leave it on (the default). Prepared statements are a real win
on the hot point-lookups (`sessions.token`, `tutors.slug`). Set **`DB_PREPARE=0`
in the same change that introduces PgBouncer in transaction-pooling mode**, and
not before: a prepared statement lives on a server connection the next transaction
may not be handed back, so PgBouncer + prepare is a source of intermittent
"prepared statement does not exist" errors.

**`DB_SSL`** is auto-detected and normally needs no value: TLS is required when
the database host is remote, and skipped over the loopback interface (a default
local Postgres does not offer TLS, and forcing `require` there is a guaranteed
connection error). Set `DB_SSL=require` if you move Postgres off the box.

**`DATABASE_URL` is not optional in production.** If it is missing, the app does
**not** quietly fall back to demo data — `lib/data.ts` throws and every storefront
serves the 500 page. That is deliberate: a prod boot without a database used to
serve a fabricated "4.9★, 1,240 students, verified" tutor at *every* URL. An
outage is recoverable; publishing a fake tutor on a real tutor's URL is not.

**`NEXT_PUBLIC_SITE_URL`** feeds `metadataBase`, `robots.txt` and the sitemap. Set
it **per environment** — a staging box that leaves it at the default emits canonical
links and a sitemap pointing at production, and Google will happily index the wrong
origin.

**`PAYMENTS_ENABLED`** is the master switch in `lib/payments.ts`. **Only the exact
string `1` turns payments on**; unset/empty = OFF, so an env typo can never start
moving money. Leave it unset until counsel signs off *and* the provider contract +
webhook signature verification exist. While OFF, every payment adapter throws and
the tutor balance is a real `0`.

**`STORAGE_DIR` MUST be a persistent volume.** Tutors upload national ID scans here
(sensitive personal data under Tunisia's INPDP regime, Loi 2004-63). On an ephemeral
filesystem — a container layer, a Render instance without a mounted disk, anything
wiped on redeploy — the ID docs disappear on every deploy, which breaks the admin
review queue *and* leaves orphaned `verification_docs` rows pointing at files that
no longer exist. Mount a real disk, keep it off the public web root, back it up with
Postgres.

```
sudo mkdir -p /var/lib/9arini/storage && sudo chown $USER /var/lib/9arini/storage
sudo chmod 700 /var/lib/9arini/storage
```

## 4. Migrate + build
```
npm run db:sql         # applies scripts/sql/ (raw, idempotent, transactional)
npm run build
```
**Do NOT run `npm run db:push`.** It is deliberately disabled (package.json exits
with an error). drizzle-kit 0.28 is not PostgreSQL 17/18-aware: PG17+ stores
`NOT NULL` as *named* catalog constraints, drizzle-kit doesn't recognise them, and
it emits `DROP CONSTRAINT "<table>_<col>_not_null"` for ~60 columns — i.e. it tries
to strip `NOT NULL` off most of the database. Schema changes go through the raw,
idempotent, transactional SQL files in `scripts/sql/` via `npm run db:sql`; add a
new numbered `.sql` file for each change. (Re-enable push only as a deliberate,
verified task after upgrading drizzle-kit to a PG17-aware release.)

**Do NOT run `npm run db:seed` in production.** It publishes a demo tutor on
`/explore` and on a public storefront. The script refuses to run when
`NODE_ENV=production`; do not `--force` it.

## 5. Run it (pick one)

**pm2 (simplest):**
```
sudo npm i -g pm2
pm2 start npm --name 9arini -- start      # runs `next start` on :3000
pm2 save && pm2 startup                    # restart on reboot
```

**systemd (alternative)** — `/etc/systemd/system/9arini.service`:
```
[Unit]
Description=9arini
After=network.target postgresql.service
[Service]
WorkingDirectory=/home/USER/9arini-app
ExecStart=/usr/bin/npm run start
Environment=PORT=3000
Restart=always
User=USER
[Install]
WantedBy=multi-user.target
```
`sudo systemctl enable --now 9arini`

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

`/etc/nginx/sites-available/9arini`:
```nginx
server {
  server_name 9arini.tn www.9arini.tn;
  client_max_body_size 15M;                # allow the 12MB verification uploads

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
  # NOTE: `alias` (not `root`) — the URL path /_next/static/ maps to .next/static/.
  # This path must point at the DEPLOYED build; re-running `next build` replaces
  # the contents, and the hashed names mean old and new never collide.
  location /_next/static/ {
    alias /home/USER/9arini-app/.next/static/;
    access_log off;
    expires 1y;
    add_header Cache-Control "public, max-age=31536000, immutable";
  }

  # (There is no `public/` folder in this repo today — every asset is emitted by
  # the build under /_next/. If you add one, give it its own `location` with a
  # SHORTER TTL: files in public/ are not content-hashed, so `immutable` there
  # would pin a stale logo in every browser that ever loaded it.)

  # ── Everything else → Node ─────────────────────────────────────────────────
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
Then HTTPS: `sudo certbot --nginx -d 9arini.tn -d www.9arini.tn`.

**Check it actually works** — the header must come from nginx, not Node:
```
curl -sI https://9arini.tn/_next/static/… | grep -i cache-control
# → cache-control: public, max-age=31536000, immutable
curl -sH 'Accept-Encoding: gzip' -o /dev/null -w '%{size_download}\n' https://9arini.tn/
```
If `nginx -t` passes but assets 404, the `alias` path is wrong — it must end in a
`/` and point at the real `.next/static` of the build you are running.

> **X-Forwarded-For is a rate-limit key** (`lib/auth.ts` → `clientIp()`), never an
> authz input. Keep the `proxy_set_header` line above: without it every request
> looks like it comes from `127.0.0.1` and the per-IP OTP throttle collapses into
> one shared bucket for the whole internet.

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
   `lib/cache.ts` / `revalidateTutor`). Caching HTML at the edge would put an
   uncontrollable second cache in front of that control.

**Ordering note:** with Cloudflare proxying, `X-Forwarded-For` arrives via
`CF-Connecting-IP`. Install Cloudflare's real-IP ranges
(`set_real_ip_from … ; real_ip_header CF-Connecting-IP;`) or every request will
appear to come from a Cloudflare address — same collapsed-throttle problem as
above, one bucket per Cloudflare edge node.

---

## 7. Retention purge (ID documents + expired auth rows) — **SCHEDULE THIS** ⚠️

One daily job, **two things purged**:

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

`lib/retention.ts` implements both; `npm run db:purge` and `POST /api/cron/purge`
each run **both**. No extra schedule is needed — whichever option below you already
picked now covers the auth tables too.

Both entry points do the same job and both are idempotent, so overlapping runs are
harmless. Pick **one**.

### Option A — HTTP route (works on any host, incl. Vercel Cron)

`/api/cron/purge` accepts `GET` and `POST`, authenticates a `CRON_SECRET` bearer
token in constant time, and **refuses to run (503) if `CRON_SECRET` is unset** —
it will never expose an unauthenticated destructive endpoint. Add `?dryRun=1` to
preview without deleting.

Crontab (`crontab -e`) — daily at 03:15:
```
15 3 * * * curl -fsS -X POST https://9arini.tn/api/cron/purge \
  -H "Authorization: Bearer $CRON_SECRET" >> /var/log/9arini-purge.log 2>&1
```
(`CRON_SECRET` is not in cron's environment by default — either inline the value or
add `CRON_SECRET=…` as a line at the top of the crontab.)

On Vercel, `vercel.json`:
```json
{ "crons": [{ "path": "/api/cron/purge", "schedule": "15 3 * * *" }] }
```
and set `CRON_SECRET` in the project env — Vercel sends it as the bearer token.

### Option B — systemd timer (running the CLI on the box)

`/etc/systemd/system/9arini-purge.service`:
```
[Unit]
Description=9arini — purge expired ID documents (INPDP, 90 days)
After=network.target postgresql.service
[Service]
Type=oneshot
WorkingDirectory=/home/USER/9arini-app
ExecStart=/usr/bin/npm run db:purge
User=USER
```
`/etc/systemd/system/9arini-purge.timer`:
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
sudo systemctl enable --now 9arini-purge.timer
systemctl list-timers 9arini-purge.timer     # confirm the next run
npm run db:purge -- --dry-run                # confirm it finds what you expect
```
(Plain crontab equivalent: `15 3 * * * cd /home/USER/9arini-app && /usr/bin/npm run db:purge >> /var/log/9arini-purge.log 2>&1`.)

**Verify it actually ran** — check the log/journal after the first night. A purge cron
that silently fails is indistinguishable from one you never wrote.

---

## Notes
- **No Docker anywhere** — local dev and prod both run Node directly against a local/VPS Postgres. (The old `npm run db:up` script is gone.)
- Back up **Postgres** and the **`STORAGE_DIR`** folder together; the DB rows and the files on disk are two halves of one record. ID docs are served only via the admin-gated `/api/admin/doc/[id]` route — never from the public web root.
- Schema changes: add a numbered file to `scripts/sql/` and run `npm run db:sql` (idempotent, transactional). `db:push` is deliberately disabled — it is not PG17/18-safe (see §4).
- **Only verified tutors are public** (`/explore`, `/<slug>`, sitemap). Approve them at `/admin/verifications` — access is limited to the numbers in `ADMIN_PHONES`.
- Payments stay off (`PAYMENTS_ENABLED` unset) until legal/INPDP sign-off.
