"use client";
import { useState, useEffect, type CSSProperties } from "react";
import { Link } from "@/components/Link";
import { Chip, Spinner } from "@/components/ui";
import { SiteShell } from "@/components/SiteShell";
import { Calendar, Clock, Users, Shield } from "@/components/icons";
import { useLocale } from "@/components/LocaleProvider";
import { getClass, getExploreTutors } from "@/app/actions";
import type { ClassItem, ExploreTutor } from "@/lib/types";

/* Page-local copy (lib/i18n.ts is shared). t.common.secure promises
   "Paiement sécurisé · Flouci & D17" — there is no payment rail in the pilot,
   so this page states what is actually true: free first session + 24h cancellation. */
const copy = {
  fr: { reassure: "1ère séance gratuite · annulation gratuite jusqu'à 24h avant" },
  ar: { reassure: "الحصة الأولى مجانية · إلغاء مجاني حتى 24 ساعة قبل" },
} as const;

export default function ClassDetailPage({ params }: { params: { id: string } }) {
  const { t, locale } = useLocale();
  const c = copy[locale];
  const [cls, setCls] = useState<ClassItem | null | undefined>(undefined);
  // The tutor behind this class (real slug + real subject/level — no hardcoded
  // "/yassine-math" back-link, no hardcoded "Prof · Bac"). Null when we can't
  // resolve them (demo mode / unverified tutor) → we simply show less.
  const [tutor, setTutor] = useState<ExploreTutor | null>(null);

  useEffect(() => { getClass(params.id).then(setCls).catch(() => setCls(null)); }, [params.id]);

  const tutorNameFromClass = cls?.tutor_name;
  useEffect(() => {
    if (!tutorNameFromClass) { setTutor(null); return; }
    getExploreTutors({ q: tutorNameFromClass })
      .then((rows) => setTutor(rows?.find((r) => r.full_name === tutorNameFromClass) ?? null))
      .catch(() => setTutor(null));
  }, [tutorNameFromClass]);

  if (cls === undefined) {
    return (
      <SiteShell>
        <section className="web-section tight">
          <div className="container" style={{ display: "grid", placeItems: "center", minHeight: 240 }}>
            <Spinner />
          </div>
        </section>
      </SiteShell>
    );
  }
  if (cls === null) {
    return (
      <SiteShell>
        <section className="web-section tight">
          <div className="container" style={{ textAlign: "center", padding: "clamp(28px,6vw,60px)" }}>
            <h1 className="web-h2" style={{ marginBottom: 12 }}>{t.extra.noResults}</h1>
            <Link href="/explore" className="btn btn-primary" style={{ maxWidth: 240, marginInline: "auto" }}>{t.nav.explore}</Link>
          </div>
        </section>
      </SiteShell>
    );
  }

  const tutorName = cls.tutor_name ?? "—";
  const tutorInits = tutorName.split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  // Back to the tutor's real storefront when we know it, else to the catalogue.
  const backHref = tutor?.slug ? `/${tutor.slug}` : "/explore";
  // Real subject/level from the tutor row — shown only when we actually have it.
  const tutorMeta = tutor
    ? [tutor.subject, tutor.level && !tutor.subject.includes(tutor.level) ? tutor.level : ""]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <SiteShell>
      <section className="web-section tight">
        <div className="container">

          {/* Back breadcrumb */}
          <div style={{ marginBottom: 22 }}>
            <Link
              href={backHref}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: "var(--muted)",
                fontSize: 13.5,
                fontWeight: 600,
              }}
            >
              <svg viewBox="0 0 24 24" className="ic flip" style={{ width: 16, height: 16 }} aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              {t.common.back}
            </Link>
          </div>

          {/* Eyebrow + title */}
          <div style={{ marginBottom: 32 }}>
            <p className="web-eyebrow" style={{ marginBottom: 8 }}>{t.classDetail.book}</p>
            <h1 className="web-h2" style={{ marginBottom: 6 }}>{cls.title}</h1>
            <p style={{ color: "var(--muted)", fontSize: 15 }}>
              {t.classDetail.with} {tutorName}
            </p>
          </div>

          {/* ── Two-column grid ── */}
          <div className="cd-grid">

            {/* LEFT col — class meta */}
            <div>

              {/* When / duration / seats */}
              <div className="card card-pad" style={{ marginBottom: 16 }}>
                <div className="row" style={{ marginBottom: 16 }}>
                  <div className="thumb" style={{ background: "var(--blue)", color: "#fff" }}>
                    <b>{cls.day}</b>
                    <span>{cls.month}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        color: "var(--muted)",
                        marginBottom: 7,
                      }}
                    >
                      {t.classDetail.when}
                    </div>
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
                </div>

                <div className="divider" />

                {/* Description */}
                {cls.description && (
                  <>
                    <div style={{ marginTop: 16, marginBottom: 8 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                          color: "var(--muted)",
                        }}
                      >
                        {t.classDetail.about}
                      </span>
                    </div>
                    <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--ink2)" }}>
                      {cls.description}
                    </p>
                    <div className="divider" style={{ marginTop: 16 }} />
                  </>
                )}

                {/* Price row */}
                <div className="between" style={{ marginTop: 16 }}>
                  <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>
                    {t.classDetail.price}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {cls.is_free_first && <Chip kind="free">{t.common.free1st}</Chip>}
                    <span className="price" style={{ fontSize: 19 }}>
                      {cls.price_tnd} {t.common.tnd}
                    </span>
                  </div>
                </div>

                {/* Free-first callout */}
                {cls.is_free_first && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: "11px 13px",
                      background: "var(--green50)",
                      borderRadius: 13,
                      fontSize: 13,
                      color: "#13724f",
                      lineHeight: 1.55,
                      display: "flex",
                      gap: 9,
                      alignItems: "flex-start",
                    }}
                  >
                    <Calendar style={{ color: "var(--green)", flex: "none", marginTop: 1 } as CSSProperties} />
                    {t.classDetail.freeFirst}
                  </div>
                )}
              </div>

              {/* Tutor card */}
              <div className="card card-pad" style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 15,
                    background: "linear-gradient(150deg,var(--amber),var(--ochre))",
                    display: "grid",
                    placeItems: "center",
                    fontFamily: "var(--fd)",
                    fontSize: 20,
                    color: "#fff",
                    fontWeight: 700,
                    flex: "none",
                  }}
                >
                  {tutorInits}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>
                    {tutor?.slug ? (
                      <Link href={`/${tutor.slug}`} style={{ color: "inherit" }}>{tutorName}</Link>
                    ) : (
                      tutorName
                    )}
                  </div>
                  {tutorMeta && (
                    <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
                      {tutorMeta}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT col — sticky booking panel */}
            <div className="cd-panel-col">
              <div className="panel panel-pad" style={{ position: "sticky", top: 84 }}>

                {/* Free chip */}
                {cls.is_free_first && (
                  <div style={{ marginBottom: 14 }}>
                    <Chip kind="free">{t.common.free1st}</Chip>
                  </div>
                )}

                {/* Mini summary */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontWeight: 700, fontSize: 15.5, marginBottom: 6, lineHeight: 1.3 }}>
                    {cls.title}
                  </div>
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

                <div className="divider" style={{ marginBottom: 18 }} />

                {/* Price */}
                <div className="between" style={{ marginBottom: 20 }}>
                  <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>
                    {t.classDetail.price}
                  </span>
                  <span className="price" style={{ fontSize: 20 }}>
                    {cls.price_tnd} {t.common.tnd}
                  </span>
                </div>

                {/* Book CTA */}
                <Link href={`/checkout?class=${cls.id}`} style={{ display: "block" }}>
                  <button className="btn btn-primary" style={{ minHeight: 52 }}>
                    {t.classDetail.book}
                  </button>
                </Link>

                {/* Trust micro-copy */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 7,
                    marginTop: 11,
                    color: "var(--muted)",
                    fontSize: 11.5,
                    alignItems: "center",
                  }}
                >
                  <Shield style={{ width: 13, height: 13, color: "var(--green)" } as CSSProperties} />
                  <span>{c.reassure}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile-only sticky bottom CTA */}
          <div className="cd-mobile-cta barbtn">
            <Link href={`/checkout?class=${cls.id}`} style={{ display: "block" }}>
              <button className="btn btn-primary" style={{ minHeight: 52 }}>
                {t.classDetail.book}
              </button>
            </Link>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 7,
                marginTop: 10,
                color: "var(--muted)",
                fontSize: 11.5,
                alignItems: "center",
              }}
            >
              <Shield style={{ width: 13, height: 13, color: "var(--green)" } as CSSProperties} />
              <span>{c.reassure}</span>
            </div>
          </div>

        </div>
      </section>

      <style dangerouslySetInnerHTML={{ __html: `
        /* ── class detail grid ── */
        .cd-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: clamp(16px, 2.4vw, 28px);
          align-items: start;
        }
        /* on tablet/desktop: two columns, panel right */
        @media (min-width: 760px) {
          .cd-grid {
            grid-template-columns: 1fr 340px;
          }
          /* hide mobile sticky CTA — panel handles it */
          .cd-mobile-cta {
            display: none !important;
          }
        }
        /* on mobile: hide the desktop panel column */
        @media (max-width: 759px) {
          .cd-panel-col {
            display: none !important;
          }
        }
        /* 360px safety: all children full-width */
        @media (max-width: 400px) {
          .cd-grid > * {
            min-width: 0;
            max-width: 100%;
          }
        }
      `}} />
    </SiteShell>
  );
}
