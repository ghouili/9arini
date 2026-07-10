/** @deprecated 9arini migrated from Supabase to local Postgres + Drizzle.
 *  Server data access → `@/lib/db` + `@/lib/data` + `@/app/actions`.
 *  Client "backend live?" flag → `backendReady` from `@/lib/config`.
 *  This file is a no-op shim kept only so any stray import keeps compiling. */
export { backendReady as supabaseReady } from "./config";
