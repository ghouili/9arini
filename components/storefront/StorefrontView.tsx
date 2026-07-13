"use client";
import { Link } from "@/components/Link";
import { Avatar, Chip, Verified, Button } from "@/components/ui";
import {
  Share,
  Star,
  Clock,
  Users,
  Lock,
  Play,
} from "@/components/icons";
import { useLocale } from "@/components/LocaleProvider";
import { SiteShell } from "@/components/SiteShell";
import type { Storefront, TutorReviews } from "@/lib/types";

/** Month label map FR → AR (short). Demo data uses FR short labels. */
const monthAr: Record<string, string> = {
  JANV: "جانفي", FÉVR: "فيفري", MARS: "مارس", AVR: "أفريل",
  MAI: "ماي", JUIN: "جوان", JUIL: "جويل", AOÛT: "أوت",
  SEPT: "سبتمبر", OCT: "أكتوبر", NOV: "نوفمبر", DÉC: "ديسمبر",
};

/* Component-local copy (FR + Tunisian Derija). lib/i18n.ts is owned elsewhere, so
   any new string lives here — same pattern as app/pour-les-profs/page.tsx. */
const copy = {
  fr: {
    students: "élèves",
    isNew: "Nouveau prof",
    reviewsTitle: "Avis des élèves",
    reviewsCount: (n: number) => (n === 1 ? "1 avis" : `${n} avis`),
    noReviewsTitle: "Pas encore d'avis",
    noReviewsBody: "Ce prof vient d'arriver. Après ta séance, tu pourras laisser le premier avis.",
    anon: "Élève",
    noClassesTitle: "Ce prof n'a pas encore publié de séance",
    noClassesBody:
      "Sa page est ouverte, mais aucune séance n'est encore programmée. Reviens bientôt — ou trouve un autre prof dès maintenant.",
    noClassesCta: "Voir d'autres profs",
  },
  ar: {
    students: "تلميذ",
    isNew: "أستاذ جديد",
    reviewsTitle: "آراء التلامذة",
    reviewsCount: (n: number) => (n === 1 ? "تقييم واحد" : `${n} تقييم`),
    noReviewsTitle: "ما فماش تقييمات توّا",
    noReviewsBody: "الأستاذ هذا جديد. بعد الحصة متاعك، تنجّم تكون أوّل واحد يقيّم.",
    anon: "تلميذ",
    noClassesTitle: "هذا الأستاذ مازال ما نشرش حصة",
    noClassesBody:
      "الصفحة متاعو محلولة، أما مازال ما فماش حصة مبرمجة. عاود شوف قريب — ولا لوّج على أستاذ آخر توّا.",
    noClassesCta: "شوف أساتذة أخرين",
  },
} as const;

const EMPTY_REVIEWS: TutorReviews = { items: [], average: 0, count: 0 };

/** "Amine K." → "AK". Reviews only ever carry a public name (never the phone). */
function initialsOf(name: string | null) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/** Deterministic (UTC) date — identical on the server and after hydration. */
function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

/** 5 stars, only `filled` of them lit. No reviews → the caller shows "Nouveau" instead. */
function Stars({ filled, size = 13 }: { filled: number; size?: number }) {
  return (
    <span className="stars" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{
            width: size,
            height: size,
            opacity: i <= filled ? 1 : 0.28,
          }}
        />
      ))}
    </span>
  );
}

