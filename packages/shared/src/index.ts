/* @tnajem/shared — the contract between apps/web and apps/api.

   Pure modules only: no `server-only`, no database, no cookies, no Next imports.
   Fastify, the Next server, Next CLIENT components and plain unit tests all
   import from here, so anything with a runtime dependency belongs elsewhere.

   TWO modules are deliberately NOT re-exported here, and both for the same
   reason: this barrel is imported by CLIENT components.

     ./auth-core  imports node:crypto. Re-exporting it made webpack try to bundle
                  node:crypto for the browser and the web build died with
                  "UnhandledSchemeError: Reading from node:crypto is not handled".
                  Import it from "@tnajem/shared/auth-core" — server only.
     ./contracts  zod, ~14kB min+gz (Step 3+).

   Zod and node:crypto are NEVER re-exported from this
   barrel. That is deliberate, not cosmetic: this module is imported by client
   components (for the DTO types and safeNext), and zod is ~14kB min+gz. On a
   product whose scaling thesis is a mid-range Android on Tunisian 3G, dragging a
   validation library into the client bundle through a barrel export is a real
   regression. Verify with `npm run ui:weight` after touching this file. */

export * from "./types";
export * from "./validation";
export * from "./admin";
export * from "./profile-input";
/* Pure predicates, no node builtins — safe in the barrel, unlike auth-core/mail. */
export * from "./free-first";
export * from "./cancellation";
