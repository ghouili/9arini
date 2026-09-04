import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "node22",
  clean: true,
  outDir: "dist",
  /* BUNDLE the workspace packages instead of leaving them external.

     tsup externalises everything in `dependencies` by default, which is right for
     npm packages but wrong for @tnajem/* — those resolve to raw TypeScript
     (packages/db/src/index.ts), so `node dist/server.js` died with
     ERR_MODULE_NOT_FOUND on file:///.../packages/db/src/schema: no extension, and
     Node cannot load .ts anyway.

     Bundling them in is the whole reason the API is compiled rather than run
     through tsx in production: no TypeScript at runtime, and the ESM extension
     problem disappears. Real npm dependencies (fastify, postgres, drizzle-orm)
     stay external and are installed normally. */
  noExternal: [/^@tnajem\//],
  /* npm packages reached THROUGH a bundled workspace package must be declared in
     this app's own dependencies, or tsup does not know to externalise them and
     bundles their CJS — which then dies on `Dynamic require of "events" is not
     supported`. nodemailer arrives that way, via @tnajem/shared/mail. Same class
     of failure as dotenv; the rule is: anything the bundle needs at RUNTIME is a
     dependency of apps/api, even when it is imported indirectly. */
  sourcemap: true,
});
