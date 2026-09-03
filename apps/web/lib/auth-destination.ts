/* Where a user goes after proving they own their phone number.

   Extracted into a plain module because BOTH halves of the split entry point need
   the identical answer: /auth (sign in) and /signup/{prof,eleve}. When this logic
   lived inline in the login component, the two screens could — and did — disagree
   about what to do with a returning user.

   The order is a priority list, and each rung is there for a reason:

     1. GUARDIAN CONSENT. A minor may not use the service until it is signed
        (INPDP / Loi 2004-63), so it outranks everything, ?next= included.
     2. THE STUDENT WELCOME SCREEN. A student with no name on file still owes us
        one — see saveStudentProfile() for what breaks downstream without it.
     3. THE TUTOR'S FIRST STOREFRONT. A tutor with no page yet cannot use anything
        they might have been bounced off, so /onboarding outranks ?next= for them
        specifically. Before this rung existed, a brand-new tutor who arrived via
        /checkout was sent straight back to the checkout and never saw onboarding
        at all — ?next= (rung 4) silently outranked the role home (rung 5).
     4. ?next=. The page middleware.ts (or /live) bounced them off of.
     5. The role's home. For a tutor who ALREADY has a storefront that is
        /dashboard, not /onboarding: they are not onboarding, they are working.

   Rungs 1 and 2 CHAIN through ?next= rather than replacing it: a minor bounced out
   of /checkout?class=x signs consent, fills the welcome screen, and lands back on
   the booking they came for. Both destination pages re-run safeNext() on whatever
   they receive, so nesting stays safe — the value is only ever a relative,
   same-origin path to begin with (lib/validation.ts::safeNext). */

export type PostAuth = {
  role?: string;
  needsConsent?: boolean;
  needsProfile?: boolean;
  /** Tutors only. Undefined is treated as false, i.e. "send them to onboarding" —
      the safe default, since onboarding is resumable and pre-fills from the draft. */
  hasStorefront?: boolean;
};

function withNext(path: string, next: string | null): string {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

export function postAuthDestination(res: PostAuth, next: string | null): string {
  // Only students are ever asked for a name here; a tutor's name is collected by
  // /onboarding, which is their step 1 anyway.
  const welcome = res.needsProfile && res.role === "student" ? withNext("/student/welcome", next) : null;

  // Consent comes first, and carries the welcome screen (which carries ?next=).
  if (res.needsConsent) return withNext("/auth/consent", welcome ?? next);
  if (welcome) return welcome;

  /* A tutor with no page yet goes to /onboarding even when a ?next= is pending:
     every tutor-facing destination assumes a storefront exists, so honouring
     ?next= here just moves the dead end. Carry the ?next= through so they land on
     what they came for once the page exists. */
  const tutor = res.role === "tutor";
  if (tutor && !res.hasStorefront) return withNext("/onboarding", next);

  if (next) return next;
  return tutor ? "/dashboard" : "/student";
}
