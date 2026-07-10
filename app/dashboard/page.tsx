"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button, Spinner } from "@/components/ui";
import { useLocale } from "@/components/LocaleProvider";
import { Gear, Bell, Wallet, Trend, Share, Copy, Video, Play, Plus, Bulb, User, Home, Users, Eye, Book, Shield, Check } from "@/components/icons";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { SiteShell } from "@/components/SiteShell";
import { getDashboard } from "@/app/actions";
import { demoTutorStatsEarning } from "@/lib/demo";
import type { ActivityItem, DashboardData } from "@/lib/types";

// ── Activity icon by kind ──────────────────────────────────────────────────
function ActivityIcon({ kind }: { kind: ActivityItem["kind"] }) {
  const base: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  };
  if (kind === "class")
    return (
      <div style={{ ...base, background: "var(--blue50)", color: "var(--blue)" }}>
        <Video />
      </div>
    );
  if (kind === "pack")
    return (
      <div style={{ ...base, background: "var(--green50)", color: "var(--green)" }}>
        <Play />
      </div>
    );
  // payout
  return (
    <div style={{ ...base, background: "var(--sand)", color: "var(--ochre)" }}>
      <Wallet />
    </div>
  );
}

// ── Earning dashboard ──────────────────────────────────────────────────────
function EarningView() {
  const { t } = useLocale();
  const stats = demoTutorStatsEarning;

  return (
    <>
      {/* Top row: balance + sparkline panel alongside 3-stat panel */}
      <div className="grid-2" style={{ marginBottom: "clamp(14px,2vw,22px)" }}>
        {/* Balance + sparkline panel */}
        <div
          className="balance zellige hero-blue panel"
          style={{ borderRadius: "var(--r-l)", padding: "clamp(18px,2.4vw,26px)", border: "none" }}
        >
          <div className="lbl">
            <Wallet />
            {t.dashboard.balance}
          </div>
          <div className="amt">
            1&nbsp;240<small> TND</small>
          </div>
          <Sparkline data={stats.spark} />
          {/* Trend pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 4,
              background: "rgba(243,194,75,.2)",
              padding: "10px 12px",
              borderRadius: 12,
              fontSize: 12.5,
              color: "#EAF2FC",
              position: "relative",
              zIndex: 2,
            }}
          >
            <Trend />
            {t.dashboard.trend(stats.trend_pct)}
          </div>
        </div>

        {/* Stats panel */}
        <div className="panel panel-pad" style={{ display: "flex", flexDirection: "column", gap: "clamp(10px,1.5vw,18px)" }}>
          <div
            style={{
              fontFamily: "var(--fd)",
              fontSize: 13,
              fontWeight: 700,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: ".5px",
              marginBottom: 4,
            }}
          >
            {t.dashboard.recent}
          </div>
          {[
            { value: stats.students, label: t.dashboard.stStudents, color: "var(--blue)" },
            { value: stats.sessions, label: t.dashboard.stSessions, color: "var(--ink)" },
            { value: stats.rating, label: t.dashboard.stRating, color: "var(--amber)" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                background: "var(--cream)",
                borderRadius: 13,
                border: "1px solid var(--line)",
              }}
            >
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink2)" }}>{s.label}</span>
              <b style={{ fontFamily: "var(--fd)", fontSize: 22, color: s.color }}>{s.value}</b>
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity wide panel */}
      <div className="panel panel-pad" style={{ marginBottom: "clamp(14px,2vw,22px)" }}>
        <div
          style={{
            fontFamily: "var(--fd)",
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{t.dashboard.recent}</span>
        </div>
        {stats.recent.map((item) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              padding: "13px 0",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <ActivityIcon kind={item.kind} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {item.title}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{item.sub}</div>
            </div>
            <span
              style={{
                fontFamily: "var(--fd)",
                fontWeight: 700,
                color: "var(--green)",
                flexShrink: 0,
                marginInlineStart: "auto",
              }}
            >
              +{item.amount_tnd}
            </span>
          </div>
        ))}
      </div>

      {/* Cash-out CTA */}
      <div style={{ marginBottom: "clamp(14px,2vw,22px)" }}>
        <Link href="/dashboard/payout">
          <Button variant="green">
            <Wallet />
            {t.dashboard.cashout}
          </Button>
        </Link>
      </div>

      {/* Mobile-only quick-action buttons (sidebar links replace these on desktop) */}
      <div className="hide-desktop" style={{ display: "flex", gap: 10 }}>
        <Link href="/dashboard/new-class" style={{ flex: 1 }}>
          <Button variant="ghost">
            <Plus />
            {t.dashboard.newClass}
          </Button>
        </Link>
        <Link href="/dashboard/new-pack" style={{ flex: 1 }}>
          <Button variant="ghost">
            <Plus />
            {t.dashboard.newPack}
          </Button>
        </Link>
      </div>
    </>
  );
}

