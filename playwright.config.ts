import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";
import "./e2e/support/env";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3210";

export default defineConfig({
  testDir: "./e2e",
  /* workers:1 — three things are process-global no matter how independent the
     specs look: the rate_limits table, STORAGE_DIR, and the on-disk ISR cache. */
  workers: 1,
  fullyParallel: false,
  /* retries:0 — a retry that passes hides a race, and this suite exists
     specifically to catch one (the seat claim). */
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: { baseURL: BASE, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  /* `next start` DOES NOT WORK with output:"standalone" — it logs Ready, listens,
     and never answers. And the standalone bundle ships without .next/static and
     public/. start:standalone handles both. A dev server is NOT usable here
     either: ISR/unstable_cache only behave correctly in a production build, and
     this suite has to protect that guardrail. */
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: "npm run build && npm run start:standalone",
    url: "http://localhost:3210/fr",
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      PORT: "3210",
      /* ABSOLUTE, always. Next's standalone server.js chdir()s to its own
         directory, so a relative STORAGE_DIR resolves to
         .next/standalone/.e2e-storage for the server while the seeder writes to
         <repo>/.e2e-storage. The doc route then 404s on a file that exists. */
      STORAGE_DIR: resolve(process.env.E2E_STORAGE_DIR ?? ".e2e-storage"),
      /* Pin the admin allowlist to a seeded identity so admin.spec.ts does not
         depend on whoever happens to be in the developer's .env. */
      ADMIN_EMAILS: "e2e-admin@tnajem.invalid",
    },
  },
});
