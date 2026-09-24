/* WHERE A CLASS STANDS — Phase A · A18.10 (lane L5).

   The tutor dashboard showed a cancelled class and a finished one exactly like a
   live one. One rule now answers "upcoming, live, finished or cancelled?", from
   the real start + duration and the stored status, for every surface that needs
   it. Instants are absolute (starts_at is ISO with an offset), so the answer does
   not depend on the timezone of the process asking. Pure module. */

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
