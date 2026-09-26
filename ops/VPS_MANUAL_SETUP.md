# Tnajem VPS — manual setup, command by command
Ubuntu 24.04 · 4 CPU · 8 GB · everything runs as the user **`ubuntu`**.
It does the same as `ops/vps-bootstrap.sh`, one block at a time, so you can see and check each step.
Replace `VPS_IP`. Blocks marked **PC** run in PowerShell on your computer; all the others run on the server.

---

## 0 · First login and the `ubuntu` user
**PC**: create a key if you don't have one, then put it on the server:
```powershell
ssh-keygen -t ed25519
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@VPS_IP "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
ssh root@VPS_IP
```
**Server (as root)**:
```bash
id ubuntu || adduser --disabled-password --gecos "" ubuntu     # skip if it already exists
usermod -aG sudo ubuntu
echo "ubuntu ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/90-ubuntu && chmod 440 /etc/sudoers.d/90-ubuntu
install -d -m 700 -o ubuntu -g ubuntu /home/ubuntu/.ssh
cat /root/.ssh/authorized_keys >> /home/ubuntu/.ssh/authorized_keys
sort -u -o /home/ubuntu/.ssh/authorized_keys /home/ubuntu/.ssh/authorized_keys
chown ubuntu:ubuntu /home/ubuntu/.ssh/authorized_keys && chmod 600 /home/ubuntu/.ssh/authorized_keys
```
**PC, new window**: this must work before you continue:
```powershell
ssh ubuntu@VPS_IP
```
From here on, everything runs as `ubuntu`.

## 1 · System update, base tools, timezone
```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install curl ca-certificates gnupg lsb-release git ufw fail2ban unattended-upgrades \
  build-essential htop jq openssl
sudo timedatectl set-timezone Africa/Tunis
sudo reboot            # only if the upgrade asked for it; reconnect as ubuntu after
```

## 2 · SSH: keys only, no root login
```bash
sudo tee /etc/ssh/sshd_config.d/00-tnajem.conf >/dev/null <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
EOF
sudo sshd -t && sudo systemctl reload ssh
```
Keep this window open and test `ssh ubuntu@VPS_IP` from a **new** window. If it fails, run `sudo rm /etc/ssh/sshd_config.d/00-tnajem.conf && sudo systemctl reload ssh` in the open window.
`00-` makes the file load before cloud-init's `50-cloud-init.conf`, which otherwise re-enables passwords.

## 3 · Firewall: only 22, 80, 443
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status verbose
```
Postgres (5432) and the app ports (3000, 4000) stay **closed** to the internet. They only listen on localhost.
If your provider also has a firewall in its panel, open the same three ports there.

## 4 · fail2ban (blocks SSH password guessing) + automatic security updates
```bash
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd
sudo tee /etc/apt/apt.conf.d/20auto-upgrades >/dev/null <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
```

## 5 · Swap (a safety net for `next build`)
```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-tnajem.conf && sudo sysctl -p /etc/sysctl.d/99-tnajem.conf
free -h
```

## 6 · Node 22 + pm2 (starts on boot)
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt -y install nodejs
node -v && npm -v                        # v22.x
sudo npm install -g pm2
pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | sudo bash
```

## 7 · Postgres 18
```bash
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt update && sudo apt -y install postgresql-18
```
**Tuning for 8 GB, localhost only:**
```bash
sudo tee /etc/postgresql/18/main/conf.d/tnajem.conf >/dev/null <<'EOF'
listen_addresses = 'localhost'
max_connections = 100
shared_buffers = 2GB
effective_cache_size = 6GB
work_mem = 16MB
maintenance_work_mem = 256MB
random_page_cost = 1.1
timezone = 'Africa/Tunis'
log_min_duration_statement = 500
EOF
sudo systemctl restart postgresql@18-main
sudo -u postgres psql -c "show shared_buffers;"      # 2GB
```
**Database + two roles** (owner for migrations, limited role for the app):
```bash
OWNER_PW=$(openssl rand -hex 24); APP_PW=$(openssl rand -hex 24)
sudo -u postgres psql -q -c "CREATE ROLE tnajem_owner LOGIN PASSWORD '$OWNER_PW';"
sudo -u postgres psql -q -c "CREATE ROLE tnajem_app LOGIN PASSWORD '$APP_PW';"
sudo -u postgres psql -q -c "CREATE DATABASE tnajem OWNER tnajem_owner;"
sudo -u postgres psql -q -d tnajem <<'SQL'
REVOKE ALL ON DATABASE tnajem FROM PUBLIC;
GRANT CONNECT ON DATABASE tnajem TO tnajem_app;
GRANT USAGE ON SCHEMA public TO tnajem_app;
ALTER DEFAULT PRIVILEGES FOR ROLE tnajem_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tnajem_app;
ALTER DEFAULT PRIVILEGES FOR ROLE tnajem_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO tnajem_app;
SQL
umask 077; {
  echo "MIGRATION_DATABASE_URL=postgresql://tnajem_owner:$OWNER_PW@127.0.0.1:5432/tnajem"
  echo "DATABASE_URL=postgresql://tnajem_app:$APP_PW@127.0.0.1:5432/tnajem"
} > ~/tnajem-db-secrets.txt
unset OWNER_PW APP_PW
```
`~/tnajem-db-secrets.txt` holds the two URLs for the GitHub secrets. Copy them into your password manager.

## 8 · nginx + certbot
```bash
sudo apt -y install nginx certbot python3-certbot-nginx
sudo sed -i 's/# server_tokens off;/server_tokens off;/' /etc/nginx/nginx.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl enable --now nginx
```
The real site config (`ops/nginx-tnajem.conf`), the Cloudflare real-IP script and the certificate come next, in `ops/PIPELINE_SETUP.md` step B.

## 9 · Folders for the app, ID scans and backups
```bash
sudo mkdir -p /var/www/tnajem && sudo chown ubuntu:ubuntu /var/www/tnajem
sudo install -d -m 700 -o ubuntu -g ubuntu /var/lib/tnajem/storage
sudo install -d -m 700 -o ubuntu -g ubuntu /var/backups/tnajem
```

## 10 · Check everything
```bash
echo "--- ssh";      sudo sshd -T | grep -E "passwordauthentication|permitrootlogin"   # both "no"
echo "--- firewall"; sudo ufw status | head -8                                         # 22, 80, 443
echo "--- fail2ban"; sudo fail2ban-client status sshd | head -3
echo "--- node";     node -v; pm2 -v
echo "--- postgres"; sudo -u postgres psql -tAc "select version();" | cut -d, -f1
echo "--- pg local"; sudo ss -ltnp | grep 5432                                         # 127.0.0.1 only
echo "--- nginx";    systemctl is-active nginx
echo "--- swap";     swapon --show
echo "--- tz";       timedatectl | grep "Time zone"
```

**Next:** `ops/PIPELINE_SETUP.md`: GitHub's key (step A), the nginx site and HTTPS (step B), the `deploy` environment secrets (step C), then `git push origin production`.
