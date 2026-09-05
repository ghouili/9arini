import "server-only";
import { demoEnabled } from "./demo";

/* IS THERE A BACKEND TO CALL?

   This used to be `dbReady` — "is a database configured?". That was the right question
   while apps/web owned the queries. It is the wrong one now that it proxies to
   apps/api, and leaving it would have detonated at exactly the wrong moment:
   Step 5's explicit goal is that apps/web contains no database reference at all, and
   the instant that landed, every `if (!dbReady) return []` in a PORTED function
   would start returning empty in production, silently. The sitemap ships with no
   tutor pages, storefronts 404, /explore renders its empty state. No error, no
   failing test, and the cause (a removed env var) looks nothing like the symptom
   (an empty catalogue) — it would be blamed on the API, or on Google, for days.

   The honest signal for a web app that owns no database is whether an API is
   configured to call. */
export const backendReady: boolean = Boolean(process.env.API_URL?.trim());

/* WHEN MAY A PORTED ACTION FALL BACK TO DEMO DATA?

   Only when there is no backend at all AND we are not in production. In
   production the web app must always call the API and let a real failure surface
   as a real failure.

     demoFallback === true   dev with no API — the ui-audit harness and
                             `next build` keep working
     demoFallback === false  everything else -> call the API */
export const demoFallback: boolean = !backendReady && demoEnabled;

/* Kept separate on purpose: a PRODUCTION process with no backend and no demo
   fallback must degrade to an honest error, never to fabricated data. That is the
   rule lib/data.ts::DatabaseNotConfiguredError already enforces for the
   storefront, and it is why demoEnabled is part of the condition above rather
   than backendReady alone. */
export const backendMissingInProd: boolean = !backendReady && !demoEnabled;
