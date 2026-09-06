#!/usr/bin/env bash
# Dev helper for the audit harness: (re)start the REAL production server on 3222.
#
# next.config.mjs sets `output: "standalone"`, and `next start` refuses to serve a
# standalone build (it prints a warning and then renders pages through a different
# path, which produced misleading empty-body HTML while auditing). The standalone
# server is what actually runs in production, so that is what the audit measures.
#
# ── PATHS ARE LOCATED, NEVER ASSUMED ──────────────────────────────────────────
# This script used to hardcode `.next/static` and `.next/standalone/server.js`,
# which were correct until the monorepo move and silently wrong afterwards: the
# build now lives under apps/web, and with outputFileTracingRoot at the repo root
# the traced entry is .next/standalone/apps/web/server.js. It failed with
# "cp: cannot stat '.next/static'" — so the production audit could not be run at
# all, and no gate covered it. Same class of breakage as brand:build and ui:audit
# in Step 6: tooling that no test exercises rots quietly.
#
# `.next/static`, `public/` and the env files are not copied into the bundle by
# Next (documented and deliberate), and the standalone server reads its env from
# its OWN directory — so all four are mirrored next to the server.js we find.
set -e
LOG="${1:-/tmp/prod.log}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WEB="$ROOT/apps/web"

PID=$(netstat -ano | grep ':3222 .*LISTENING' | head -1 | awk '{print $5}' || true)
[ -n "$PID" ] && taskkill //PID "$PID" //F >/dev/null 2>&1 || true
sleep 2

[ -d "$WEB/.next/standalone" ] || { echo "No .next/standalone — run \`npm run build -w @tnajem/web\` first."; exit 1; }

# Depth-first hunt for the traced server.js: flat (single-app) or nested (monorepo).
# -print0/-0: the repo path contains spaces ("New idea claude"), and a bare
# `xargs dirname` splits on them — it built a directory called "/d/work/Startups"
# and failed with a cp error that pointed at the wrong thing entirely.
SERVER_DIR=$(find "$WEB/.next/standalone" -name server.js -not -path '*/node_modules/*' -print0 -quit | xargs -0 -r dirname)
[ -n "$SERVER_DIR" ] || { echo "No server.js under .next/standalone — the build emitted no standalone bundle."; exit 1; }

rm -rf "$SERVER_DIR/.next/static" "$SERVER_DIR/public"
cp -r "$WEB/.next/static" "$SERVER_DIR/.next/static"
[ -d "$WEB/public" ] && cp -r "$WEB/public" "$SERVER_DIR/public"

# BOTH env files. .env carries the mail config, OTP_CHANNEL and ADMIN_EMAILS;
# .env.local carries DATABASE_URL and overrides. Mirroring only .env.local (as this
# once did) starts the standalone server with no mail provider and no channel
# setting — so every audit and every manual prod check silently measures an
# unconfigured app.
[ -f "$ROOT/.env" ] && cp "$ROOT/.env" "$SERVER_DIR/.env"
[ -f "$ROOT/.env.local" ] && cp "$ROOT/.env.local" "$SERVER_DIR/.env.local"

(cd "$SERVER_DIR" && PORT=3222 HOSTNAME=127.0.0.1 nohup node server.js > "$LOG" 2>&1 &)
for i in $(seq 1 30); do
  sleep 1
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3222/fr 2>/dev/null || true)
  [ "$code" = "200" ] && { echo "standalone prod up on 3222  (entry: $SERVER_DIR/server.js)"; exit 0; }
done
echo "prod FAILED to start"; tail -20 "$LOG"; exit 1
