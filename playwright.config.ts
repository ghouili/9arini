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
  /* TWO servers now. From Step 4 the web app proxies actions to the API, so a
     suite that starts only the web app would exercise a half-wired system and
     fail in a way that looks like a product bug.

     Playwright starts these in order and waits for each `url` to answer. Note
     this is CONFIG, not a spec: the Stage A contract is that no spec file
     changes, and none has. */
  webServer: process.env.E2E_BASE_URL ? undefined : [
    {
      command: "npm run build -w @tnajem/api && npm run start -w @tnajem/api",
      url: "http://127.0.0.1:4000/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        API_PORT: "4000",
        STORAGE_DIR: resolve(process.env.E2E_STORAGE_DIR ?? ".e2e-storage"),
        ADMIN_EMAILS: "e2e-admin@tnajem.invalid",
        /* NO REAL MAIL FROM THE TEST SUITE.

           MAIL_* are set in .env, so mailEnabled() was true and every OTP request
           opened a live SMTP connection from the developer's real account — to
           @tnajem.invalid addresses that can never be delivered. That is slow
           (it made the signup spec time out at 60s waiting on a submit button
           still showing "Chargement…"), and it is the kind of thing that quietly
           burns a sending reputation.

           dotenv does NOT overwrite a key that is already present in process.env,
           even when the value is an empty string — verified — so setting these
           blank here beats .env without editing it. requestOtp then takes its
           no-provider path, which is dev-only and safe: it fails CLOSED in
           production (IS_PROD refuses to return the code). The suite never reads
           the on-screen code anyway; support/otp.ts recovers it from the hash. */
        MAIL_HOST: "",
        MAIL_USER: "",
        MAIL_PASS: "",
        MAIL_FROM_ADDRESS: "",
        TWILIO_ACCOUNT_SID: "",
        TWILIO_AUTH_TOKEN: "",
      },
    },
    {
      command: "npm run build -w @tnajem/web && npm run start:standalone -w @tnajem/web",
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
        API_URL: "http://127.0.0.1:4000",
      },
    },
  ],
});
