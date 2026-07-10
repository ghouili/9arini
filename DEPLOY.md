# Deploying 9arini to a VPS — no Docker

Plain Node deploy: `next build` → run with **pm2** (or systemd) behind an **nginx**
reverse proxy, using the **Postgres already on your VPS**. Steps marked **(you)**
need your server/accounts.

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
DATABASE_URL=postgresql://admin:admin@127.0.0.1:5432/qarini   # NO ?schema=public
AUTH_SECRET=<run: openssl rand -hex 32>
ADMIN_PHONES=+216XXXXXXXX
STORAGE_DIR=/var/lib/9arini/storage        # persistent folder for verification docs
NEXT_PUBLIC_BACKEND_READY=1
# Optional real SMS:
# TWILIO_ACCOUNT_SID=... / TWILIO_AUTH_TOKEN=... / TWILIO_FROM=+1...
```
Create the storage dir writable by the app user:
`sudo mkdir -p /var/lib/9arini/storage && sudo chown $USER /var/lib/9arini/storage`

## 4. Migrate + seed + build
```
npm run db:push
npm run db:seed        # seeds the demo tutor 9arini.tn/yassine-math
npm run build
```

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

## 6. nginx reverse proxy + HTTPS (you)
`/etc/nginx/sites-available/9arini`:
```
server {
  server_name 9arini.tn www.9arini.tn;
  client_max_body_size 15M;                # allow the 12MB verification uploads
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```
`sudo ln -s … /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx`
Then HTTPS: `sudo certbot --nginx -d 9arini.tn -d www.9arini.tn`.

## Notes
- **No Docker anywhere** — local dev and prod both run Node directly against a local/VPS Postgres.
- Back up **Postgres** and the **STORAGE_DIR** folder (verification docs live there; keep them private — served only via the admin-gated `/api/admin/doc/[id]` route).
- Schema changes: `npm run db:push` for now; switch to `db:generate` + `db:migrate` (versioned) for production.
- Payments stay off until legal/INPDP sign-off.
