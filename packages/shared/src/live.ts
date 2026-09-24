/* Live class rooms — never blank, never guessable.

   A room always exists: a class without its own URL gets a Jitsi room named after
   its ROOM TOKEN (classes.room_token, a random UUID — 0018_class_room_token.sql).
   It used to be named after the class id, which is printed on every public
   storefront (/class/<id>), so anyone could build the room URL of a live class
   without the API. The token is never on a public page: it reaches only the owning
   tutor or a student with a live booking (GET /classes/:id, /classes/:id/join,
   /student/dashboard).

   A tutor CAN still bring their own room (Zoom, Google Meet, their school's
   Jitsi) by setting classes.meet_url — that always wins, and it is just as private.

   Residual risk: a meet.jit.si room has no authentication — whoever holds the link
   is in. Gating that for real needs a JWT-protected Jitsi (JaaS or self-hosted).

   Uses a NEXT_PUBLIC_ env var only, so this module is safe on the client too
   (no `server-only` guard on purpose — the live page renders the join button). */

const DEFAULT_BASE = "https://meet.jit.si/tnajem-";

/** The fallback room for a class, from its private room token. */
export function liveRoomUrl(roomToken: string): string {
  const base = process.env.NEXT_PUBLIC_DEFAULT_MEET_BASE ?? DEFAULT_BASE;
  return base + roomToken;
}

/* phase-a lane L3 (A16) — WHEN A CLASS ENDS: start + duration, one definition.

   Reviews opened one minute into a class and the live page said "EN DIRECT" for
   ever after the start; both now read the real end. A missing or nonsensical
   duration falls back to the column default (90 min) rather than to zero, which
   would open reviews at the very start again. */
export const DEFAULT_CLASS_DURATION_MIN = 90;

export function classEndMs(cls: { scheduledAt: Date | string | number; durationMin?: number | null }): number {
  const d = cls.durationMin;
  const minutes = typeof d === "number" && Number.isFinite(d) && d > 0 ? d : DEFAULT_CLASS_DURATION_MIN;
  return new Date(cls.scheduledAt).getTime() + minutes * 60_000;
}

/** Resolve the room a class actually uses: the tutor's own URL if set, else its token room. */
export function resolveMeetUrl(cls: { roomToken: string; meetUrl?: string | null }): string {
  const own = (cls.meetUrl ?? "").trim();
  return own || liveRoomUrl(cls.roomToken);
}