// ── Empty dashboard ────────────────────────────────────────────────────────
function EmptyView() {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  const shareUrl = "9arini.tn/yassine-math";

  function handleCopy() {
    navigator.clipboard.writeText(`https://${shareUrl}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const steps = [
    { num: 1, title: t.dashboard.s1t, body: t.dashboard.s1p },
    { num: 2, title: t.dashboard.s2t, body: t.dashboard.s2p },
    { num: 3, title: t.dashboard.s3t, body: t.dashboard.s3p },
  ];

  return (
    <>
      {/* Zero-balance card — full width on mobile, spans both cols on desktop */}
      <div
        className="balance zellige hero-blue panel"
        style={{
          borderRadius: "var(--r-l)",
          padding: "clamp(18px,2.4vw,26px)",
          border: "none",
          marginBottom: "clamp(14px,2vw,22px)",
        }}
      >
        <div className="lbl">
          <Wallet />
          {t.dashboard.balance}
        </div>
        <div className="amt">
          0<small> TND</small>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 15,
            background: "rgba(255,255,255,.13)",
            padding: "10px 12px",
            borderRadius: 12,
            fontSize: 12.5,
            color: "#EAF2FC",
            position: "relative",
            zIndex: 2,
          }}
        >
          <span style={{ display: "inline-flex", color: "#F3C24B", flexShrink: 0 }}>
            <Bulb style={{ width: 16, height: 16 }} />
          </span>
          {t.dashboard.emptyNote}
        </div>
      </div>

      {/* Share card + How it works — side by side on desktop */}
      <div className="grid-2" style={{ marginBottom: "clamp(14px,2vw,22px)" }}>
        {/* Share card panel */}
        <div className="panel panel-pad" style={{ textAlign: "center" }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 18,
              background: "var(--blue50)",
              color: "var(--blue)",
              display: "grid",
              placeItems: "center",
              margin: "0 auto 13px",
            }}
          >
            <Share />
          </div>
          <h3 style={{ fontFamily: "var(--fd)", fontSize: 17, marginBottom: 7 }}>
            {t.dashboard.shareTitle}
          </h3>
          <p style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6, marginBottom: 16 }}>
            {t.dashboard.shareBody}
          </p>

          {/* Link box */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--sand)",
              border: "1.4px dashed var(--blue)",
              borderRadius: 13,
              padding: "11px 13px",
              marginBottom: 13,
            }}
          >
            <span style={{ color: "var(--blue)", flexShrink: 0, display: "flex" }}>
              <Share />
            </span>
            <span
              style={{
                fontFamily: "var(--fd)",
                fontSize: 13,
                color: "var(--blue)",
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                flex: 1,
              }}
            >
              {shareUrl}
            </span>
            <button
              onClick={handleCopy}
              style={{
                marginInlineStart: "auto",
                background: copied ? "var(--green)" : "var(--blue)",
                color: "#fff",
                border: 0,
                padding: "8px 13px",
                borderRadius: 9,
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
                flexShrink: 0,
                fontFamily: "var(--fb)",
                transition: "background .2s",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {copied ? (
                t.common.copied
              ) : (
                <>
                  <Copy />
                  {t.common.copy}
                </>
              )}
            </button>
          </div>

          <Button variant="primary">
            <Share />
            {t.dashboard.shareBtn}
          </Button>
        </div>

        {/* How it works panel */}
        <div className="panel panel-pad">
          <div
            style={{
              fontFamily: "var(--fd)",
              fontSize: 16,
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            {t.dashboard.how}
          </div>
          {steps.map((s) => (
            <div
              key={s.num}
              style={{
                display: "flex",
                gap: 13,
                alignItems: "flex-start",
                padding: "13px 0",
                borderBottom: s.num < 3 ? "1px solid var(--line)" : "none",
              }}
            >
              <div
                style={{
                  width: 27,
                  height: 27,
                  borderRadius: 9,
                  background: "var(--ink)",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "var(--fd)",
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                {s.num}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{s.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create first class / pack CTAs */}
      <div style={{ display: "flex", gap: 10 }}>
        <Link href="/dashboard/new-class" style={{ flex: 1 }}>
          <Button variant="ghost">
            <Plus />
            {t.dashboard.newClass}
          </Button>
        </Link>
        <Link href="/dashboard/new-pack" style={{ flex: 1 }}>
          <Button variant="ghost">
            <Plus />
            {t.dashboard.newPack}
          </Button>
        </Link>
      </div>
    </>
  );
}

// ── Segmented toggle ───────────────────────────────────────────────────────
type Mode = "earning" | "empty";

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const { t } = useLocale();
  const segments: { value: Mode; label: string }[] = [
    { value: "earning", label: t.extra.modeEarning },
    { value: "empty", label: t.extra.modeEmpty },
  ];
  return (
    <div
      role="group"
      aria-label={t.extra.demoPreview}
      title={t.extra.demoPreview}
      style={{
        display: "flex",
        background: "var(--sand)",
        borderRadius: 10,
        padding: 3,
        gap: 3,
      }}
    >
      {segments.map((s) => (
        <button
          key={s.value}
          type="button"
          aria-pressed={mode === s.value}
          onClick={() => onChange(s.value)}
          style={{
            flex: 1,
            border: 0,
            borderRadius: 8,
            padding: "6px 14px",
            fontSize: 12.5,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "var(--fb)",
            background: mode === s.value ? "var(--paper)" : "transparent",
            color: mode === s.value ? "var(--ink)" : "var(--muted)",
            boxShadow: mode === s.value ? "var(--sh-s)" : "none",
            transition: ".15s",
            whiteSpace: "nowrap",
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

// ── Shared: 3-step "how it works" panel ─────────────────────────────────────
function HowItWorks() {
  const { t } = useLocale();
  const steps = [
    { num: 1, title: t.dashboard.s1t, body: t.dashboard.s1p },
    { num: 2, title: t.dashboard.s2t, body: t.dashboard.s2p },
    { num: 3, title: t.dashboard.s3t, body: t.dashboard.s3p },
  ];
  return (
    <div className="panel panel-pad">
      <div style={{ fontFamily: "var(--fd)", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{t.dashboard.how}</div>
      {steps.map((s) => (
        <div
          key={s.num}
          style={{
            display: "flex",
            gap: 13,
            alignItems: "flex-start",
            padding: "13px 0",
            borderBottom: s.num < 3 ? "1px solid var(--line)" : "none",
          }}
        >
          <div
            style={{
              width: 27, height: 27, borderRadius: 9, background: "var(--ink)", color: "#fff",
              display: "grid", placeItems: "center", fontFamily: "var(--fd)", fontSize: 13, flexShrink: 0,
            }}
          >
            {s.num}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{s.title}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{s.body}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Shared: copyable storefront link box (real slug) ────────────────────────
function StoreLinkBox({ slug }: { slug: string }) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  const url = `9arini.tn/${slug}`;
  function handleCopy() {
    navigator.clipboard.writeText(`https://${url}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 8, background: "var(--sand)",
        border: "1.4px dashed var(--blue)", borderRadius: 13, padding: "11px 13px",
      }}
    >
      <span style={{ color: "var(--blue)", flexShrink: 0, display: "flex" }}>
        <Share />
      </span>
      <span
        style={{
          fontFamily: "var(--fd)", fontSize: 13, color: "var(--blue)",
          overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", flex: 1,
        }}
      >
        {url}
      </span>
      <button
        onClick={handleCopy}
        style={{
          marginInlineStart: "auto", background: copied ? "var(--green)" : "var(--blue)", color: "#fff",
          border: 0, padding: "8px 13px", borderRadius: 9, fontWeight: 700, fontSize: 12, cursor: "pointer",
          flexShrink: 0, fontFamily: "var(--fb)", transition: "background .2s", display: "flex", alignItems: "center", gap: 5,
        }}
      >
        {copied ? t.common.copied : (<><Copy />{t.common.copy}</>)}
      </button>
    </div>
  );
}

