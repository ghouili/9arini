/* THE STATUS CONVENTION for every ported endpoint.

   ══════════════════════════════════════════════════════════════════════════════
   Every DOMAIN-LEVEL refusal returns HTTP 200 with { ok: false, error: "<code>" }.
   Non-200 is reserved for TRANSPORT and SHAPE failures only.
   ══════════════════════════════════════════════════════════════════════════════

   So: "full", "needs-consent", "already-started", "forbidden", "not-found",
   "own-class", "unavailable", "no-account", "invalid-code", "too-many-attempts"
   — all 200. Not 403, not 404, not 409.

   "too-late" is GONE, and its removal is a behaviour change worth naming here:
   cancelBooking used to refuse inside 24 hours with that code. Under the 48h/40%
   rule a late cancellation succeeds, so the only refusal left on that path is
   "already-started" — a class that has already begun. Any client still branching
   on "too-late" is branching on a case the server can no longer produce.

   WHY, and why this has to be written down: the action's contract is a VALUE, not
   a status. Client components branch on `res.error === "needs-consent"` today
   (CheckoutInner.tsx routes the student to the consent form on exactly that
   string). The natural REST instinct is to map each refusal onto a status code,
   and if 27 endpoints each improvise that mapping, the UI's error branching rots
   silently — the button just stops doing the right thing for one case and nobody
   notices until a user reports it.

   The only non-200s:
     400  the JSON did not match the zod schema. Cannot happen from the real UI;
          only from a malformed or hostile caller.
     500  unhandled. The proxy RETHROWS these rather than converting them to
          { ok: false } — see apps/web/lib/api.ts for why that preserves today's
          behaviour exactly. */

export type ActionResult = {
  ok: boolean;
  demo?: boolean;
  slug?: string;
  error?: string;
  /* What the WEB side must revalidate after this mutation.

     Every call site used to learn the slug from a row it had just read
     (createClass from mine.slug, reserveSeat from tut.slug, approveTutor from
     t.slug). After the port the web no longer has that row, and revalidateTag
     only works inside a Next request scope — so it cannot move to the API.

     Rather than adding a lookup round-trip on the booking path, every mutating
     endpoint reports what it invalidated and the proxy replays it. This is
     designed in from the FIRST domain even though auth does not use it:
     retrofitting it after six domains are ported is how you discover three weeks
     later that approved tutors take 60 seconds to appear and rejected ones stay
     public.

     Adding this field is type-compatible everywhere, because every consumer reads
     only the fields it knows about. Do NOT overload the existing `slug`, which
     means something else (createTutor's effective slug). */
  revalidate?: { tutors?: string[]; publicTutors?: boolean };
};

/** A zero-runtime type carrier, so the registry can name an output type without
    shipping a validator for it. Responses are type-only in Stage A: the DTOs are
    already exhaustively typed and re-validating them on the way out is pure cost
    with no new information. */
export function t<T>(): T {
  return undefined as unknown as T;
}
