/* Refuse to start a web process that would serve fabricated data, or that has no
   API to call.

     node scripts/preflight.mjs dev     `npm run dev` runs this as predev
     node scripts/preflight.mjs start   the standalone server (serve-standalone.mjs
                                        imports it; the Docker CMD runs it)

   ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
   apps/web used to fall back to demo fixtures whenever API_URL was missing, and
   Next never read the root .env — so a plain `npm run dev` served invented tutors
   that looked exactly like real ones. The fallback is now opt-in (TNAJEM_DEMO=1),
   dev-only, and carries a banner on every page; this script makes every other
   state impossible to start by accident:

     dev,  API_URL set                → real data (normal)
     dev,  TNAJEM_DEMO=1, no API_URL  → demo data, banner on every page
     dev,  neither                    → REFUSE, and say how to fix it
     prod, API_URL set                → start
     prod, no API_URL                 → REFUSE (a web app with nothing to call)
     prod, TNAJEM_DEMO=1              → REFUSE (demo data can never be production)

   NOT CHECKED HERE: AUTH_SECRET. The web app never reads it — only the API
   hashes OTPs (packages/shared/src/auth-core.ts::hashOtp) — and docker-compose
   rightly gives the web container API_URL alone. Requiring it here would stop a
   correct deploy from starting. The API enforces it (apps/api/src/env.ts), and
   `npm run db:check` rejects the public default.

   Never prints a value — only whether a key is set. */
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function refuse(lines) {
  console.error(["", "  ✗ Tnajem web refused to start.", ...lines.map((l) => `    ${l}`), ""].join("\n"));
  process.exit(1);
}

/** @param {"dev" | "start"} mode */
export async function preflight(mode) {
  const production = mode === "start" || process.env.NODE_ENV === "production";

  /* Dev reads the same root files next.config.mjs does. The Docker runner has no
     .env and no dotenv: the host injects the environment, so a failed import is
     expected there, not an error. */
  if (!production) {
    try {
      const { config } = await import("dotenv");
      const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
      config({ path: join(root, ".env.local") });
      config({ path: join(root, ".env") });
    } catch {
      /* no dotenv — rely on the real environment */
    }
  }

  const apiUrlSet = Boolean(process.env.API_URL?.trim());
  const demoRequested = process.env.TNAJEM_DEMO === "1";

  if (production) {
    if (demoRequested) {
      refuse([
        "TNAJEM_DEMO=1 is set in production. Demo data can never be served to real users.",
        "Remove TNAJEM_DEMO from this environment.",
      ]);
    }
    if (!apiUrlSet) {
      refuse([
        "API_URL is missing. In production the web app has nothing to call without it,",
        "and it never falls back to demo data. Set API_URL (e.g. http://api:4000).",
      ]);
    }
    console.log("  ✓ preflight: production — API_URL set, no demo mode");
    return;
  }

  if (apiUrlSet) {
    if (demoRequested) console.log("  ! preflight: TNAJEM_DEMO=1 ignored — API_URL is set, serving real data");
    else console.log("  ✓ preflight: development — API_URL set, real data");
    return;
  }

  if (demoRequested) {
    console.log("\n  ⚠ MODE DÉMO — données fictives. Every page carries a banner saying so.\n");
    return;
  }

  refuse([
    "API_URL is not set, and demo mode was not requested.",
    "Real data:  set API_URL in the repo-root .env and run `npm run dev:api` alongside.",
    "Demo data:  TNAJEM_DEMO=1 npm run dev   (fictitious tutors, banner on every page)",
  ]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await preflight(process.argv[2] === "start" ? "start" : "dev");
}
