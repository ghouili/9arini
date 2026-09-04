/* @tnajem/db — the schema, the connection factory, and the document store.

   This package OWNS the drizzle-orm dependency. Everything that builds a query
   imports the operators from here rather than from "drizzle-orm" directly, so
   there is exactly one place the ORM version is pinned and exactly one boundary
   to move when apps/api takes over the queries in Step 4.

   Gate 2 asserts that: `grep -rn "drizzle-orm" apps/web/app apps/web/components`
   must be 0. */

export * as schema from "./schema";
export * from "./schema";

export { createDb } from "./client";
export type { DbHandle, CreateDbOptions, Database, Sql } from "./client";

export { storageBase, tutorDocDir, resolveDocPath } from "./storage";

export {
  purgeExpiredVerificationDocs,
  purgeExpiredAuthRows,
  RETENTION_DAYS,
} from "./retention";
export type { PurgeResult, AuthPurgeResult, PurgeDb } from "./retention";

/* The query-builder surface the app uses. Re-exported so no consumer imports
   drizzle-orm directly — see the header. Add to this list rather than reaching
   past the package. */
export {
  eq,
  ne,
  and,
  or,
  not,
  sql,
  desc,
  asc,
  ilike,
  like,
  inArray,
  notInArray,
  isNull,
  isNotNull,
  gt,
  gte,
  lt,
  lte,
  between,
  count,
  countDistinct,
  exists,
  getTableColumns,
} from "drizzle-orm";
