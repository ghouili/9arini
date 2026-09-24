import { messages, reviews, sql as raw } from "@tnajem/db";

/* phase-a lane L4 (A28) — CONTENT HIDDEN BY MODERATION, in ONE place.

   An admin can hide a message or a review from the moderation queue
   (POST /admin/moderation/hide). It is a soft delete: messages.body and
   reviews.text are kept as evidence and only the ADMIN surfaces read them raw.
   Every other surface selects the text through the helpers below, which swap in
   the placeholder IN THE QUERY — so no route can forget the rule by mapping the
   row itself, and the hidden text never leaves the database for a non-admin.

   The author sees the placeholder too: hiding is not "hidden from the other
   party", it is "removed from the conversation".

   Language: a signed-in reader gets their own (profiles.locale). An ANONYMOUS read
   (the public review feed, which feeds an ISR-cached page shared by /fr and /ar)
   has no locale, so it gets both, French first. */

export const MODERATION_PLACEHOLDER = {
  fr: "Contenu retiré par la modération",
  ar: "المحتوى هذا تنحّى من طرف المراقبة",
} as const;

/** The placeholder for a reader: "fr", "ar", or both when the reader is unknown. */
export function moderationPlaceholder(locale: string | null | undefined): string {
  if (locale === "ar") return MODERATION_PLACEHOLDER.ar;
  if (locale === "fr") return MODERATION_PLACEHOLDER.fr;
  return `${MODERATION_PLACEHOLDER.fr} · ${MODERATION_PLACEHOLDER.ar}`;
}

/** SELECT this instead of `messages.body` on every non-admin read. */
export function visibleMessageBody(locale: string | null | undefined) {
  return raw<string>`case when ${messages.hiddenAt} is not null then ${moderationPlaceholder(locale)} else ${messages.body} end`;
}

/** SELECT this instead of `reviews.text` on every non-admin read. */
export function visibleReviewText(locale: string | null | undefined) {
  return raw<string | null>`case when ${reviews.hiddenAt} is not null then ${moderationPlaceholder(locale)} else ${reviews.text} end`;
}
