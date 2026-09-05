# syntax=docker/dockerfile:1

# ── deps ─────────────────────────────────────────────────────────────────────
# The whole workspace is copied because apps/web depends on @tnajem/shared by
# symlink; npm needs the real package.json files to link them.
# NOT alpine. The lockfile is generated on Windows and carries 97 @esbuild
# platform packages but ZERO linux-musl ones, so `npm ci` on an alpine base
# installs no esbuild binary and tsup dies with exit 127 "command not found".
# node:22-slim is glibc, which the lockfile does cover (@esbuild/linux-x64), so
# `npm ci` stays exactly reproducible. sharp has the same musl problem, which
# matters for the web image now and more in Step 13.
FROM node:22-slim AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json          apps/web/
COPY apps/api/package.json          apps/api/
COPY packages/db/package.json       packages/db/
COPY packages/shared/package.json   packages/shared/
RUN npm ci --no-audit --no-fund

# ── build ────────────────────────────────────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /repo
# The WHOLE /repo, not just the root node_modules.
#
# npm workspaces does not hoist everything: tsup installs NESTED at
# apps/api/node_modules/tsup (it is in the lockfile at exactly that path).
# Copying only /repo/node_modules dropped every nested tree and the build died
# with "sh: 1: tsup: not found" — exit 127, which reads like a missing platform
# binary and is not. `COPY . .` below cannot clobber these: .dockerignore
# excludes node_modules from the build context.
COPY --from=deps /repo /repo
COPY . .
# NO DATABASE_URL, and no API needs to be running: apps/web owns no database, and
# /sitemap.xml is request-time precisely so the build does not need one.
#
# AUTH_SECRET is deliberately absent too. The build logs
# "[Tnajem] FATAL CONFIG: AUTH_SECRET is not set" and CONTINUES — that is the
# lazy-resolution design in @tnajem/shared/auth-core. Do not "fix" it by throwing
# at module load: every page imports auth, so a module-load throw kills
# `next build` on any host that injects secrets at runtime, which is most of them.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @tnajem/web

# ── run ──────────────────────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0

# THE MONOREPO STANDALONE LAYOUT. With outputFileTracingRoot at the repo root the
# entry point is .next/standalone/apps/web/server.js — NOT the flat
# .next/standalone/server.js that every Dockerfile example assumes. That mismatch
# is the usual cause of "Cannot find module '/app/server.js'".
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
# Neither of these is traced by `next build`; without them the site renders
# unstyled with a 404 on every chunk — and still passes a naive
# `curl | grep "<h1"` health check.
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public       ./apps/web/public

# The node images ship a non-root `node` user (uid 1000). Never run as root.
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/fr').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
