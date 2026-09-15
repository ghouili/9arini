/* A SEPARATE PROCESS that asks the limiter once and prints the answer as JSON.
   Used by test/rate-limit.test.ts to prove a window spent in one process is still
   spent in a brand-new one — i.e. that the limit survives an API restart or a
   second instance, which an in-process counter never would. Not a test file
   itself (the runner globs test/*.test.ts). */
import "../../src/env";
import { checkRateLimit } from "../../src/lib/rate-limit";
import { sql } from "../../src/db";

(async () => {
  const [key, limit, windowMs] = process.argv.slice(2);
  const result = await checkRateLimit(key, Number(limit), Number(windowMs));
  process.stdout.write(JSON.stringify(result));
  await sql?.end({ timeout: 2 });
})();
