# syntax=docker/dockerfile:1

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
# tsup bundles @tnajem/* IN (they resolve to raw TypeScript, which node cannot
# load) and leaves real npm packages external. See apps/api/tsup.config.ts.
RUN npm run build -w @tnajem/api

# ── migrate ──────────────────────────────────────────────────────────────────
# Its own target, kept at the build stage: the runner carries only dist/, while
# the migration runner needs tsx and packages/db/sql. Compose runs this ONCE as a
# separate service — two API replicas racing db:sql is wrong even though every
# file is transactional.
FROM build AS migrate
WORKDIR /repo
CMD ["npx", "tsx", "packages/db/bin/apply-sql.ts"]

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production API_PORT=4000 API_HOST=0.0.0.0

# Only the bundle plus the dependencies it kept external.
COPY --from=build --chown=node:node /repo/apps/api/dist        ./dist
COPY --from=build --chown=node:node /repo/node_modules         ./node_modules
COPY --from=build --chown=node:node /repo/apps/api/package.json ./package.json

# The node images ship a non-root `node` user (uid 1000). Never run as root.
USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/health').then(r=>r.json()).then(j=>process.exit(j.ok&&j.db?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
