/** Constant-time bearer check. A length pre-check first, because timingSafeEqual
    throws on a length mismatch — and comparing with === would leak the token
    prefix through response timing.

    Shared by /cron/purge and /debug/error. It was cron.ts's private helper until
    the second caller appeared; a copied comparison is how one of the two copies
    ends up with `===` after a refactor nobody reviewed twice. */
import { timingSafeEqual } from "node:crypto";

export function bearerAuthorised(header: string | undefined, secret: string): boolean {
  const provided = (header ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!provided) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(secret, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
