/* Input validation for server actions — hand-rolled, zero deps.

   Every validator returns a discriminated result instead of throwing, so actions
   can map failures straight onto the existing ActionResult shape:

     const t = vText(input.title, { max: 120, field: "title" });
     if (!t.ok) return { ok: false, error: t.error };
     // t.value is a trimmed, bounded string

   Error strings are stable machine codes (`invalid-title`, `slug-reserved`, …)
   so the UI can localize them; never user-facing prose. Pure module — safe on
   both server and client (no DB, no env). */

export type Valid<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T,>(value: T): Valid<T> => ({ ok: true, value });
const bad = (error: string): Valid<never> => ({ ok: false, error });

/** Non-empty trimmed string with a max length. `field` shapes the error code. */
export function vText(
  raw: unknown,
  opts: { field: string; max: number; min?: number },
): Valid<string> {
  if (typeof raw !== "string") return bad(`invalid-${opts.field}`);
  const value = raw.trim();
  const min = opts.min ?? 1;
  if (value.length < min) return bad(`invalid-${opts.field}`);
  if (value.length > opts.max) return bad(`${opts.field}-too-long`);
  return ok(value);
}

/** Same as vText but "" / null / undefined → null (an intentionally absent value). */
export function vOptionalText(
  raw: unknown,
  opts: { field: string; max: number },
): Valid<string | null> {
  if (raw === null || raw === undefined) return ok(null);
  if (typeof raw !== "string") return bad(`invalid-${opts.field}`);
  if (!raw.trim()) return ok(null);
  const r = vText(raw, opts);
  return r.ok ? ok(r.value) : r;
}

/** Integer within [min, max] inclusive. Rejects NaN, floats and numeric strings that aren't ints. */
export function vInt(
  raw: unknown,
  opts: { field: string; min: number; max: number },
): Valid<number> {
  const n = typeof raw === "string" ? Number(raw.trim()) : raw;
  if (typeof n !== "number" || !Number.isFinite(n) || !Number.isInteger(n)) return bad(`invalid-${opts.field}`);
  if (n < opts.min || n > opts.max) return bad(`invalid-${opts.field}`);
  return ok(n);
}

/** Money / quantity: finite number >= 0 (never negative), capped, rounded to 2 decimals. */
export function vPrice(raw: unknown, opts: { field: string; max?: number }): Valid<number> {
  const n = typeof raw === "string" ? Number(raw.trim()) : raw;
  if (typeof n !== "number" || !Number.isFinite(n)) return bad(`invalid-${opts.field}`);
  if (n < 0) return bad(`negative-${opts.field}`);
  const max = opts.max ?? 100_000;
  if (n > max) return bad(`${opts.field}-too-high`);
  return ok(Math.round(n * 100) / 100);
}

/** ISO-ish date string that parses AND is not in the past (small clock-skew grace). */
export function vFutureDate(raw: unknown, opts: { field: string; graceMin?: number }): Valid<Date> {
  if (typeof raw !== "string" || !raw.trim()) return bad(`invalid-${opts.field}`);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return bad(`invalid-${opts.field}`);
  const grace = (opts.graceMin ?? 1) * 60_000;
  if (d.getTime() < Date.now() - grace) return bad(`${opts.field}-in-past`);
  // Sanity ceiling: nobody schedules a Bac revision 5 years out.
  if (d.getTime() > Date.now() + 5 * 365 * 86_400_000) return bad(`invalid-${opts.field}`);
  return ok(d);
}

/** http/https URL only — blocks javascript:, data:, file: and other injection vectors.
    We embed these in hrefs/iframes (meet, whiteboard, quiz), so the scheme allowlist matters. */
export function vUrl(raw: unknown, opts: { field: string; max?: number }): Valid<string> {
  if (typeof raw !== "string" || !raw.trim()) return bad(`invalid-${opts.field}`);
  const value = raw.trim();
  if (value.length > (opts.max ?? 500)) return bad(`${opts.field}-too-long`);
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return bad(`invalid-${opts.field}`);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return bad(`invalid-${opts.field}`);
  if (!u.hostname) return bad(`invalid-${opts.field}`);
  return ok(u.toString());
}

/** Optional URL: "" / null / undefined → null; anything present must be a safe URL. */
export function vOptionalUrl(raw: unknown, opts: { field: string; max?: number }): Valid<string | null> {
  if (raw === null || raw === undefined) return ok(null);
  if (typeof raw !== "string" || !raw.trim()) return ok(null);
  const r = vUrl(raw, opts);
  return r.ok ? ok(r.value) : r;
}

/* ---------- Slugs ----------
   `/[slug]` is a ROOT catch-all: 9arini.tn/<slug> is a tutor storefront. A tutor
   who grabbed the slug "explore" (or "admin", "api"…) would shadow a real route,
   so every app-level path segment is reserved and can never be claimed. */
export const RESERVED_SLUGS: readonly string[] = [
  "explore", "auth", "admin", "checkout", "dashboard", "onboarding", "student",
  "live", "class", "account", "messages", "api", "terms", "privacy", "_next",
];

const SLUG_RE = /^[a-z0-9-]{3,40}$/;

/** lowercase a-z0-9-, 3–40 chars, no leading/trailing/double dash, not reserved. */
export function isValidSlug(raw: string): boolean {
  const s = (raw || "").trim();
  if (!SLUG_RE.test(s)) return false;
  if (s.startsWith("-") || s.endsWith("-") || s.includes("--")) return false;
  if (RESERVED_SLUGS.includes(s)) return false;
  return true;
}

