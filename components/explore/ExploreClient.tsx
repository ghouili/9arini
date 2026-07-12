"use client";
/* ───────────────────────────────────────────────────────────────────────────
   /explore CLIENT ISLAND — the interactive layer of the marketplace feed.

   The page (app/explore/page.tsx) is now a SERVER component: it fetches the
   unfiltered verified tutors and passes them here as `initial`, so the real
   catalogue is in the SSR HTML — crawlers (and the first paint on a 3G phone) see
   the tutors, not an empty grid that only fills in after client JS runs. This
   island then owns the interactive filtering (subject chips + search).

   `initial` mirrors getExploreTutors()'s contract:
     null → demo mode (no DATABASE_URL): clearly-badged static preview (never 404s,
            since getStorefront() resolves any slug in demo mode).
     []   → real DB, no verified tutor yet: honest empty state + CTA.
     [..] → results. Rating/review_count come from the reviews table; 0 reviews →
            "Nouveau", never a fabricated star score.

   The subject chips + search box re-query server-side (ilike over
   name/subject/level/bio), debounced, with a race guard on stale responses.
   Copy is page-local (FR + Tunisian Derija) — lib/i18n.ts is owned elsewhere.
   ─────────────────────────────────────────────────────────────────────────── */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";
import { Verified } from "@/components/ui";
import { Search, Star, Users, Bolt } from "@/components/icons";
import { SiteShell } from "@/components/SiteShell";
import { getExploreTutors } from "@/app/actions";
import { demoStorefront } from "@/lib/demo";
import type { ExploreTutor } from "@/lib/types";

/* ── Page-local copy (FR + Tunisian Derija) ── */
const copy = {
  fr: {
    heroSub: "Des profs tunisiens vérifiés, un par un. Première séance offerte.",
    isNew: "Nouveau",
    reviews: (n: number) => (n === 1 ? "1 avis" : `${n} avis`),
    students: "élèves",
    from: "à partir de",
    tnd: "TND",
    verifiedOnly: "Profs vérifiés",
    emptyTitle: "Aucun prof pour l'instant",
    emptyBody:
      "On vérifie chaque prof à la main, un par un. Les premiers arrivent bientôt. Tu es prof ? Ouvre ta page en 5 minutes — c'est gratuit.",
    emptyCta: "Crée ta page de prof",
    noResultsBody: "Essaie une autre matière, ou un autre mot.",
    clear: "Effacer les filtres",
    loading: "On cherche…",
  },
  ar: {
    heroSub: "أساتذة توانسة، منقّحين واحد واحد. الحصة الأولى مجانية.",
    isNew: "جديد",
    reviews: (n: number) => (n === 1 ? "تقييم واحد" : `${n} تقييم`),
    students: "تلميذ",
    from: "من",
    tnd: "د.ت",
    verifiedOnly: "أساتذة مؤكّدين",
    emptyTitle: "ما فماش أساتذة توّا",
    emptyBody:
      "نأكّدو في كل أستاذ بيدينا، واحد واحد. الأوّلين جايين قريب. إنت أستاذ؟ اعمل صفحتك في 5 دقايق — بلاش.",
    emptyCta: "اعمل صفحتك كأستاذ",
    noResultsBody: "جرّب مادة أخرى، ولا كلمة أخرى.",
    clear: "امسح الفلاتر",
    loading: "قاعدين نلوّجو…",
  },
} as const;

/* Static preview used ONLY in demo mode (no DATABASE_URL). Never rendered when a
   DB is connected — see the `demo` flag below. */
const DEMO_PREVIEW: ExploreTutor[] = [
  {
    slug: demoStorefront.tutor.slug,
    full_name: demoStorefront.tutor.full_name,
    subject: demoStorefront.tutor.subject,
    level: demoStorefront.tutor.level,
    bio: demoStorefront.tutor.bio,
    avatar_initials: demoStorefront.tutor.avatar_initials,
    rating: demoStorefront.tutor.rating,
    review_count: 37,
    students_count: demoStorefront.tutor.students_count,
    price_from_tnd: 15,
  },
  {
    slug: "sonia-physique",
    full_name: "Sonia Trabelsi",
    subject: "Prof de Physique · Lycée & Bac",
    level: "Bac",
    bio: "Physique-chimie sans par cœur : on comprend, puis on s'entraîne sur les annales.",
    avatar_initials: "ST",
    rating: 4.8,
    review_count: 12,
    students_count: 640,
    price_from_tnd: 18,
  },
  {
    slug: "leila-primaire",
    full_name: "Leïla Ben Amor",
    subject: "Maths & Français · Primaire & Collège",
    level: "Collège",
    bio: "Les bases d'abord. Patiente, en darija, avec des exercices à la maison.",
    avatar_initials: "LB",
    rating: 0,
    review_count: 0,
    students_count: 0,
    price_from_tnd: 12,
  },
];

