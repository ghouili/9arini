-- 0002 — durable, cross-instance rate limiting.
--
-- WHY: the pilot limiter lived in a module-level Map (lib/auth.ts::rateLimit). It
-- resets on every deploy and each Node process keeps its OWN window, so the real
-- ceiling on a multi-instance / pm2-cluster deploy was (instances × limit) and a
-- rolling restart wiped it entirely. SCALABILITY.md / the launch brief: back it
-- with Postgres before running more than one instance. This table is that backing.
--
-- One row per (endpoint, subject) key. checkRateLimit() (lib/auth.ts) does a single
-- atomic INSERT ... ON CONFLICT DO UPDATE so concurrent requests on any instance
-- serialize on the row and share one fixed-window counter.
--
-- Rows are self-healing (a stale window is reset on the next hit) but a key that is
-- never hit again lingers, so the retention purge (lib/retention.ts) sweeps
-- reset_at < now() — hence the index.
--
-- Additive + idempotent — safe to run more than once. Apply with `npm run db:sql`.

CREATE TABLE IF NOT EXISTS "rate_limits" (
  "key"      text PRIMARY KEY,
  "count"    integer NOT NULL DEFAULT 0,
  "reset_at" timestamp with time zone NOT NULL
);

-- The retention sweep: `delete from rate_limits where reset_at < now()`.
CREATE INDEX IF NOT EXISTS "rate_limits_reset_at_idx" ON "rate_limits" USING btree ("reset_at");
