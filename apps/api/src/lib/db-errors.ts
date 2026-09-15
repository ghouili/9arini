/* Postgres errors the routes turn into answers instead of 500s.

   drizzle wraps the driver error (DrizzleQueryError, with the postgres error as
   `cause`), and both carry the statement parameters — which is why a 500 here used
   to write a phone number and a name into the error log. Check the code, never
   log the object. */
export function isUniqueViolation(e: unknown, constraint?: string): boolean {
  const err = e as { code?: string; constraint_name?: string; cause?: { code?: string; constraint_name?: string } };
  const pg = err.cause?.code ? err.cause : err;
  return pg.code === "23505" && (!constraint || pg.constraint_name === constraint);
}
