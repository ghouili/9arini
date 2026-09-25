/* The tutor's standing badge — ONE renderer for /explore and the storefront.

   They used to be two: a card in components/explore/ExploreClient.tsx and a hero
   line in components/storefront/StorefrontView.tsx, each deciding for itself
   whether a tutor was "new". They drifted into saying three different things about
   the same person. Now both pass a TutorStanding (@tnajem/shared) — a value that
   cannot be "new" and carry a count at the same time — and render it here.

   No "use client" and no hooks: ExploreClient (client) and StorefrontView (server)
   both import it. The locale is a prop for the same reason. Numbers go through
   Intl with the page's locale, so the server render and the hydrated one agree
   and French reads "4,9", not "4.9". */
import type { TutorStanding as Standing } from "@tnajem/shared";
import type { AppLocale } from "@/lib/locale";
import { bilingual } from "@/lib/i18n";
import { Star, Users } from "@/components/icons";

const copy = bilingual({
  fr: {
    isNew: "Nouveau prof",
    reviews: (n: string, one: boolean) => (one ? "1 avis" : `${n} avis`),
    /* A FUNCTION, like `reviews` — it used to be the bare plural "élèves", and a
       tutor with one student read "1 élèves" on /explore and on their storefront.
       Caught by looking at the Stage 8 screenshots. */
    students: (n: string, one: boolean) => (one ? "1 élève" : `${n} élèves`),
  },
  ar: {
    isNew: "أستاذ جديد",
    reviews: (n: string, one: boolean) => (one ? "تقييم واحد" : `${n} تقييم`),
    /* Arabic counts differently: one is "تلميذ واحد", and from 11 up the noun goes
       back to the singular after the numeral — which is why the plural branch is
       "<n> تلميذ" and not a broken "تلاميذ" for every count. */
    students: (n: string, one: boolean) => (one ? "تلميذ واحد" : `${n} تلميذ`),
  },
});

const intlLocale = (locale: AppLocale) => (locale === "ar" ? "ar-TN" : "fr-TN");

/** A rating as the page's locale writes it: "4,9" in French. Always one decimal. */
export function formatRating(rating: number, locale: AppLocale): string {
  return new Intl.NumberFormat(intlLocale(locale), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(rating);
}

function formatCount(n: number, locale: AppLocale): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(n);
}

/** 5 stars, only `filled` of them lit. Decorative by default (aria-hidden) since a
    nearby number carries the score; pass `label` on a standalone rating (e.g. a
    review row) so the score is announced. */
export function Stars({ filled, size = 13, label }: { filled: number; size?: number; label?: string }) {
  return (
    <span className="stars" {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} style={{ width: size, height: size, opacity: i <= filled ? 1 : 0.28 }} />
      ))}
    </span>
  );
}

export function TutorStanding({
  standing,
  locale,
  variant,
}: {
  standing: Standing;
  locale: AppLocale;
  /** "hero": the storefront's blue header band. "card": an /explore card footer. */
  variant: "hero" | "card";
}) {
  const c = copy[locale === "ar" ? "ar" : "fr"];

  if (standing.kind === "new") {
    return variant === "hero" ? (
      <span className="tag tag-neutral sf-newtag">{c.isNew}</span>
    ) : (
      /* UI Option A (A5): "Nouveau prof" is plain information — neutral blue, not
         green (green is the Vérifié badge and real success only). */
      <span className="tag tag-neutral">{c.isNew}</span>
    );
  }

  const rating = formatRating(standing.rating, locale);
  const reviews = c.reviews(formatCount(standing.reviewCount, locale), standing.reviewCount === 1);
  const students = standing.students > 0 ? c.students(formatCount(standing.students, locale), standing.students === 1) : null;

  if (variant === "hero") {
    return (
      <>
        <Stars filled={Math.round(standing.rating)} />
        <b className="sf-num">{rating}</b>
        <span className="opacity-[0.85]">({reviews})</span>
        {students && (
          <>
            <span aria-hidden="true" className="opacity-[0.6]">·</span>
            <span>{students}</span>
          </>
        )}
      </>
    );
  }

  return (
    <>
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <Star className="size-4 shrink-0 text-amber" />
        <b className="font-display text-ink">{rating}</b>
        <span>({reviews})</span>
      </span>
      {students && (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <Users className="size-4 shrink-0" />
          {students}
        </span>
      )}
    </>
  );
}
