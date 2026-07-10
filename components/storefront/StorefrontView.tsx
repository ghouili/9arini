"use client";
import Link from "next/link";
import { Avatar, Chip, Verified, Button } from "@/components/ui";
import {
  Share,
  Star,
  Clock,
  Users,
  Bolt,
  Lock,
  Play,
} from "@/components/icons";
import { useLocale } from "@/components/LocaleProvider";
import { SiteShell } from "@/components/SiteShell";
import type { Storefront } from "@/lib/types";

/** Month label map FR → AR (short). Demo data uses FR short labels. */
const monthAr: Record<string, string> = {
  JANV: "جانفي", FÉVR: "فيفري", MARS: "مارس", AVR: "أفريل",
  MAI: "ماي", JUIN: "جوان", JUIL: "جويل", AOÛT: "أوت",
  SEPT: "سبتمبر", OCT: "أكتوبر", NOV: "نوفمبر", DÉC: "ديسمبر",
};

export function StorefrontView({ data }: { data: Storefront }) {
  const { t, locale } = useLocale();
  const { tutor, classes, packs } = data;
  const firstClass = classes[0];

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
                  <span className="stars">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} />
                    ))}
                  </span>
                  <b style={{ fontFamily: "var(--fd)" }}>{tutor.rating}</b>
                  <span style={{ opacity: 0.6 }}>·</span>
                  <span>
                    {tutor.students_count.toLocaleString()}{" "}
                    {locale === "ar" ? "تلميذ" : "élèves"}{/* TODO i18n — students label */}
                  </span>
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
              {/* Social proof banner */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  background: "var(--green50)",
                  color: "#13724f",
                  borderRadius: 14,
                  padding: "11px 15px",
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 22,
                }}
              >
                <Bolt style={{ width: 17, height: 17, flexShrink: 0 }} />
                <span>{t.storefront.bookedThisWeek}</span>
              </div>

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
                <a
                  style={{
                    color: "var(--blue)",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  {t.common.seeAll}
                </a>
              </div>

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

              {/* ── Packs section ── */}
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
            </div>

            {/* ── ASIDE (desktop sticky booking panel) ── */}
            <aside
              style={{ position: "sticky", top: 84 }}
              data-sf-aside="true"
            >
              <div className="panel panel-pad">
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

                {/* CTA */}
                <Link
                  href={firstClass ? `/checkout?class=${firstClass.id}` : "/checkout"}
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
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Mobile sticky CTA — visible on small screens only */}
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
        <Link
          href={firstClass ? `/checkout?class=${firstClass.id}` : "/checkout"}
          style={{ display: "block" }}
        >
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
