import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { DB_URL, assertLocalDb, STORAGE_DIR, AUTH_SECRET } from "./support/env";

export default async function globalSetup(): Promise<void> {
  assertLocalDb(DB_URL);
  if (!AUTH_SECRET) throw new Error("E2E: AUTH_SECRET must be set (the OTP fixture needs it)");

  // A fresh namespace per run, visible to every worker and to teardown.
  process.env.E2E_RUN_ID ??= randomBytes(3).toString("hex");
  await mkdir(STORAGE_DIR, { recursive: true });

  const { purgeAllRuns } = await import("./support/seed");
  const { resetRateLimits } = await import("./support/otp");
  const { sql } = await import("./support/db");

  await purgeAllRuns();   // leftovers from a previous crashed run
  await resetRateLimits();
  await sql`delete from sessions where profile_id not in (select id from profiles)`;

  console.log(`\n[e2e] run id: ${process.env.E2E_RUN_ID}  ·  storage: ${STORAGE_DIR}`);
}
