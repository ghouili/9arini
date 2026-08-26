#!/usr/bin/env bash
# Dev helper: (re)start `next dev` on 3111 for the audit harness.
#
# `next dev` and `next build` share .next/. After a production build the dev
# server cannot reuse that directory — it hangs at "Starting..." forever rather
# than erroring — so wipe it whenever a production build is sitting there.
set -e
LOG="${1:-/tmp/dev.log}"
for P in $(netstat -ano 2>/dev/null | grep ':3111 .*LISTENING' | awk '{print $5}' | sort -u); do
  taskkill //PID "$P" //F >/dev/null 2>&1 || true
done
sleep 2
[ -d .next/standalone ] && rm -rf .next
nohup npx next dev -p 3111 > "$LOG" 2>&1 &
for i in $(seq 1 90); do
  sleep 1
  code=$(curl -s -m 5 -o /dev/null -w "%{http_code}" http://localhost:3111/fr 2>/dev/null || true)
  [ "$code" = "200" ] && { echo "dev up on 3111"; exit 0; }
done
echo "dev FAILED to start"; tail -20 "$LOG"; exit 1
