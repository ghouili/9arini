/* WHERE A CLASS STANDS — Phase A · A18.10 (lane L5).

   The tutor dashboard showed a cancelled class and a finished one exactly like a
   live one. One rule now answers "upcoming, live, finished or cancelled?", from
   the real start + duration and the stored status, for every surface that needs
   it. Instants are absolute (starts_at is ISO with an offset), so the answer does
   not depend on the timezone of the process asking. Pure module. */
import { isOpenForBooking, type ClassStatus } from "./class-time";

export type ClassPhase = "upcoming" | "live" | "done" | "cancelled";

type PhaseInput = { starts_at: string; duration_min?: number | null; status?: string | null };

/** Minutes a class lasts when the row carries none (the column default). */
const DEFAULT_DURATION_MIN = 90;

export function classPhase(cls: PhaseInput, now: number = Date.now()): ClassPhase {
  if (cls.status === "cancelled") return "cancelled";
  if (cls.status === "done") return "done";
  const start = Date.parse(cls.starts_at);
  if (!Number.isFinite(start)) return "upcoming";
  const end = start + (cls.duration_min ?? DEFAULT_DURATION_MIN) * 60_000;
  if (now < start) return "upcoming";
  if (now < end) return "live";
  return "done";
}

/* "PROCHAINE SÉANCE" — Phase A · A18.11 (lane L5).

   The storefront panel used to show the first class WITH A SEAT LEFT and call it
   the next session, so a full Monday class was skipped and Thursday's presented
   as "next". Two separate answers now:

     next      the earliest upcoming, non-cancelled class — full or not
     bookable  the earliest upcoming, non-cancelled class that still has a seat
               (== next when next has one; null when everything is full)

   Sorted here rather than trusting the caller's order. */
type SessionLike = { starts_at: string; seats_left: number; status?: ClassStatus };

export function nextSessionOf<T extends SessionLike>(
  classes: readonly T[],
  now: number = Date.now(),
): { next: T | null; bookable: T | null } {
  const open = classes
    .filter((k) => isOpenForBooking(k, now)) // scheduled (not cancelled) and not started
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  return {
    next: open[0] ?? null,
    bookable: open.find((k) => k.seats_left > 0) ?? null,
  };
}
