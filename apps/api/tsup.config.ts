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
  sourcemap: true,
});
