import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/* Server-only Postgres client. `dbReady` is false when DATABASE_URL is unset,
   in which case the data layer falls back to demo data (so the app still runs). */
const url = process.env.DATABASE_URL;
export const dbReady = Boolean(url);

// Reuse one connection across dev HMR to avoid exhausting Postgres connections.
const g = globalThis as unknown as { __qariniSql?: ReturnType<typeof postgres> };
const sql = url ? (g.__qariniSql ?? postgres(url, { max: 5 })) : null;
if (url && process.env.NODE_ENV !== "production" && sql) g.__qariniSql = sql;

export const db = sql ? drizzle(sql, { schema }) : (null as unknown as ReturnType<typeof drizzle<typeof schema>>);
export { schema };
