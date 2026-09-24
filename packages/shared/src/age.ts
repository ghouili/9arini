/* AGE — the adult-only pilot (Phase A · A24, A14; decision D6).

   Pure: no database, no Node builtins. Imported by the API, the web server and
   plain unit tests.

   ── WHY BIRTH MONTH + YEAR ────────────────────────────────────────────────────
   The year alone (isMinorBirthYear in ./validation) makes everyone born in
   (this year − 18) an adult from 1 January, so a 17-year-old born in December
   passed for almost a whole year. The month closes that to at most the birthday
   month itself — and there the day is unknown, so we wait for the month to turn.

   ── FAIL-SAFE, IN EVERY DIRECTION ─────────────────────────────────────────────
   Adult only when the 18th birthday fell in a month that is ALREADY OVER, in
   Africa/Tunis (never the server's own clock). A missing or implausible month or
   year is a minor. Nothing here can wave a real minor through; the price is that
   an adult whose 18th birthday is this month waits until the 1st.

   LEGAL-REVIEW: age threshold (./legal MINOR_AGE_YEARS) and the choice to count
   the birthday month itself as "not yet 18". */
import { MINOR_AGE_YEARS } from "./legal";
import { tunisWallTime } from "./time";

/** A self-reported birth month → 1–12, or null if absent or not a whole month. */
export function vBirthMonth(raw: unknown): number | null {
  const m = typeof raw === "string" && raw.trim() !== "" ? Number(raw.trim()) : raw;
  if (typeof m !== "number" || !Number.isInteger(m) || m < 1 || m > 12) return null;
  return m;
}

/** True only when someone born in (birthYear, birthMonth) had their 18th birthday
    in a month that is already over in Africa/Tunis at `now`. Unknown → false. */
export function isAdult(
  birthYear: number | null | undefined,
  birthMonth: number | null | undefined,
  now: Date = new Date(),
): boolean {
  if (birthYear == null || !Number.isInteger(birthYear)) return false;
  if (vBirthMonth(birthMonth) == null) return false;
  const { year, month } = tunisWallTime(now);
  const monthsSinceBirthMonth = (year - birthYear) * 12 + (month - (birthMonth as number));
  // == MINOR_AGE_YEARS * 12 is the birthday month itself: the day is unknown → minor.
  return monthsSinceBirthMonth > MINOR_AGE_YEARS * 12;
}

/** ALLOW_MINORS === "1" lets minors sign up and book (with guardian consent).
    Read on EVERY call, never at module load, so a restart — or a test — flips it.
    Default OFF: the pilot is adults only until parent accounts exist (Phase D). */
export function minorsAllowed(): boolean {
  return typeof process !== "undefined" && process.env?.ALLOW_MINORS === "1";
}