export function vSlug(raw: unknown): Valid<string> {
  if (typeof raw !== "string") return bad("invalid-slug");
  const s = raw.trim().toLowerCase();
  if (!SLUG_RE.test(s) || s.startsWith("-") || s.endsWith("-") || s.includes("--")) return bad("invalid-slug");
  if (RESERVED_SLUGS.includes(s)) return bad("slug-reserved");
  return ok(s);
}

/* ---------- Ids ----------
   Every `classId` / `bookingId` / `tutorId` / doc id an action receives comes
   straight off the wire and lands in `eq(table.id, value)`. Drizzle parameterizes,
   so this is not an injection vector — but those columns are `uuid`, and Postgres
   raises 22P02 ("invalid input syntax for type uuid") on anything malformed. That
   throw escapes the action as an unhandled 500 instead of a clean `not-found`,
   which is both a crash-by-input DoS and an oracle that distinguishes "malformed
   id" from "someone else's id". Validate the shape before it reaches the DB. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(raw: unknown): raw is string {
  return typeof raw === "string" && UUID_RE.test(raw.trim());
}

export function vUuid(raw: unknown, opts: { field: string }): Valid<string> {
  if (typeof raw !== "string") return bad(`invalid-${opts.field}`);
  const v = raw.trim().toLowerCase();
  if (!UUID_RE.test(v)) return bad(`invalid-${opts.field}`);
  return ok(v);
}

/* ---------- File names ----------
   Two jobs, both required:
     • the ON-DISK name — must not escape its folder ("../x", "/etc/x", "C:\x", NUL)
     • the STORED name  — echoed back inside a Content-Disposition header by
       app/api/admin/doc/[id], so it must not carry CR/LF (header injection),
       quotes or semicolons.

   One strict allow-list pass does both: every byte outside [a-zA-Z0-9._-] becomes
   "_", which covers path separators, NUL, CR, LF, quotes and semicolons at once.
   The extension survives (admins recognise files by it). */
export function safeFileName(raw: unknown, max = 80): string {
  if (typeof raw !== "string") return "file";
  const base = raw.split(/[\\/]/).pop() ?? ""; // drop any directory component first
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^\.+/, "") // no leading dots ("..", ".htaccess")
    .slice(0, max);
  return cleaned || "file";
}

/** Star rating: integer 1–5. */
export function vRating(raw: unknown): Valid<number> {
  return vInt(raw, { field: "rating", min: 1, max: 5 });
}

/* ---------- Age / minor-consent ----------
   A student's birth year is self-reported at signup and used for ONE thing: to
   decide whether guardian consent (INPDP / Loi 2004-63) is required before booking.
   Under-18 (or unknown age) needs it; adults don't. Everything here fails SAFE —
   an absent, malformed or out-of-range value collapses to null, which the consent
   gate treats as "minor" (consent required). It can never wave a real minor through. */

/** Parse a self-reported birth year → the year, or null if absent/implausible.
    Range: a ~4-year-old pupil up to a ~100-year-old — anything else is null. */
export function vBirthYear(raw: unknown, now: Date = new Date()): number | null {
  const y = typeof raw === "string" ? Number(raw.trim()) : raw;
  if (typeof y !== "number" || !Number.isFinite(y) || !Number.isInteger(y)) return null;
  const current = now.getFullYear();
  if (y > current - 4 || y < current - 100) return null;
  return y;
}

/** True when a birth year makes a student a minor (< 18) OR is unknown (null).
    Unknown → true (fail safe: consent required). Adults (>= 18) → false. */
export function isMinorBirthYear(birthYear: number | null | undefined, now: Date = new Date()): boolean {
  if (birthYear == null) return true;
  return now.getFullYear() - birthYear < 18;
}

/** Loose phone check (normalization itself lives in lib/auth.ts). */
export function vPhone(raw: unknown): Valid<string> {
  if (typeof raw !== "string") return bad("invalid-phone");
  const value = raw.trim();
  const digits = value.replace(/\D/g, "").length;
  if (digits < 8 || digits > 15) return bad("invalid-phone");
  return ok(value);
}

/* Open-redirect guard for ?next=. Lives here, not in the auth component, because
   BOTH sides need it: app/[locale]/auth/page.tsx (server) sanitises the query
   string and components/auth/AuthInner.tsx (client) consumes the result. A
   function exported from a "use client" module is replaced by a client REFERENCE
   when a server component imports it — calling it server-side throws
   "is not a function" — so the sanitiser has to sit in a plain module.
   middleware.ts and /live bounce guests here with ?next=<path> (e.g. /live/abc,
   /checkout?class=x). That value is attacker-controllable, so we only ever follow
   it when it is a *relative, same-origin* path:
     • must start with a single "/"
     • "//evil.tn" and "/\evil.tn" are protocol-relative → rejected
     • any backslash, control char, or "scheme:" prefix → rejected
     • "/auth..." → rejected (would loop back into this page)
   Anything suspicious falls through to the normal role-based destination. */
export function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v.startsWith("/")) return null;                 // absolute URL or bare word
  if (v.startsWith("//") || v.startsWith("/\\")) return null; // protocol-relative
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(v)) return null;   // "/javascript:…" & friends
  if (v.includes("\\")) return null;                   // "/\evil.tn", backslash tricks
  for (const ch of v) {                                // control chars (CR/LF header smuggling)
    const c = ch.codePointAt(0) ?? 0;
    if (c < 0x20 || c === 0x7f) return null;
  }
  if (v === "/auth" || v.startsWith("/auth/") || v.startsWith("/auth?")) return null;
  return v;
}