export function ExploreClient({ initial }: { initial: ExploreTutor[] | null }) {
  const { t, locale } = useLocale();
  const c = copy[locale === "ar" ? "ar" : "fr"];

  const [q, setQ] = useState("");
  const [subj, setSubj] = useState("all");
  // Seeded from the server render (SSR includes the real tutors → crawlable, no
  // client round-trip for the first paint). null from the server = demo mode.
  const [tutors, setTutors] = useState<ExploreTutor[]>(initial ?? DEMO_PREVIEW);
  const [loading, setLoading] = useState(false);
  const [demo, setDemo] = useState(initial === null);

  // Guards against out-of-order responses (fast typing on a slow 3G link).
  const reqId = useRef(0);
  // The server already delivered the unfiltered first page; only hit the network
  // once the user actually changes a filter (skips a redundant fetch on mount).
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    const debounce = q.trim() ? 320 : 0;

    const timer = setTimeout(() => {
      getExploreTutors({
        subject: subj === "all" ? undefined : subj,
        q: q.trim() || undefined,
      })
        .then((res) => {
          if (id !== reqId.current) return; // stale
          if (res === null) {
            setDemo(true);
            setTutors(DEMO_PREVIEW);
          } else {
            setDemo(false);
            setTutors(res);
          }
        })
        .catch(() => {
          if (id !== reqId.current) return;
          setDemo(false);
          setTutors([]);
        })
        .finally(() => {
          if (id === reqId.current) setLoading(false);
        });
    }, debounce);

    return () => clearTimeout(timer);
  }, [q, subj]);

  const SUBJECTS = [
    { key: "all", label: t.extra.allSubjects },
    { key: "Math", label: "Maths" },
    { key: "Physique", label: "Physique" },
    { key: "Français", label: "Français" },
    { key: "Anglais", label: "Anglais" },
  ];

  const hasFilters = subj !== "all" || q.trim().length > 0;

  // In demo mode the server can't filter for us — filter the preview client-side
  // so the chips and the search box still visibly work.
  const visible = demo
    ? tutors.filter((tu) => {
        const matchSubj = subj === "all" || tu.subject.includes(subj);
        const ql = q.trim().toLowerCase();
        const matchQ =
          !ql ||
          tu.full_name.toLowerCase().includes(ql) ||
          tu.subject.toLowerCase().includes(ql) ||
          tu.bio.toLowerCase().includes(ql);
        return matchSubj && matchQ;
      })
    : tutors;

  function clearFilters() {
    setQ("");
    setSubj("all");
  }

  return (
    <SiteShell>
      {/* Hero / filter section */}
      <section className="border-b border-solid border-line bg-cream">
        <div className="container py-10 sm:py-12">
          {/* Eyebrow + heading */}
          <p className="mb-2 font-display text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            {t.nav.explore}
          </p>
          <h1 className="web-h2 mb-2">{t.extra.featured}</h1>
          <p className="mb-6 max-w-[560px] text-[14.5px] leading-relaxed text-muted">{c.heroSub}</p>

          {/* Search bar */}
          <div className="mb-5 max-w-[560px]">
            <div className="flex items-center gap-2.5 rounded-[var(--r)] border border-solid border-line bg-paper px-3.5 py-2.5 shadow-[var(--sh-s)] transition-colors focus-within:border-blue">
              <Search className="size-[18px] shrink-0 text-muted" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t.extra.searchPh}
                aria-label={t.extra.searchPh}
                className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
              />
            </div>
          </div>

          {/* Subject filter chips */}
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map((s) => {
              const active = subj === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSubj(s.key)}
                  aria-pressed={active}
                  className={`cursor-pointer whitespace-nowrap rounded-full border border-solid px-4 py-1.5 text-[13px] font-semibold transition-colors ${
                    active
                      ? "border-blue bg-blue text-paper shadow-[var(--sh-s)]"
                      : "border-line bg-paper text-ink2 hover:border-blue hover:text-blue"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Results grid */}
      <section className="py-10 sm:py-14">
        <div className="container">
          {/* Demo-mode disclosure: never let a preview masquerade as the real catalogue. */}
          {demo && !loading && (
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-solid border-line bg-sand px-3.5 py-1.5 text-[12.5px] font-semibold text-ink2">
              <Bolt className="size-4 shrink-0 text-amber" />
              {t.extra.demoPreview}
            </div>
          )}

          {loading ? (
            /* ── Loading ── */
            <div
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
              role="status"
              aria-live="polite"
              aria-label={c.loading}
            >
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-[var(--r-l)] border border-solid border-line bg-paper p-5 shadow-[var(--sh-s)]"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="size-16 shrink-0 rounded-[var(--r)] bg-line" />
                    <div className="min-w-0 flex-1 space-y-2 pt-1.5">
                      <div className="h-3.5 w-2/3 rounded bg-line" />
                      <div className="h-3 w-1/2 rounded bg-line" />
                    </div>
                  </div>
                  <div className="mt-5 h-3 w-full rounded bg-line" />
                  <div className="mt-2 h-3 w-4/5 rounded bg-line" />
                  <div className="mt-5 border-t border-solid border-line pt-4">
                    <div className="h-3 w-1/2 rounded bg-line" />
                  </div>
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            /* ── Empty ── two honest flavours: filtered-to-nothing vs no catalogue yet ── */
            <div className="mx-auto max-w-[520px] rounded-[var(--r-l)] border border-solid border-line bg-paper px-6 py-12 text-center shadow-[var(--sh-s)]">
              <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-blue50 text-blue">
                <Search className="size-6" />
              </div>
              <h2 className="mb-2 font-display text-lg font-bold text-ink">
                {hasFilters ? t.extra.noResults : c.emptyTitle}
              </h2>
              <p className="mx-auto mb-6 max-w-[400px] text-[14.5px] leading-relaxed text-muted">
                {hasFilters ? c.noResultsBody : c.emptyBody}
              </p>
              {hasFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="cursor-pointer rounded-full border border-solid border-line bg-paper px-5 py-2 text-[13.5px] font-semibold text-ink2 transition-colors hover:border-blue hover:text-blue"
                >
                  {c.clear}
                </button>
              ) : (
                <Link
                  href="/pour-les-profs"
                  className="inline-flex items-center justify-center rounded-full bg-blue px-6 py-2.5 text-[14px] font-bold text-paper shadow-[var(--sh-s)] transition-colors hover:bg-blue700"
                >
                  {c.emptyCta}
                </Link>
              )}
            </div>
          ) : (
            /* ── Results ── */
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((tutor) => {
                const isNew = tutor.review_count === 0;
                return (
                  <Link
                    key={tutor.slug}
                    href={`/${tutor.slug}`}
                    className="group relative flex flex-col rounded-[var(--r-l)] border border-solid border-line bg-paper p-5 shadow-[var(--sh-s)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--sh)]"
                  >
                    {/* "Nouveau" — honest stand-in for a rating nobody has given yet */}
                    {isNew && (
                      <span className="absolute end-4 top-4 rounded-full border border-solid border-green bg-green50 px-2.5 py-1 text-[11px] font-semibold text-green">
                        {c.isNew}
                      </span>
                    )}

                    {/* Top row: square gradient avatar + content column */}
                    <div className="flex items-start gap-3.5">
                      <div className="grid size-16 shrink-0 place-items-center rounded-[var(--r)] bg-gradient-to-br from-blue to-blue700 font-display text-xl font-bold text-paper">
                        {tutor.avatar_initials}
                      </div>

                      <div className={`min-w-0 flex-1 ${isNew ? "pe-16" : ""}`}>
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-display text-base font-bold text-ink">
                            {tutor.full_name}
                          </span>
                          {/* Only verified tutors are ever returned by getExploreTutors */}
                          <Verified />
                        </div>
                        <div className="mt-1 truncate text-[13px] text-muted">{tutor.subject}</div>
                      </div>
                    </div>

                    {/* Bio teaser */}
                    {tutor.bio && (
                      <p className="mt-4 line-clamp-2 text-[13px] leading-relaxed text-ink2">
                        {tutor.bio}
                      </p>
                    )}

                    {/* Meta row: real rating (or "Nouveau"), real students, cheapest class */}
                    <div className="mt-5 flex items-center justify-between gap-2 border-t border-solid border-line pt-4 text-[13px] text-muted">
                      {isNew ? (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-green">
                          {c.isNew}
                        </span>
                      ) : (
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <Star className="size-4 shrink-0 text-amber" />
                          <b className="font-display text-amber">{tutor.rating.toFixed(1)}</b>
                          <span className="truncate">({c.reviews(tutor.review_count)})</span>
                        </span>
                      )}

                      {tutor.students_count > 0 && (
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="size-4" />
                          {tutor.students_count.toLocaleString()}
                        </span>
                      )}

                      {tutor.price_from_tnd !== null && (
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <span className="truncate">
                            {c.from}{" "}
                            <b className="font-display text-ink">
                              {tutor.price_from_tnd} {c.tnd}
                            </b>
                          </span>
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
