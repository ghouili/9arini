#!/usr/bin/env bash
# Dev helper for the audit harness: (re)start the REAL production server on 3222.
#
# next.config.mjs sets `output: "standalone"`, and `next start` refuses to serve a
# standalone build (it prints a warning and then renders pages through a different
# path, which produced misleading empty-body HTML while auditing). The standalone
# server is what actually runs in production, so that is what the audit measures.
# `.next/static`, `public/` and the env files are not copied into the bundle by
# Next (documented and deliberate), and the standalone server runs with its own
# cwd, so it would otherwise start with no DATABASE_URL and 500 every storefront.
# Mirror them all after every build.
set -e
LOG="${1:-/tmp/prod.log}"
PID=$(netstat -ano | grep ':3222 .*LISTENING' | head -1 | awk '{print $5}' || true)
[ -n "$PID" ] && taskkill //PID "$PID" //F >/dev/null 2>&1 || true
sleep 2
rm -rf .next/standalone/.next/static .next/standalone/public
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
# BOTH env files. .env carries the mail config, OTP_CHANNEL and ADMIN_EMAILS;
# .env.local carries DATABASE_URL and overrides. Mirroring only .env.local (as this
# did) starts the standalone server with no mail provider and no channel setting —
# so every audit and every manual prod check silently measures an unconfigured app.
[ -f .env ] && cp .env .next/standalone/.env
[ -f .env.local ] && cp .env.local .next/standalone/.env.local
(cd .next/standalone && PORT=3222 nohup node server.js > "$LOG" 2>&1 &)
for i in $(seq 1 30); do
  sleep 1
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3222/fr 2>/dev/null || true)
  [ "$code" = "200" ] && { echo "standalone prod up on 3222"; exit 0; }
done
echo "prod FAILED to start"; tail -20 "$LOG"; exit 1
