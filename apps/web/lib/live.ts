/* Live class rooms — deterministic, never blank.

   The old flow only worked if a tutor pasted a meet URL when creating the class;
   leave it empty and the student's "Rejoindre" button pointed at nothing. Now a
   room always exists: it's derived from the class id, so tutor and student
   compute the exact same URL without any row being written.

   A tutor CAN still bring their own room (Zoom, Google Meet, their school's
   Jitsi) by setting classes.meet_url — that always wins.

   Uses a NEXT_PUBLIC_ env var only, so this module is safe on the client too
   (no `server-only` guard on purpose — the live page renders the join button). */

const DEFAULT_BASE = "https://meet.jit.si/tnajem-";

/** The fallback room for a class: same id → same room, forever. */
export function liveRoomUrl(classId: string): string {
  const base = process.env.NEXT_PUBLIC_DEFAULT_MEET_BASE ?? DEFAULT_BASE;
  return base + classId;
}

/** Resolve the room a class actually uses: the tutor's own URL if set, else the derived one. */
export function resolveMeetUrl(cls: { id: string; meetUrl?: string | null; meet_url?: string | null }): string {
  const own = (cls.meetUrl ?? cls.meet_url ?? "").trim();
  return own || liveRoomUrl(cls.id);
}
