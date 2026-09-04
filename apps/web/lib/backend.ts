import "server-only";
import { dbReady } from "./db";
import { demoEnabled } from "./demo";

/* WHEN MAY A PORTED ACTION FALL BACK TO DEMO DATA?

   Not "when DATABASE_URL is unset". That was the right question while apps/web
   owned the queries; it is the WRONG one now that it proxies to apps/api, and
   leaving it would have detonated at exactly the wrong moment.

   Step 5's explicit goal is `grep -rn "DATABASE_URL" apps/web | wc -l  -> 0`. The
   instant that lands, every `if (!dbReady) return []` in a PORTED function starts
   returning empty — in production, silently. The sitemap ships with no tutor
   pages, storefronts 404, /explore renders its empty state. No error, no failing
   test, and the cause (a removed env var) looks nothing like the symptom (an
   empty catalogue). It would be attributed to the API, or to Google, for days.

   The honest gate for a ported action is: fall back to demo data ONLY when there
   is no backend at all AND we are not in production. In production the web app
   must always call the API and let a real failure surface as a real failure.

     demoFallback === true   dev, no database, no API worth calling
                             -> the ui-audit harness and `next build` keep working
     demoFallback === false  everything else -> call the API

   Behaviour today is unchanged: dbReady is true in dev and in production, so this
   evaluates exactly as `!dbReady` did. It simply stops being a landmine once
   DATABASE_URL leaves apps/web. */
export const demoFallback: boolean = !dbReady && demoEnabled;

/* Kept separate on purpose: a PRODUCTION process with no database and no demo
   fallback must degrade to an honest error, never to fabricated data. That is the
   rule lib/data.ts::DatabaseNotConfiguredError already enforces for the
   storefront, and it is why demoEnabled is part of the condition above rather
   than dbReady alone. */
export const backendMissingInProd: boolean = !dbReady && !demoEnabled;
