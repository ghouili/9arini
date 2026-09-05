import { detectContactInfo, maskContactInfo, type ContactKind } from "@tnajem/shared";
import { contactLeakFlags } from "@tnajem/db";
import { db } from "../db";

/* THE CONTACT GUARD — one place, so five write sites cannot apply the rule five
   slightly different ways.

   ── TWO POLICIES, AND THE SPLIT IS NOT ARBITRARY ─────────────────────────────

   REJECT  fields the author can trivially re-edit and re-submit: a bio, a class
           title, a display name. The form is still in front of them, the text is
           short, and refusing is unambiguous — they know exactly what happened
           and fix it in ten seconds. Silently mangling a tutor's own storefront
           copy would be worse: they would publish, see "[masqué]" on their public
           page, and have no idea why.

   MASK    channels where losing the text loses the POINT: a review, a message.
           A student who wrote three paragraphs about a class and put a number in
           the last line should not lose the three paragraphs. The details go, the
           argument stays, and a flag is recorded.

   ── WHAT IS LOGGED ───────────────────────────────────────────────────────────
   The pattern class and a count. NEVER the matched text — see the header of
   packages/db/sql/0010. Flagging is BEST-EFFORT and never blocks the write it
   describes: a moderation insert failing must not cost a student their review.

   ── WHAT THIS IS NOT ─────────────────────────────────────────────────────────
   It is not a guarantee. A tutor can say a number out loud on Jitsi. The goal is
   to make contact exchange a deliberate, visible act instead of the default
   path. */

export type LeakSurface =
  | "tutor_bio"
  | "tutor_name"
  | "tutor_subject"
  | "class_title"
  | "class_description"
  | "pack_title"
  | "review"
  | "message";

/** The single error code every rejecting write site returns. */
export const CONTACT_ERROR = "contact-info-not-allowed";

/** Record what was found. Fire-and-forget: never throws, never blocks. */
async function flag(
  profileId: string | null,
  surface: LeakSurface,
  action: "rejected" | "masked",
  counts: Map<ContactKind, number>,
): Promise<void> {
  if (counts.size === 0) return;
  try {
    await db.insert(contactLeakFlags).values(
      [...counts].map(([kind, hits]) => ({
        profileId,
        surface,
        kind,
        action,
        hits,
      })),
    );
  } catch {
    /* Moderation telemetry is not worth failing a user's write over. The
       enforcement above already happened; this is the record of it. */
  }
}

function countKinds(kinds: ContactKind[]): Map<ContactKind, number> {
  const m = new Map<ContactKind, number>();
  for (const k of kinds) m.set(k, (m.get(k) ?? 0) + 1);
  return m;
}

/** REJECT policy. Returns true when the text is clean and the write may proceed.

    Checks every field before returning, rather than short-circuiting on the
    first hit: a tutor who put a number in both the bio and the title should be
    told once, not made to submit twice — and the flags should record both. */
export async function assertNoContactInfo(
  profileId: string | null,
  fields: { surface: LeakSurface; value: string | null | undefined }[],
): Promise<boolean> {
  let clean = true;
  for (const f of fields) {
    const scan = detectContactInfo(f.value);
    if (!scan.found) continue;
    clean = false;
    await flag(profileId, f.surface, "rejected", countKinds(scan.matches.map((m) => m.kind)));
  }
  return clean;
}

/** MASK policy. Returns the text to store, and whether anything was removed. */
export async function maskAndFlag(
  profileId: string | null,
  surface: LeakSurface,
  value: string | null | undefined,
): Promise<{ text: string | null; masked: boolean }> {
  const scan = detectContactInfo(value);
  if (!scan.found) return { text: value ?? null, masked: false };
  await flag(profileId, surface, "masked", countKinds(scan.matches.map((m) => m.kind)));
  return { text: maskContactInfo(value), masked: true };
}
