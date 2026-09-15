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

   Only when someone ASKED for demo mode (TNAJEM_DEMO=1), in development, with no
   API configured — the state that puts a "MODE DÉMO" banner on every page.
   Missing API_URL alone is no longer enough: that used to be what a plain
   `npm run dev` looked like, and it served invented tutors without a word.

     demoFallback === true   dev + TNAJEM_DEMO=1 + no API
     demoFallback === false  everything else -> call the API, and let a missing
                             API fail as a real failure (lib/data.ts) */
export const demoFallback: boolean = !backendReady && demoEnabled;
