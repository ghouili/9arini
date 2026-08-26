#!/usr/bin/env bash
# Dev helper: production build for the audit harness.
#
# Kills the standalone server first. On Windows the running server holds file
# handles inside .next/, and `next build` then blocks indefinitely trying to
# replace them — which looks exactly like a hung build.
PID=$(netstat -ano 2>/dev/null | grep ':3222 .*LISTENING' | head -1 | awk '{print $5}')
[ -n "$PID" ] && taskkill //PID "$PID" //F >/dev/null 2>&1
sleep 2
npm run build 2>&1 | tail -"${1:-6}"
