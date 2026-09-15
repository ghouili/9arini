import { and, classes, eq, gt, sql as raw } from "@tnajem/db";
import type { db as Db } from "../db";

/* A ROOM LINK OUTLIVES NOTHING IT WAS GIVEN FOR.

   GET /classes/:id/join hands a booked student the room URL, and the URL is
   derived from classes.room_token. The token never changed, so "book, fetch the
   link, cancel" kept a working link to every future session of that class — the
   seat back on sale, the attacker still able to walk into a room full of minors
   (security review, 15 Sept 2026). Rotating it whenever a seat is given up (a
   cancellation, an account block) retires every link fetched before; everyone
   still entitled fetches the new one from the join gate, which every surface
   calls when it renders.

   NOT inside the last ROTATION_CUTOFF_MIN before the start: the tutor may already
   be in the room, and a rotation then would split the class across two rooms.
   That window is the residual risk, and a tutor-supplied meeting link (meet_url)
   is outside this control entirely — both are reported, not hidden. */
export const ROTATION_CUTOFF_MIN = 30;

type Tx = Parameters<Parameters<typeof Db.transaction>[0]>[0];

export async function rotateRoomToken(tx: typeof Db | Tx, classId: string): Promise<boolean> {
  const rows = await tx
    .update(classes)
    .set({ roomToken: raw`gen_random_uuid()` })
    .where(
      and(
        eq(classes.id, classId),
        gt(classes.scheduledAt, raw`now() + ${ROTATION_CUTOFF_MIN} * interval '1 minute'`),
      ),
    )
    .returning({ id: classes.id });
  return rows.length > 0;
}
