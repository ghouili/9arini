"use client";
import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";
import { Verified } from "@/components/ui";
import { Search, Star, Users, Clock } from "@/components/icons";
import { SiteShell } from "@/components/SiteShell";
import { demoStorefront } from "@/lib/demo";

// Inline extra tutors to supplement the one from demo.ts
const EXPLORE_TUTORS = [
  {
    slug: demoStorefront.tutor.slug,
    full_name: demoStorefront.tutor.full_name,
    avatar_initials: demoStorefront.tutor.avatar_initials,
    subject: demoStorefront.tutor.subject,
    rating: demoStorefront.tutor.rating,
    students_count: demoStorefront.tutor.students_count,
    verified: demoStorefront.tutor.verified,
    tag: { fr: "1ère gratuite", ar: "الأولى مجانية" },
    next: { fr: "Demain · 18:00", ar: "غدا · 18:00" },
  },
  {
    slug: "sonia-physique",
    full_name: "Sonia Trabelsi",
    avatar_initials: "ST",
    subject: "Prof de Physique · Lycée & Bac",
    rating: 4.8,
    students_count: 640,
    verified: true,
    tag: { fr: "1ère gratuite", ar: "الأولى مجانية" },
    next: { fr: "Aujourd'hui · 16:00", ar: "اليوم · 16:00" },
  },
  {
    slug: "karim-anglais",
    full_name: "Karim Mansouri",
    avatar_initials: "KM",
    subject: "Prof d'Anglais · Collège & Bac",
    rating: 4.7,
    students_count: 420,
    verified: false,
    tag: { fr: "1ère gratuite", ar: "الأولى مجانية" },
    next: { fr: "Samedi · 10:00", ar: "السبت · 10:00" },
  },
  {
    slug: "leila-primaire",
    full_name: "Leïla Ben Amor",
    avatar_initials: "LB",
    subject: "Maths & Français · Primaire & Collège",
    rating: 4.9,
    students_count: 210,
    verified: true,
    tag: { fr: "1ère gratuite", ar: "الأولى مجانية" },
    next: { fr: "Demain · 15:00", ar: "غدا · 15:00" },
  },
];

export default function ExplorePage() {
  const { t, locale } = useLocale();
  const [q, setQ] = useState("");
  const [subj, setSubj] = useState("all");

  const SUBJECTS = [
    { key: "all", label: t.extra.allSubjects },
    { key: "Math", label: "Maths" },
    { key: "Physique", label: "Physique" },
    { key: "Français", label: "Français" },
    { key: "Anglais", label: "Anglais" },
  ];

  const filtered = EXPLORE_TUTORS.filter((tu) => {
    const matchSubj = subj === "all" || tu.subject.includes(subj);
    const ql = q.trim().toLowerCase();
    const matchQ = !ql || tu.full_name.toLowerCase().includes(ql) || tu.subject.toLowerCase().includes(ql);
    return matchSubj && matchQ;
  });

  return (
    <SiteShell>
      {/* Hero / filter section */}
      <section className="border-b border-solid border-line bg-cream">
        <div className="container py-10 sm:py-12">
          {/* Eyebrow + heading */}
          <p className="mb-2 font-display text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            {t.nav.explore}
          </p>
          <h1 className="web-h2 mb-6">{t.extra.featured}</h1>

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
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-[15px] text-muted">{t.extra.noResults}</p>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((tutor) => (
                <Link
                  key={tutor.slug}
                  href={`/${tutor.slug}`}
                  className="group relative flex flex-col rounded-[var(--r-l)] border border-solid border-line bg-paper p-5 shadow-[var(--sh-s)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--sh)]"
                >
                  {/* Free first-lesson badge, pinned to the top-end corner */}
                  <span className="absolute end-4 top-4 rounded-full border border-solid border-green bg-green50 px-2.5 py-1 text-[11px] font-semibold text-green">
                    {locale === "ar" ? tutor.tag.ar : tutor.tag.fr}
                  </span>

                  {/* Top row: square gradient avatar + content column */}
                  <div className="flex items-start gap-3.5">
                    <div className="grid size-16 shrink-0 place-items-center rounded-[var(--r)] bg-gradient-to-br from-blue to-blue700 font-display text-xl font-bold text-paper">
                      {tutor.avatar_initials}
                    </div>

                    <div className="min-w-0 flex-1 pe-16">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-display text-base font-bold text-ink">
                          {tutor.full_name}
                        </span>
                        {tutor.verified && <Verified />}
                      </div>
                      <div className="mt-1 truncate text-[13px] text-muted">{tutor.subject}</div>
                    </div>
                  </div>

                  {/* Meta row */}
                  <div className="mt-5 flex items-center justify-between gap-2 border-t border-solid border-line pt-4 text-[13px] text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Star className="size-4 text-amber" />
                      <b className="font-display text-amber">{tutor.rating}</b>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="size-4" />
                      {tutor.students_count.toLocaleString()}
                    </span>
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <Clock className="size-4 shrink-0" />
                      <span className="truncate">{locale === "ar" ? tutor.next.ar : tutor.next.fr}</span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