// ── Real: tutor with at least one class (or earnings) ───────────────────────
function RealEarning({ d }: { d: DashboardData }) {
  const { t } = useLocale();
  const stats = [
    { value: d.students, label: t.dashboard.stStudents, color: "var(--blue)" },
    { value: d.sessions, label: t.dashboard.stSessions, color: "var(--ink)" },
    { value: d.rating > 0 ? d.rating : "—", label: t.dashboard.stRating, color: "var(--amber)" },
  ];
  return (
    <>
      {/* Balance + stats */}
      <div className="grid-2" style={{ marginBottom: "clamp(14px,2vw,22px)" }}>
        <div className="balance zellige hero-blue panel" style={{ borderRadius: "var(--r-l)", padding: "clamp(18px,2.4vw,26px)", border: "none" }}>
          <div className="lbl">
            <Wallet />
            {t.dashboard.balance}
          </div>
          <div className="amt">
            {d.balance_tnd.toLocaleString("fr-FR")}<small> TND</small>
          </div>
          <div
            style={{
              display: "flex", alignItems: "center", gap: 8, marginTop: 15, background: "rgba(255,255,255,.13)",
              padding: "10px 12px", borderRadius: 12, fontSize: 12.5, color: "#EAF2FC", position: "relative", zIndex: 2,
            }}
          >
            <span style={{ display: "inline-flex", color: "#F3C24B", flexShrink: 0 }}>
              <Bulb style={{ width: 16, height: 16 }} />
            </span>
            {t.dashboard.emptyNote}
          </div>
        </div>

        <div className="panel panel-pad" style={{ display: "flex", flexDirection: "column", gap: "clamp(10px,1.5vw,18px)" }}>
          <div style={{ fontFamily: "var(--fd)", fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>
            {t.dashboard.recent}
          </div>
          {stats.map((s) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "var(--cream)", borderRadius: 13, border: "1px solid var(--line)" }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink2)" }}>{s.label}</span>
              <b style={{ fontFamily: "var(--fd)", fontSize: 22, color: s.color }}>{s.value}</b>
            </div>
          ))}
        </div>
      </div>

      {/* My classes */}
      {d.classes.length > 0 && (
        <div className="panel panel-pad" style={{ marginBottom: "clamp(14px,2vw,22px)" }}>
          <div style={{ fontFamily: "var(--fd)", fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{t.dashboard.myClasses}</div>
          {d.classes.map((c) => (
            <Link
              key={c.id}
              href={`/class/${c.id}`}
              style={{ display: "flex", gap: 12, alignItems: "center", padding: "13px 0", borderBottom: "1px solid var(--line)", color: "inherit" }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", flexShrink: 0, background: "var(--blue50)", color: "var(--blue)" }}>
                <Video />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{c.day} {c.month} · {c.time}</div>
              </div>
              <div style={{ textAlign: "end", flexShrink: 0, marginInlineStart: "auto" }}>
                <div style={{ fontFamily: "var(--fd)", fontWeight: 700, color: "var(--ink)" }}>{c.price_tnd} TND</div>
                <div style={{ fontSize: 11, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", marginTop: 2 }}>
                  <Users style={{ width: 12, height: 12 }} />{c.seats_left}/{c.seats}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* My packs */}
      {d.packs.length > 0 && (
        <div className="panel panel-pad" style={{ marginBottom: "clamp(14px,2vw,22px)" }}>
          <div style={{ fontFamily: "var(--fd)", fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{t.dashboard.myPacks}</div>
          {d.packs.map((p) => (
            <div
              key={p.id}
              style={{ display: "flex", gap: 12, alignItems: "center", padding: "13px 0", borderBottom: "1px solid var(--line)" }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", flexShrink: 0, background: "var(--green50)", color: "var(--green)" }}>
                <Book />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</div>
                {p.meta && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{p.meta}</div>}
              </div>
              <div style={{ fontFamily: "var(--fd)", fontWeight: 700, color: "var(--ink)", flexShrink: 0, marginInlineStart: "auto" }}>{p.price_tnd} TND</div>
            </div>
          ))}
        </div>
      )}

      {/* Storefront link */}
      {d.slug && (
        <div className="panel panel-pad" style={{ marginBottom: "clamp(14px,2vw,22px)" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 10 }}>
            {t.dashboard.shareTitle}
          </div>
          <StoreLinkBox slug={d.slug} />
          <div style={{ marginTop: 12 }}>
            <Link href={`/${d.slug}`} className="btn btn-ink btn-sm">
              <Eye />
              {t.dashboard.viewStore}
            </Link>
          </div>
        </div>
      )}

      {/* Cash-out CTA */}
      <div style={{ marginBottom: "clamp(14px,2vw,22px)" }}>
        <Link href="/dashboard/payout">
          <Button variant="green">
            <Wallet />
            {t.dashboard.cashout}
          </Button>
        </Link>
      </div>

      {/* Create CTAs */}
      <div style={{ display: "flex", gap: 10 }}>
        <Link href="/dashboard/new-class" style={{ flex: 1 }}>
          <Button variant="ghost">
            <Plus />
            {t.dashboard.newClass}
          </Button>
        </Link>
        <Link href="/dashboard/new-pack" style={{ flex: 1 }}>
          <Button variant="ghost">
            <Plus />
            {t.dashboard.newPack}
          </Button>
        </Link>
      </div>
    </>
  );
}

// ── Real: tutor with a storefront but no classes yet ────────────────────────
function RealEmpty({ d }: { d: DashboardData }) {
  const { t } = useLocale();
  return (
    <>
      <div
        className="balance zellige hero-blue panel"
        style={{ borderRadius: "var(--r-l)", padding: "clamp(18px,2.4vw,26px)", border: "none", marginBottom: "clamp(14px,2vw,22px)" }}
      >
        <div className="lbl">
          <Wallet />
          {t.dashboard.balance}
        </div>
        <div className="amt">
          0<small> TND</small>
        </div>
        <div
          style={{
            display: "flex", alignItems: "center", gap: 8, marginTop: 15, background: "rgba(255,255,255,.13)",
            padding: "10px 12px", borderRadius: 12, fontSize: 12.5, color: "#EAF2FC", position: "relative", zIndex: 2,
          }}
        >
          <span style={{ display: "inline-flex", color: "#F3C24B", flexShrink: 0 }}>
            <Bulb style={{ width: 16, height: 16 }} />
          </span>
          {t.dashboard.emptyNote}
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: "clamp(14px,2vw,22px)" }}>
        <div className="panel panel-pad" style={{ textAlign: "center" }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: "var(--blue50)", color: "var(--blue)", display: "grid", placeItems: "center", margin: "0 auto 13px" }}>
            <Share />
          </div>
          <h3 style={{ fontFamily: "var(--fd)", fontSize: 17, marginBottom: 7 }}>{t.dashboard.shareTitle}</h3>
          <p style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6, marginBottom: 16 }}>{t.dashboard.shareBody}</p>
          {d.slug && <StoreLinkBox slug={d.slug} />}
          {d.slug && (
            <div style={{ marginTop: 13 }}>
              <Link href={`/${d.slug}`} className="btn btn-primary">
                <Eye />
                {t.dashboard.viewStore}
              </Link>
            </div>
          )}
        </div>
        <HowItWorks />
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Link href="/dashboard/new-class" style={{ flex: 1 }}>
          <Button variant="primary">
            <Plus />
            {t.dashboard.newClass}
          </Button>
        </Link>
        <Link href="/dashboard/new-pack" style={{ flex: 1 }}>
          <Button variant="ghost">
            <Plus />
            {t.dashboard.newPack}
          </Button>
        </Link>
      </div>
    </>
  );
}

// ── Real: signed in but no storefront yet ───────────────────────────────────
function RealNoStore() {
  const { t } = useLocale();
  return (
    <>
      <div className="panel panel-pad" style={{ textAlign: "center", marginBottom: "clamp(14px,2vw,22px)" }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, background: "var(--blue50)", color: "var(--blue)", display: "grid", placeItems: "center", margin: "0 auto 13px" }}>
          <Share />
        </div>
        <h3 style={{ fontFamily: "var(--fd)", fontSize: 18, marginBottom: 7 }}>{t.dashboard.createStore}</h3>
        <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, marginBottom: 18, maxWidth: 440, marginInline: "auto" }}>
          {t.dashboard.createStoreBody}
        </p>
        <Link href="/onboarding" className="btn btn-primary" style={{ maxWidth: 300, marginInline: "auto" }}>
          <Plus />
          {t.home.becomeTutor}
        </Link>
      </div>
      <HowItWorks />
    </>
  );
}

// ── Sidebar (shared between demo + real) ────────────────────────────────────
function DashSidebar() {
  const { t } = useLocale();
  return (
    <aside className="app-sidebar">
      <nav className="side-nav" aria-label={t.nav?.dashboard ?? "Navigation"}>
        <Link href="/dashboard" className="active">
          <Home />
          {t.nav?.dashboard ?? "Tableau de bord"}
        </Link>
        <Link href="/dashboard/new-class">
          <Video />
          {t.dashboard.newClass}
        </Link>
        <Link href="/dashboard/new-pack">
          <Plus />
          {t.dashboard.newPack}
        </Link>
        <Link href="/dashboard/payout">
          <Wallet />
          {t.payout?.title ?? "Retraits"}
        </Link>
        <Link href="/account">
          <User />
          {t.account?.title ?? "Mon compte"}
        </Link>
      </nav>
    </aside>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
// ── Verification status banner (shown on the real tutor dashboard) ──────────
function VerifBanner({ status }: { status: "draft" | "pending" | "verified" | "rejected" }) {
  const { t } = useLocale();
  if (status === "verified") {
    return (
      <div className="panel panel-pad" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "clamp(14px,2vw,22px)", background: "var(--green50)", border: "1px solid var(--green)" }}>
        <span style={{ color: "var(--green)", display: "flex", flexShrink: 0 }}><Check /></span>
        <div style={{ fontSize: 13.5 }}>
          <b style={{ fontFamily: "var(--fd)" }}>{t.verif.verifiedTitle}</b>{" "}
          <span style={{ color: "var(--ink2)" }}>{t.verif.verifiedBody}</span>
        </div>
      </div>
    );
  }
  const m =
    status === "draft"
      ? { title: t.verif.draftTitle, body: t.verif.draftBody, cta: t.verif.draftCta, bg: "#FFF4DF", bd: "var(--ochre)" }
      : status === "rejected"
      ? { title: t.verif.rejectedTitle, body: t.verif.rejectedBody, cta: t.verif.rejectedCta, bg: "#FDECEA", bd: "#E2483D" }
      : { title: t.verif.pendingTitle, body: t.verif.pendingBody, cta: null as string | null, bg: "var(--blue50)", bd: "var(--blue)" };
  return (
    <div className="panel panel-pad" style={{ marginBottom: "clamp(14px,2vw,22px)", background: m.bg, border: `1px solid ${m.bd}` }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <span style={{ color: m.bd, display: "flex", flexShrink: 0, marginTop: 2 }}><Shield /></span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontFamily: "var(--fd)", fontWeight: 700, marginBottom: 3 }}>{m.title}</div>
          <div style={{ fontSize: 13, color: "var(--ink2)", lineHeight: 1.5 }}>{m.body}</div>
        </div>
        {m.cta && (
          <Link href="/onboarding/verify" className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>
            {m.cta}
          </Link>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useLocale();
  // undefined = loading · null = demo/not-signed-in · object = real tutor data
  const [data, setData] = useState<DashboardData | null | undefined>(undefined);
  const [mode, setMode] = useState<Mode>("earning"); // demo-preview toggle only

  useEffect(() => {
    getDashboard().then(setData).catch(() => setData(null));
  }, []);

  const firstName = (data?.name ?? "").trim().split(/\s+/)[0];
  const realEarning = !!data && (data.classes.length > 0 || data.packs.length > 0 || data.balance_tnd > 0);

  let header: React.ReactNode;
  let body: React.ReactNode;
  let banner: React.ReactNode = null;

  if (data === undefined) {
    header = null;
    body = (
      <div className="panel panel-pad" style={{ display: "grid", placeItems: "center", minHeight: 200 }}>
        <Spinner />
      </div>
    );
  } else if (data === null) {
    // Demo preview (not signed in / no DB) — keep the earning↔empty toggle.
    header = (
      <DashHeader
        title={t.dashboard.hi("Yassine")}
        subtitle={mode === "earning" ? t.dashboard.monthGood : t.dashboard.online}
        actions={<ModeToggle mode={mode} onChange={setMode} />}
      />
    );
    body = mode === "earning" ? <EarningView /> : <EmptyView />;
  } else if (!data.has_storefront) {
    header = <DashHeader title={t.dashboard.createStore} subtitle={t.dashboard.createStoreBody} />;
    body = <RealNoStore />;
  } else {
    header = (
      <DashHeader
        title={t.dashboard.hi(firstName || "👋")}
        subtitle={realEarning ? t.dashboard.monthGood : t.dashboard.online}
        actions={
          data.slug ? (
            <Link href={`/${data.slug}`} className="btn btn-ink btn-sm">
              <Eye />
              {t.dashboard.viewStore}
            </Link>
          ) : null
        }
      />
    );
    body = realEarning ? <RealEarning d={data} /> : <RealEmpty d={data} />;
    banner = <VerifBanner status={data.status} />;
  }

  return (
    <SiteShell>
      <section className="web-section tight">
        <div className="container">
          <div className="app-layout">
            <DashSidebar />
            <div style={{ minWidth: 0 }}>
              {header}
              {banner}
              {body}
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

// ── Page header (greeting + actions + settings/notifications) ───────────────
function DashHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) {
  const { t } = useLocale();
  return (
    <div
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 14, marginBottom: "clamp(18px,2.5vw,28px)", flexWrap: "wrap",
      }}
    >
      <div>
        <h1 style={{ fontFamily: "var(--fd)", fontSize: "clamp(20px,2.4vw,28px)", letterSpacing: "-.5px", lineHeight: 1.15 }}>
          {title}
        </h1>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3 }}>{subtitle}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {actions}
        <button className="iconbtn" type="button" aria-label={t.extra.settings}>
          <Gear />
        </button>
        <button className="iconbtn" type="button" aria-label={t.extra.notifications}>
          <Bell />
        </button>
      </div>
    </div>
  );
}
