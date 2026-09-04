/* @tnajem/shared — the contract between apps/web and apps/api.

   Pure modules only: no `server-only`, no database, no cookies, no Next imports.
   Fastify, the Next server, Next CLIENT components and plain unit tests all
   import from here, so anything with a runtime dependency belongs elsewhere.

   Zod lives behind the "./contracts" subpath and is NEVER re-exported from this
   barrel. That is deliberate, not cosmetic: this module is imported by client
   components (for the DTO types and safeNext), and zod is ~14kB min+gz. On a
   product whose scaling thesis is a mid-range Android on Tunisian 3G, dragging a
   validation library into the client bundle through a barrel export is a real
   regression. Verify with `npm run ui:weight` after touching this file. */

export * from "./types";
export * from "./validation";
export * from "./admin";
