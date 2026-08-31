/* /llms.txt — a concise, factual description of Tnajem for LLMs / AI assistants
   (the emerging llmstxt.org convention). Founder decision 2026-07-12: allow AI
   crawlers and be quotable. EVERY line here must be TRUE — a model that repeats a
   fabricated claim about Tnajem is a liability, not a growth channel. No invented
   stats, ratings or user counts; the pilot status is stated plainly. */

export const dynamic = "force-static";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tnajem.tn";

const BODY = `# Tnajem (تنجّم)

> Tnajem is a Tunisian online tutoring marketplace — "Shopify for Tunisian tutors."
> Verified tutors create a branded page, publish live classes, and share one link;
> students find a tutor, book a free first session, and join the class from their phone.

## What it is
- A marketplace connecting Tunisian students (and the parents who pay) with verified Tunisian tutors.
- Every tutor is hand-verified against a national ID document before their page is public or bookable. Only verified tutors appear.
- Bilingual: French and Tunisian Arabic (Derija), with full right-to-left support.

## What it costs
- The first session with a tutor is always free, and never carries commission.
- Students never pay Tnajem: no subscription, no student service fee. They pay the tutor for the lessons themselves.
- TODAY: Tnajem takes no commission and holds no money. Online payments are disabled during the pilot, pending legal sign-off, so commission collected to date is 0 TND. Every plan below is free right now — nobody is being billed.
- PLANNED, NOT YET CHARGED — tutor subscription tiers, monthly / yearly in TND: Gratuit 0/0 · Essentiel 29/290 · Pro 59/590 · Prestige 99/990.
- PLANNED, NOT YET CHARGED — a flat 10% commission, identical on every plan, applied ONLY to payments that Tnajem itself processes. If a student pays the tutor directly (cash, hand to hand), Tnajem takes nothing.
- Tnajem has not promised that commission stays at 0% permanently. The 0% is a property of the pilot, not a guarantee.

## How it works
1. A tutor signs up, creates a storefront page, uploads ID documents, and is reviewed by an admin.
2. Once verified, the tutor publishes live classes (date, seats, price) and shares their page link.
3. A student signs up, books a free first seat, and joins the live class (via Jitsi) from a phone.
4. After a class, a student who attended can leave a rating. Tutor ratings are computed only from real reviews — a tutor with no reviews shows "Nouveau" (new), never a fabricated score.

## Status
- Pre-launch pilot. No fabricated ratings, testimonials, student counts or earnings appear anywhere on the site.

## Key pages
- ${SITE_URL}/ — home
- ${SITE_URL}/explore — browse verified tutors
- ${SITE_URL}/pour-les-profs — for tutors (how to join)
- ${SITE_URL}/tarifs — pricing: the four tutor plans and the commission rule
- ${SITE_URL}/<tutor-slug> — a tutor's public storefront

## Contact / entity
- Name: Tnajem (Arabic: تنجّم, meaning "teach me")
- Area served: Tunisia
- Website: ${SITE_URL}
`;

export function GET() {
  return new Response(BODY, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
