import postgres from "postgres";
import { DB_URL, assertLocalDb } from "./env";

assertLocalDb(DB_URL);

/* max:1 — the suite runs with workers:1 and a single connection makes the
   ordering of seed/assert unambiguous. The race spec opens its OWN pool on
   purpose; see seat-claim.race.spec.ts. */
export const sql = postgres(DB_URL, { max: 1, onnotice: () => {} });

export async function closeDb(): Promise<void> {
  await sql.end({ timeout: 5 }).catch(() => {});
}
