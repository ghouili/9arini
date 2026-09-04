import "server-only";
import { createDb, schema } from "@tnajem/db";

/* The web app's database handle.

   All of the pool logic, the sizing rationale and the globalThis singleton now
   live in @tnajem/db::createDb. This file exists for two reasons and no others:

   1. `import "server-only"`. It CANNOT live in the package — Fastify and tsx both
      import @tnajem/db, and server-only throws under tsx. Here it still does the
      job it was actually doing: failing the build loudly if a client component
      ever imports the database client.

   2. It keeps the module's public shape (`db`, `sql`, `dbReady`, `schema`)
      byte-identical, so every existing `@/lib/db` import across app/ and lib/ is
      untouched by the extraction. That is what makes Step 2 a file move rather
      than a refactor.

   Deleted in Step 5, when apps/web stops talking to Postgres at all. */

const handle = createDb(process.env.DATABASE_URL);

export const dbReady = handle.ready;
export const db = handle.db;
export const sql = handle.sql;
export { schema };
