import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db, dbReady } from "@/lib/db";
import { purgeExpiredAuthRows, purgeExpiredVerificationDocs, RETENTION_DAYS } from "@/lib/retention";

/* Cron entry point for the retention purges (see lib/retention.ts). Two jobs, one
 * schedule:
 *
 *   1. ID documents past the 90-day window — the /privacy promise.
 *   2. Expired auth rows (sessions + otp_codes) — housekeeping on two tables that
 *      otherwise grow by one row per login / per OTP, forever (SCALABILITY.md §5).
 *
 * /privacy promises identity documents are deleted at most 90 days after the
 * verification decision. Point a scheduler at this route once a day:
 *
 *   curl -X POST https://9arini.tn/api/cron/purge \
 *        -H "Authorization: Bearer $CRON_SECRET"
 *
 * Vercel Cron / most schedulers send a GET with that same header, so both verbs
 * are accepted. Add `?dryRun=1` to preview without deleting anything.
 *
 * Auth: bearer token compared against CRON_SECRET in constant time. If
 * CRON_SECRET is unset the route refuses to run (503) rather than exposing an
 * unauthenticated destructive endpoint.
 *
 * Same job as `npm run db:purge`; both are idempotent, so an overlap is harmless.
 */
export const runtime = "nodejs";        // needs node:fs — not the edge runtime
export const dynamic = "force-dynamic"; // never cached/prerendered

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = req.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;

  const provided = Buffer.from(header.slice(prefix.length));
  const expected = Buffer.from(secret);
  // timingSafeEqual throws on length mismatch — check first, and still compare
  // so a wrong-length token does not short-circuit faster than a wrong one.
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

async function handle(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return Response.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!authorized(req)) {
    return Response.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!dbReady) {
    return Response.json(
      { ok: false, error: "database not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";

  try {
    const res = await purgeExpiredVerificationDocs(db, {
      dryRun,
      retentionDays: RETENTION_DAYS,
      log: (line) => console.log(`[cron:purge] ${line}`),
    });

    /* Second job, same run: expired sessions + OTP codes. Deliberately AFTER the
       document purge and independent of it — a disk error on one tutor's scan must
       not stop two forever-growing tables from being swept. Both are idempotent, so
       an overlapping run is harmless. */
    const auth = await purgeExpiredAuthRows(db, {
      dryRun,
      log: (line) => console.log(`[cron:purge] ${line}`),
    });

    // Summary only in the response body — `removed` carries tutor/doc ids and
    // stays in the server log, not in an HTTP payload a scheduler may retain.
    return Response.json(
      {
        ok: true,
        dryRun: res.dryRun,
        retentionDays: res.retentionDays,
        cutoff: res.cutoff,
        tutorsAffected: res.tutorsAffected,
        docsDeleted: res.docsDeleted,
        filesDeleted: res.filesDeleted,
        filesMissing: res.filesMissing,
        // Auth-row housekeeping (counts only — never a token, a phone or a hash).
        sessionsDeleted: auth.sessionsDeleted,
        otpCodesDeleted: auth.otpCodesDeleted,
        rateLimitsDeleted: auth.rateLimitsDeleted,
        errors: res.errors.length,
      },
      { status: res.errors.length > 0 ? 500 : 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[cron:purge] failed", e);
    return Response.json(
      { ok: false, error: "purge failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
