import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { DB_URL, assertLocalDb, STORAGE_DIR, AUTH_SECRET, BASE_URL } from "./support/env";

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

  const warmed = await warmRoutes();

  console.log(
    `\n[e2e] run id: ${process.env.E2E_RUN_ID}  ·  storage: ${STORAGE_DIR}  ·  warmed ${warmed} route(s)`,
  );
}

/* Next's standalone server compiles each route on FIRST hit, so whichever spec
   happens to touch a cold route first pays several seconds for it. That is pure
   timing noise, and it is what made the signup spec — the one with the most steps
   — time out in the full suite while passing in ~3s on its own.

   Warming moves that cost out of the tests.

   BEST-EFFORT, AND IT REPORTS ITS COUNT. An earlier attempt at this silently did
   nothing (a string replace that did not match), and two lucky green runs made it
   look fixed. A warm-up that cannot say how many routes it warmed is a warm-up you
   cannot tell apart from no warm-up at all — hence the number in the log line
   above. If it prints 0, the servers were not up yet and the flake is back. */
async function warmRoutes(): Promise<number> {
  const paths = [
    "/fr",
    "/fr/signup/eleve",
    "/fr/signup/prof",
    "/fr/onboarding",
    "/fr/onboarding/upgrade",
    "/fr/student",
    "/fr/student/welcome",
    "/fr/account",
    "/fr/dashboard",
    "/fr/dashboard/new-class",
    "/fr/explore",
    "/fr/admin/verifications",
  ];

  /* Wait briefly for the server. Playwright's ordering of webServer vs globalSetup
     is not something to rely on, so poll rather than assume — and give up quickly
     rather than hang a suite that is legitimately running against E2E_BASE_URL. */
  const deadline = Date.now() + 30_000;
  let up = false;
  while (Date.now() < deadline) {
    try {
      await fetch(`${BASE_URL}/fr`, { redirect: "manual" });
      up = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (!up) return 0;

  const results = await Promise.all(
    paths.map((p) =>
      fetch(`${BASE_URL}${p}`, { redirect: "manual" })
        .then(() => true)
        .catch(() => false),
    ),
  );
  return results.filter(Boolean).length;
}
