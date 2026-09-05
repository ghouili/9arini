/* CANCELLATION — 48 hours free, 40% retained after that. One definition.

   ══════════════════════════════════════════════════════════════════════════════
   THIS IS A BEHAVIOUR CHANGE, AND IT LOOSENS A RULE.
   ══════════════════════════════════════════════════════════════════════════════
   Before this file, cancelBooking REFUSED inside 24 hours: `too-late`, no seat
   released, no record kept, and the student was told to go message their tutor.
   That is worse for everyone — the seat stayed locked to someone who was not
   coming, so the tutor could not resell it and the class ran a head short.

   Now a late cancellation SUCCEEDS. The seat goes back in the pool immediately
   and 40% of what the seat was worth is recorded as retained for the tutor. Late
   cancellation is newly possible, not newly punished.

   ══════════════════════════════════════════════════════════════════════════════
   NOTHING IS CHARGED. PAYMENTS ARE OFF.
   ══════════════════════════════════════════════════════════════════════════════
   Tnajem processes no money (packages/shared/src/payments.ts — paymentsEnabled()
   is false unless PAYMENTS_ENABLED === "1"). The ledger records what WOULD be
   retained so the rule is auditable from day one and so there is a real history
   when payments do open. No UI built on these numbers may imply that a student
   was, is, or will be debited today. Every screen that shows a retained amount
   must also say that nothing is taken during the pilot — see the copy in
   apps/web/app/[locale]/student/page.tsx and Terms §7.

   The `paymentsEnabled` column on the ledger exists exactly so that a future
   reader can tell a "would have been" row from a real one. Do not drop it. */

/** Free-cancellation window. 48 hours, up from 24. */
export const CANCEL_FREE_WINDOW_HOURS = 48;
export const CANCEL_FREE_WINDOW_MS = CANCEL_FREE_WINDOW_HOURS * 60 * 60 * 1000;

/** Share of the seat's value retained for the tutor on a late cancellation. */
export const LATE_CANCEL_RETAINED_PCT = 0.4;

export type CancellationOutcome = {
  /** True when the cancellation lands inside the 48-hour window. */
  late: boolean;
  /** Milliseconds between the cancellation and the class start. Negative if the
      class has already started — see the note on that case below. */
  msBeforeStart: number;
  /** 0 or LATE_CANCEL_RETAINED_PCT. Stored on the ledger row so a rate change
      later cannot silently rewrite history. */
  retainedPct: number;
  /** What the seat was worth. 0 for a free first session. */
  amountTnd: number;
  retainedTnd: number;
  releasedTnd: number;
};

/** Round to the centime — `classes.price_tnd` is numeric(7,2), so anything finer
    would not survive the round trip and the ledger would stop balancing. */
function toCentimes(n: number): number {
  return Math.round(n * 100) / 100;
}

/** The whole rule, as a pure function of (start time, now, amount).

    SERVER TIME ONLY. `now` defaults to Date.now() and callers in apps/api never
    pass a client-supplied value: a cancellation deadline that trusts the
    client's clock is not a deadline.

    THE BOUNDARY IS INCLUSIVE: exactly 48h00m00s before the start is still FREE.
    "Tu peux annuler gratuitement jusqu'à 48 heures avant" reads as inclusive to
    a student, and the tie should go to them. 47h59m is late; 48h01m is free.

    A class that has ALREADY STARTED gives a negative msBeforeStart and is late,
    which is the correct answer rather than an error: the endpoint has its own
    rules about what may still be cancelled, and this function's job is only to
    price it. */
export function cancellationOutcome(input: {
  scheduledAt: Date | string | number;
  amountTnd: number;
  now?: number;
}): CancellationOutcome {
  const startsAt = new Date(input.scheduledAt).getTime();
  const now = input.now ?? Date.now();
  const msBeforeStart = startsAt - now;

  /* An unparseable date must not silently become "free to cancel". NaN fails
     every comparison, so state the intent instead of relying on that. */
  const late = Number.isNaN(startsAt) ? true : msBeforeStart < CANCEL_FREE_WINDOW_MS;

  /* Negative or non-finite amounts are nonsense; treat them as zero rather than
     recording a negative retention. */
  const amountTnd = Number.isFinite(input.amountTnd) ? Math.max(0, toCentimes(input.amountTnd)) : 0;

  const retainedPct = late ? LATE_CANCEL_RETAINED_PCT : 0;
  const retainedTnd = toCentimes(amountTnd * retainedPct);
  /* released is the REMAINDER.

     HONEST NOTE, because the obvious claim here is wrong and I checked: writing
     this as toCentimes(amountTnd * 0.6) instead would give the SAME answer for
     every amount this system can produce. amountTnd is already rounded to
     centimes above, and 0.4 x (a whole number of centimes) never lands on a .5
     fractional part, so the two roundings cannot disagree — verified across
     0-2000 TND. The mutation test that was supposed to prove otherwise passed.

     The remainder form stays anyway, for two reasons that are true: it says
     "what is left" rather than restating the rate, so it cannot drift if
     LATE_CANCEL_RETAINED_PCT changes to something like 1/3 where the equivalence
     does NOT hold; and it survives the pre-rounding above being removed. What
     the test genuinely catches is the version with no rounding at all
     (0.2 + 0.306 = 0.506, not 0.51). */
  const releasedTnd = toCentimes(amountTnd - retainedTnd);

  return { late, msBeforeStart, retainedPct, amountTnd, retainedTnd, releasedTnd };
}
