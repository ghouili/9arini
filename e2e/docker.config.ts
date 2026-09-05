import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

/* THE SAME SUITE, RUN AGAINST THE CONTAINERS.
   `npx playwright test --config=e2e/docker.config.ts` — Gate 5.

   Not a second suite. Every spec file here is byte-identical to the one the host
   config runs, which is the entire point: Stage A's contract is that behaviour
   did not change, and a Docker-specific spec would be a Docker-specific claim.
   The only thing that differs is WHERE the system under test is.

   Bring the stack up first:
     docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d --build

   ── Why these four variables and not DATABASE_URL ───────────────────────────
   e2e/support/env.ts reads E2E_* names on purpose and never DATABASE_URL
   directly, so that Step 5's "apps/web holds no database reference" stays a real
   claim while the suite keeps needing a connection. Setting them here, before
   Playwright loads globalSetup, is what points the same specs at a different
   deployment. They are set with ??= so an outer environment (CI) still wins. */

process.env.E2E_BASE_URL ??= "http://localhost:3000";

/* Host port 15432, container port 5432 — and it reads the same DB_PUBLISHED_PORT
   override docker-compose.yml does, so the two cannot drift.

   Not 5432: a developer running this repo has Postgres natively there, which is
   what .env points at, and publishing over it would leave the suite seeding a
   database nobody meant to touch. Not 5433 either — that is the conventional
   "second postgres" port and was already held by an unrelated project's
   container on this machine. The password mirrors the compose default. */
process.env.E2E_DATABASE_URL ??=
  `postgresql://tnajem:${process.env.POSTGRES_PASSWORD ?? "tnajem-local-dev"}` +
  `@localhost:${process.env.DB_PUBLISHED_PORT ?? "15432"}/tnajem`;

/* The bind mount in docker-compose.e2e.yml maps this host directory onto
   /data/storage inside the API container. admin.spec.ts seeds a verification_docs
   row AND the real file behind it from the host, then asserts an admin gets 200;
   with the production named volume that file is simply invisible to the API and
   the test fails on a missing file while looking like a broken access check. */
process.env.E2E_STORAGE_DIR ??= resolve(".e2e-storage");

process.env.E2E_API_URL ??= "http://localhost:4000";

export default defineConfig({
  /* Relative to THIS file, so "." is e2e/ — the same directory the root config
     reaches as "./e2e". */
  testDir: ".",
  workers: 1,
  fullyParallel: false,
  /* retries:0, same as the host config. A retry that passes hides a race, and
     the seat-claim spec exists to catch one. */
  retries: 0,
  forbidOnly: !!process.env.CI,
  /* Longer than the host's 60s. Every request now crosses the Docker Desktop
     network stack twice (browser -> published port -> web container -> api
     container), and a cold Next route inside a container is slower than the same
     route on the host. This is latency, not a different contract. */
  timeout: 90_000,
  reporter: [["list"]],
  globalSetup: "./global-setup.ts",
  globalTeardown: "./global-teardown.ts",
  use: { baseURL: process.env.E2E_BASE_URL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  /* NO webServer. compose owns the lifecycle here — if the stack is not up, the
     run must fail loudly rather than quietly starting a second copy of the app on
     the host and testing that instead. That failure mode is the whole reason this
     gate exists. */
});
