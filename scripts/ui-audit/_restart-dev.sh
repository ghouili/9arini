#!/usr/bin/env bash
# Dev helper: (re)start `next dev` on 3111 for the audit harness.
# `next dev` and `next build` share .next/, so a production build mid-session
# leaves the running dev server serving 500s. Re-run this after every build.
set -e
LOG="${1:-/tmp/dev.log}"
PID=$(netstat -ano | grep ':3111 .*LISTENING' | head -1 | awk '{print $5}' || true)
[ -n "$PID" ] && taskkill //PID "$PID" //F >/dev/null 2>&1 || true
sleep 2
nohup npx next dev -p 3111 > "$LOG" 2>&1 &
for i in $(seq 1 60); do
  sleep 1
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3111/fr 2>/dev/null || true)
  [ "$code" = "200" ] && { echo "dev up on 3111"; exit 0; }
done
echo "dev FAILED to start"; tail -20 "$LOG"; exit 1
