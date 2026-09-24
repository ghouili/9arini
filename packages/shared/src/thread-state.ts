/* WHEN A CONVERSATION CLOSES (phase-a lane L1, A2).

   A thread is a booking (apps/api/src/routes/messages.ts), and it used to outlive
   everything except a cancellation: a tutor could keep writing to a minor through
   a months-old class, after the parent withdrew consent, after either account was
   blocked (CEO report, finding 2). The server decides with ONE function,
   apps/api/src/lib/thread-state.ts → threadState(threadId), and send refuses
   anything that is not "open".

   CLOSED IS NOT DELETED. The conversation that already happened stays readable,
   and reportable, by both parties and by the guardian: it is the evidence behind
   any report made about it. */

import type { ThreadStateShown } from "./types";

/** FOUNDER default (Phase A, to confirm): how many days after a class ENDS
    (start + duration) its conversation stays open for questions and follow-up. */
export const THREAD_CLOSE_DAYS = 7;

export type ThreadClosedReason =
  | "booking-cancelled" // the seat was given up — the reason the channel existed
  | "consent-withdrawn" // the guardian withdrew consent for a minor: immediate
  | "blocked" // either account is blocked, or the tutor's storefront is suspended: immediate
  | "class-ended"; // THREAD_CLOSE_DAYS after the class ended

/** The server's answer. The reason is for the server and its logs. */
export type ThreadState = "open" | `closed:${ThreadClosedReason}`;

/** What a participant or guardian is TOLD, in the thread payload.

    Two reasons are never shown. A tutor is told a seat came free, never why
    (guardian.ts), so "consent-withdrawn" must not leak through the thread; and
    nobody learns from a conversation that the other account was blocked. Both
    read as a plain "closed". */
export function shownThreadState(state: ThreadState): ThreadStateShown {
  if (state === "open" || state === "closed:booking-cancelled" || state === "closed:class-ended") return state;
  return "closed";
}

export function isThreadOpen(state: ThreadState | ThreadStateShown): boolean {
  return state === "open";
}
