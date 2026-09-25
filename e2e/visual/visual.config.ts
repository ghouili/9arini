import { defineConfig } from "@playwright/test";
import base from "../../playwright.config";

/* The screenshot harness config (UI Option A · S0). Same browser, servers and
   global setup/teardown as the main suite — only the test match differs, so
   `npm run test` (which uses the main config and *.spec.ts) never runs it.
   Paths here are relative to THIS file, hence the overrides. */
export default defineConfig({
  ...base,
  testDir: ".",
  testMatch: /.*\.capture\.ts$/,
  globalSetup: "../global-setup.ts",
  globalTeardown: "../global-teardown.ts",
  reporter: [["list"]],
});
