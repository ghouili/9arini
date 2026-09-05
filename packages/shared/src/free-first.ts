/* THE FREE FIRST SESSION — one rule, one place.

   The policy: a free first session is OPT-IN, per tutor, and OFF by default.
   Before this existed the platform promised one on behalf of every tutor who
   never touched a checkbox, on ~30 screens, in the JSON-LD Offer, in the meta
   description and in llms.txt — a claim about money that no tutor made.

   The rule is an AND of two columns, and it lives here rather than being written
   out at each call site for the reason this project has now hit three separate
   times: two implementations of one rule that nothing forces to agree. A
   storefront that ANDs and a booking endpoint that does not is the difference
   between a page that says "free" and a charge that isn't. */

/** The effective answer for one class. Both halves must say yes.

    `tutorOptsIn` is the master switch — a policy the tutor set once.
    `classIsFree` is the per-listing detail, so a tutor who opts in can still run
    a paid intensive.

    Deliberately takes `boolean | null | undefined` on both sides: rows written
    before 0008 could be null, and a null must read as NO. Anything else would
    make "never set" mean "promised". */
export function isEffectivelyFreeFirst(
  tutorOptsIn: boolean | null | undefined,
  classIsFree: boolean | null | undefined,
): boolean {
  return tutorOptsIn === true && classIsFree === true;
}

/** Does this tutor advertise a free first session AT ALL?

    Separate from the per-class question because tutor-level surfaces — the
    storefront badge, the JSON-LD Offer, the profile meta description — render
    for tutors with no published class, and used to make the claim anyway. */
export function tutorOffersFreeFirst(tutorOptsIn: boolean | null | undefined): boolean {
  return tutorOptsIn === true;
}