export function StorefrontView({
  data,
  reviews = EMPTY_REVIEWS,
}: {
  data: Storefront;
  reviews?: TutorReviews;
}) {
  const { t, locale } = useLocale();
  const c = copy[locale === "ar" ? "ar" : "fr"];
  const { tutor, classes, packs } = data;

  /* A newly-verified tutor can have ZERO published classes. In that state there is
     nothing to book, so `firstClass` is undefined and EVERY booking CTA must be
     suppressed: /checkout with no `class` param is a dead end (it cannot resolve a
     class, a price or a seat). We show an honest empty state and point the student
     at /explore instead of handing them a broken checkout. */
  const firstClass = classes[0];
  const canBook = Boolean(firstClass);

  // The rating shown is the one backed by the reviews table — never a decorative 5 stars.
  const hasReviews = reviews.count > 0;
  const average = hasReviews ? reviews.average : 0;

  function localMonth(m: string) {
    if (locale === "ar") return monthAr[m] ?? m;
    return m;
  }

  return (
    <SiteShell>
      {/* ── Full-bleed zellige hero band ── */}
      <div className="zellige hero-blue" style={{ flexShrink: 0 }}>
        <div className="container">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 18,
              paddingTop: "clamp(28px,4vw,48px)",
              paddingBottom: "clamp(28px,4vw,56px)",
              flexWrap: "wrap",
            }}
          >
            {/* Tutor identity */}
            <div style={{ display: "flex", gap: 20, alignItems: "center", flex: 1, minWidth: 0 }}>
              <Avatar initials={tutor.avatar_initials} size={88} />
              <div style={{ minWidth: 0 }}>
                <h1
                  className="web-h2"
                  style={{
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                    letterSpacing: "-0.5px",
                  }}
                >
                  {tutor.full_name.split(" ")[0]}{" "}
                  {tutor.full_name.split(" ").slice(1).join(" ").slice(0, 2)}.
                  {tutor.verified && <Verified />}
                </h1>
                <div style={{ color: "#CFE0F3", fontSize: 15, marginTop: 5, fontWeight: 500 }}>
                  {tutor.subject}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 10,
                    fontSize: 13.5,
                    color: "#EAF2FB",
                    flexWrap: "wrap",
                  }}
                >
                  {hasReviews ? (
                    <>
                      <Stars filled={Math.round(average)} />
                      <b style={{ fontFamily: "var(--fd)" }}>{average.toFixed(1)}</b>
                      <span style={{ opacity: 0.85 }}>({c.reviewsCount(reviews.count)})</span>
                    </>
                  ) : (
                    /* No reviews yet → say so. Never a fake star score. */
                    <span
                      style={{
                        background: "rgba(255,255,255,.16)",
                        borderRadius: 999,
                        padding: "3px 10px",
                        fontWeight: 700,
                        fontSize: 12,
                      }}
                    >
                      {c.isNew}
                    </span>
                  )}

                  {tutor.students_count > 0 && (
                    <>
                      <span style={{ opacity: 0.6 }}>·</span>
                      <span>
                        {tutor.students_count.toLocaleString()} {c.students}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Share button */}
            <button
              className="iconbtn on-blue"
              aria-label={t.common.share}
              style={{ flexShrink: 0 }}
              onClick={() => {
                if (typeof navigator !== "undefined" && navigator.share) {
                  navigator.share({ title: tutor.full_name, url: window.location.href });
                }
              }}
            >
              <Share />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main content area ── */}
      <section className="web-section">
        <div className="container">
          {/*
            Two-column desktop layout:
            main (1fr) | aside (340px)
            Stacks to single column on mobile.
          */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "clamp(24px,3vw,40px)",
              alignItems: "start",
            }}
            // Responsive via a style tag — we add a data attr and use a <style> below
            data-sf-grid="true"
          >
            {/* ── MAIN column ── */}
            <div style={{ minWidth: 0 }}>
              {/* No "réservé 23 fois cette semaine" banner: that number was a
                  hardcoded string in lib/i18n.ts (t.storefront.bookedThisWeek),
                  rendered on EVERY storefront including a brand-new tutor with
                  zero bookings. The real, earned social proof is the rating +
                  students_count in the hero above — both computed from the
                  reviews/bookings tables. Don't reintroduce this without a
                  real per-tutor "booked this week" count. */}

              {/* Bio */}
              <p
                className="web-lead"
                style={{ marginBottom: 32, lineHeight: 1.7 }}
              >
                {tutor.bio}
              </p>

              {/* ── Classes section ── */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <h2
                  style={{
                    fontFamily: "var(--fd)",
                    fontSize: "clamp(16px,2vw,20px)",
                    letterSpacing: "-0.3px",
                  }}
                >
                  {t.storefront.live}
                </h2>
                {/* Every published class is already listed below — no dead "see all" link. */}
                {classes.length > 0 && (
                  <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600, flexShrink: 0 }}>
                    {classes.length}
                  </span>
                )}
              </div>

              {!canBook ? (
                /* Honest empty state — no phantom card, no CTA to a class that
                   does not exist. */
                <div
                  className="card card-pad"
                  style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 36 }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 999,
                      background: "var(--sand)",
                      color: "var(--ink2)",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Clock style={{ width: 20, height: 20 }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h4 style={{ fontSize: 14.5, marginBottom: 5 }}>{c.noClassesTitle}</h4>
                    <p
                      style={{
                        fontSize: 13,
                        color: "var(--muted)",
                        lineHeight: 1.6,
                        margin: "0 0 12px",
                      }}
                    >
                      {c.noClassesBody}
                    </p>
                    <Link href="/explore" style={{ display: "inline-block" }}>
                      <Button variant="ghost" sm>
                        {c.noClassesCta}
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
              <div className="grid-auto" style={{ marginBottom: 36 }}>
                {classes.map((cls) => (
                  <Link key={cls.id} href={`/class/${cls.id}`} style={{ display: "block" }}>
                    <div
                      className="card card-pad"
                      style={{
                        display: "flex",
                        gap: 14,
                        alignItems: "center",
                        cursor: "pointer",
                        transition: "box-shadow .15s",
                      }}
                    >
                      {/* Date thumb */}
                      <div className="thumb" style={{ background: "var(--blue50)" }}>
                        <b style={{ color: "var(--blue)", fontSize: 21 }}>{cls.day}</b>
                        <span>{localMonth(cls.month)}</span>
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{ fontSize: 14.5, marginBottom: 6, lineHeight: 1.35 }}>{cls.title}</h4>
                        <div className="metaline">
                          <span>
                            <Clock />
                            {cls.time} · {cls.duration_min} {t.common.min}
                          </span>
                          <span>
                            <Users />
                            {t.common.seats(cls.seats_left)}
                          </span>
                        </div>
                      </div>

                      {/* Price / chip */}
                      <div
                        style={{
                          textAlign: "end",
                          flexShrink: 0,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          gap: 6,
                        }}
                      >
                        {cls.is_free_first && (
                          <Chip kind="free">{t.common.free1st}</Chip>
                        )}
                        <div className="price">
                          {cls.price_tnd} {t.common.tnd}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              )}

              {/* ── Packs section — only when the tutor actually has packs.
                   An empty <h2> over an empty grid is the same blank-section bug
                   as the classes list. ── */}
              {packs.length > 0 && (
                <>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      marginBottom: 16,
                    }}
                  >
                    <h2
                      style={{
                        fontFamily: "var(--fd)",
                        fontSize: "clamp(16px,2vw,20px)",
                        letterSpacing: "-0.3px",
                      }}
                    >
                      {t.storefront.packs}
                    </h2>
                  </div>

                  <div className="grid-2">
                    {packs.map((pack) => (
                      <div
                        key={pack.id}
                        className="card card-pad"
                        style={{ display: "flex", gap: 14, alignItems: "center" }}
                      >
                        {/* Play icon thumb */}
                        <div
                          style={{
                            width: 52,
                            height: 58,
                            borderRadius: 13,
                            background: "var(--green50)",
                            color: "var(--green)",
                            display: "grid",
                            placeItems: "center",
                            flexShrink: 0,
                          }}
                        >
                          <Play />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{ fontSize: 14, marginBottom: 5, lineHeight: 1.35 }}>{pack.title}</h4>
                          <div className="metaline">
                            <span>{pack.meta}</span>
                          </div>
                        </div>

                        <div style={{ textAlign: "end", flexShrink: 0 }}>
                          <div className="price">
                            {pack.price_tnd} {t.common.tnd}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ── Reviews section — real rows from getTutorReviews(slug) ── */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  marginTop: 36,
                  marginBottom: 16,
                }}
              >
                <h2
                  style={{
                    fontFamily: "var(--fd)",
                    fontSize: "clamp(16px,2vw,20px)",
                    letterSpacing: "-0.3px",
                  }}
                >
                  {c.reviewsTitle}
                </h2>
                {hasReviews && (
                  <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600, flexShrink: 0 }}>
                    {c.reviewsCount(reviews.count)}
                  </span>
                )}
              </div>

              {!hasReviews ? (
                /* Honest empty state — no stars, no invented score. */
                <div
                  className="card card-pad"
                  style={{ display: "flex", gap: 14, alignItems: "flex-start" }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 999,
                      background: "var(--blue50)",
                      color: "var(--blue)",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Star style={{ width: 20, height: 20 }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h4 style={{ fontSize: 14.5, marginBottom: 5 }}>{c.noReviewsTitle}</h4>
                    <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
                      {c.noReviewsBody}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Average summary */}
                  <div
                    className="card card-pad"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      marginBottom: 14,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--fd)",
                        fontSize: 34,
                        fontWeight: 700,
                        letterSpacing: "-1px",
                        color: "var(--ink)",
                        lineHeight: 1,
                      }}
                    >
                      {average.toFixed(1)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <Stars filled={Math.round(average)} size={15} />
                      <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>
                        {c.reviewsCount(reviews.count)}
                      </div>
                    </div>
                  </div>

                  {/* Review list */}
                  <div style={{ display: "grid", gap: 12 }}>
                    {reviews.items.map((r) => (
                      <div key={r.id} className="card card-pad">
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            marginBottom: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                            <Avatar initials={initialsOf(r.studentName) || "?"} size={34} square />
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontWeight: 700,
                                  fontSize: 13.5,
                                  color: "var(--ink)",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {r.studentName ?? c.anon}
                              </div>
                              <Stars filled={r.rating} size={12} />
                            </div>
                          </div>
                          <time
                            dateTime={r.createdAt}
                            style={{ fontSize: 11.5, color: "var(--muted)", flexShrink: 0 }}
                          >
                            {fmtDate(r.createdAt)}
                          </time>
                        </div>

                        {r.text && (
                          <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--ink2)", margin: 0 }}>
                            {r.text}
                          </p>
                        )}
                        {r.classTitle && (
                          <div className="metaline" style={{ marginTop: 8 }}>
                            <span>{r.classTitle}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* ── ASIDE (desktop sticky booking panel) ── */}
            <aside
              style={{ position: "sticky", top: 84 }}
              data-sf-aside="true"
            >
              <div className="panel panel-pad">
                {/* No published class → nothing to book. Say so, and send the
                    student somewhere that works. NEVER a /checkout link without a
                    class id: it resolves no class, no price, no seat.
                    Branch on `firstClass` (not `canBook`) so TS narrows it to a
                    defined ClassItem inside the bookable branch. */}
                {!firstClass ? (
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 999,
                        background: "var(--sand)",
                        color: "var(--ink2)",
                        display: "grid",
                        placeItems: "center",
                        margin: "0 auto 12px",
                      }}
                    >
                      <Clock style={{ width: 20, height: 20 }} />
                    </div>
                    <h4 style={{ fontSize: 14.5, marginBottom: 6 }}>{c.noClassesTitle}</h4>
                    <p
                      style={{
                        fontSize: 13,
                        color: "var(--muted)",
                        lineHeight: 1.6,
                        margin: "0 0 16px",
                      }}
                    >
                      {c.noClassesBody}
                    </p>
                    <Link href="/explore" style={{ display: "block" }}>
                      <Button variant="ghost">{c.noClassesCta}</Button>
                    </Link>
                  </div>
                ) : (
                <>
                {/* Free-first badge */}
                {firstClass?.is_free_first && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      marginBottom: 16,
                    }}
                  >
                    <Chip kind="free">{t.common.free1st}</Chip>
                  </div>
                )}

                {/* Price headline */}
                {firstClass && (
                  <div style={{ textAlign: "center", marginBottom: 20 }}>
                    <div
                      style={{
                        fontFamily: "var(--fd)",
                        fontSize: 13,
                        color: "var(--muted)",
                        marginBottom: 4,
                        textTransform: "uppercase",
                        letterSpacing: ".5px",
                      }}
                    >
                      {t.storefront.live}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--fd)",
                        fontSize: 28,
                        fontWeight: 700,
                        letterSpacing: "-0.8px",
                        color: "var(--ink)",
                      }}
                    >
                      {firstClass.price_tnd}{" "}
                      <span style={{ fontSize: 16, fontWeight: 600, color: "var(--muted)" }}>
                        {t.common.tnd}
                      </span>
                    </div>
                    <div className="metaline" style={{ justifyContent: "center", marginTop: 8 }}>
                      <span>
                        <Clock />
                        {firstClass.time} · {firstClass.duration_min} {t.common.min}
                      </span>
                      <span>
                        <Users />
                        {t.common.seats(firstClass.seats_left)}
                      </span>
                    </div>
                  </div>
                )}

                {/* CTA — only reachable when firstClass exists (see canBook). */}
                <Link
                  href={`/checkout?class=${firstClass.id}`}
                  style={{ display: "block" }}
                >
                  <Button variant="primary">{t.storefront.cta}</Button>
                </Link>

                {/* Secure note */}
                <div
                  className="trust"
                  style={{ marginTop: 14 }}
                >
                  <Lock />
                  <p>{t.common.secure}</p>
                </div>
                </>
                )}
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Mobile sticky CTA — visible on small screens only.
          Suppressed entirely when the tutor has no published class: a sticky bar
          that can only lead to a broken /checkout is worse than no bar at all.
          The in-page empty state above already offers /explore. */}
      {firstClass && (
        <div
          className="hide-desktop"
          style={{
            position: "sticky",
            bottom: 0,
            background: "linear-gradient(transparent, var(--cream) 28%)",
            padding: "14px 18px 18px",
            zIndex: 20,
          }}
        >
          <Link href={`/checkout?class=${firstClass.id}`} style={{ display: "block" }}>
            <Button variant="primary">{t.storefront.cta}</Button>
          </Link>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 7,
              marginTop: 10,
              color: "var(--muted)",
              fontSize: 11.5,
            }}
          >
            <Lock style={{ width: 14, height: 14, color: "var(--green)" }} />
            <span>{t.common.secure}</span>
          </div>
        </div>
      )}

      {/* Responsive grid: inject a scoped style so two-column kicks in at 960px */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (min-width: 960px) {
          [data-sf-grid="true"] {
            grid-template-columns: 1fr 340px;
          }
          [data-sf-aside="true"] {
            display: block;
          }
        }
        @media (max-width: 959px) {
          [data-sf-aside="true"] {
            display: none;
          }
        }
      `}} />
    </SiteShell>
  );
}
