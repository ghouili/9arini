/* What a PRODUCTION build compiles instead of lib/demo-fixtures.ts
   (next.config.mjs swaps the module). No fixture text exists in this file, so
   none can reach the bundle. The types are borrowed from the real module, so
   the two cannot drift apart without `tsc` failing. */
import type * as Fixtures from "./demo-fixtures";

export const devClasses: typeof Fixtures.devClasses = () => [];
export const devStorefronts: typeof Fixtures.devStorefronts = () => ({});
