/* A tutor's public standing — the one thing both /explore and the storefront say
   about how established a tutor is.

   On 14 Sept one tutor carried three histories at once: "4,9 ★ (37 avis) · 1 240"
   on their /explore card, "Nouveau prof · 1 240 élèves" in their storefront header,
   and "Pas encore d'avis" in the reviews panel under it. Two renderers read two
   sources and a template conditional kept them apart, until it didn't.

   So the contradiction is not representable. A tutor is EITHER new — no rating,
   no review count, no student count to show — OR rated, and only a rated tutor
   carries numbers. "Nouveau · 1 240 élèves" cannot be built from this type. Both
   surfaces go through tutorStanding() and render through the same component
   (apps/web/components/TutorStanding.tsx). Pure module: safe on server + client. */

export type TutorStanding =
  | { kind: "new" }
  | { kind: "rated"; rating: number; reviewCount: number; students: number };

/** Reviews decide. Zero reviews is "new", whatever any other counter says. */
export function tutorStanding(src: { reviewCount: number; rating: number; students: number }): TutorStanding {
  if (!(src.reviewCount > 0)) return { kind: "new" };
  return {
    kind: "rated",
    rating: src.rating,
    reviewCount: src.reviewCount,
    /* Can legitimately be 0 while reviews exist: a review outlives its author's
       deleted account, and the student count only counts remaining bookings. */
    students: Math.max(0, src.students),
  };
}
