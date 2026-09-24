import { initials, type ExploreTutor } from "@tnajem/shared";
import { publicTutorName } from "@tnajem/shared"; // phase-a lane L2 (A23)
import { levelsLabel, sortLevels } from "@tnajem/shared"; // phase-a lane L5 (A18.7)

/* One explore card. Split out only so routes/tutors.ts stays readable; the shape
   is exactly what apps/web rendered before the port. */

type TutorRow = {
  slug: string;
  fullName: string;
  subject: string;
  level: string | null;
  levels?: string[] | null; // phase-a lane L5 (A18.7)
  bio: string | null;
  studentsCount: number | null;
};

export function toExploreTutor(
  t: TutorRow,
  agg: { avg: string | null; n: number } | undefined,
  minPrice: string | null | undefined,
  /* Step 16. TRUE only when a live Pro/Prestige grant moved this card up the
     list. The card renders a visible "Mis en avant" mark from it — paid
     placement the reader cannot see is an advertisement pretending to be a
     recommendation. Defaults false so a caller that forgets it cannot silently
     ship an UNLABELLED boosted card. */
  featured = false,
): ExploreTutor {
  /* phase-a lane L2 (A23) — D1: "Mohamed B." on Explore and in search results;
     the last name is never sent. `full_name` keeps its key for the web. */
  const shownName = publicTutorName(t.fullName) ?? "";
  return {
    slug: t.slug,
    full_name: shownName,
    subject: t.subject,
    // phase-a lane L5 (A18.7): the chosen levels (codes) and their FR labels — never the legacy column.
    level: levelsLabel(t.levels, "fr"),
    levels: sortLevels(t.levels),
    bio: t.bio ?? "",
    avatar_initials: initials(shownName),
    /* Straight from the reviews table — tutors.rating is only a cached mirror, and
       a tutor with no reviews must show 0 (the UI renders "Nouveau"), never a
       fabricated score. */
    rating: agg?.avg ? Math.round(Number(agg.avg) * 10) / 10 : 0,
    review_count: agg?.n ?? 0,
    students_count: t.studentsCount ?? 0,
    price_from_tnd: minPrice !== null && minPrice !== undefined ? Number(minPrice) : null,
    featured,
  };
}
