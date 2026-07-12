"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { Button, Spinner } from "@/components/ui";
import { useLocale } from "@/components/LocaleProvider";
import { Gear, Bell, Wallet, Share, Copy, Video, Plus, Bulb, Users, Eye, Book, Shield, Check, Phone, Clock } from "@/components/icons";
import { SiteShell } from "@/components/SiteShell";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { getDashboard, getNotifications, markNotificationsRead } from "@/app/actions";
import type { DashboardData, DashboardBooking, NotificationItem } from "@/lib/types";

/* Page-local copy (never edit lib/i18n.ts from here). FR + Derija, RTL-safe. */
const copy = {
  fr: {
    signedOutTitle: "Connecte-toi pour voir ton tableau de bord",
    signedOutBody: "Tes cours, tes élèves inscrits et ton solde s'affichent ici une fois connecté.",
    signIn: "Se connecter",
    bookings: "Tes élèves inscrits",
    bookingsSub: "Qui a réservé, et comment le joindre.",
    bookingsEmpty: "Personne n'a encore réservé.",
    bookingsEmptyBody: "Partage ton lien. Dès qu'un élève réserve, tu vois son nom et son numéro ici — tu peux l'appeler avant le cours.",
    signedUp: (n: number) => (n > 1 ? `${n} inscrits` : `${n} inscrit`),
    call: "Appeler",
    noPhone: "Pas de numéro",
    anon: "Élève",
    free: "Gratuit",
    paid: "Payé",
    reserved: "Réservé",
    attended: "Présent",
    bookedAgo: "Réservé",
    paymentsSoonTitle: "Les paiements arrivent bientôt",
    paymentsSoonBody: "Pour l'instant tes élèves réservent sans payer en ligne. Dès que Flouci et D17 sont branchés, ton solde s'affiche ici.",
    notifTitle: "Notifications",
    notifEmpty: "Rien de neuf pour l'instant.",
    justNow: "à l'instant",
    minsAgo: (n: number) => `il y a ${n} min`,
    hoursAgo: (n: number) => `il y a ${n} h`,
    daysAgo: (n: number) => `il y a ${n} j`,
  },
  ar: {
    signedOutTitle: "ادخل لحسابك باش تشوف لوحتك",
    signedOutBody: "حصصك، التلاميذ اللي حجزو، ورصيدك يبانو هوني كي تدخل.",
    signIn: "دخول",
    bookings: "التلاميذ اللي حجزو",
    bookingsSub: "شكون حجز، وكيفاش تتصل بيه.",
    bookingsEmpty: "ما زال حتّى حد ما حجز.",
    bookingsEmptyBody: "شارك رابطك. أوّل ما تلميذ يحجز، تشوف اسمو ونمرتو هوني — تنجم تكلّمو قبل الحصة.",
    signedUp: (n: number) => `${n} محجوز`,
    call: "اتصل",
    noPhone: "ما فماش نمرة",
    anon: "تلميذ",
    free: "مجاني",
    paid: "خالص",
    reserved: "محجوز",
    attended: "حاضر",
    bookedAgo: "حجز",
    paymentsSoonTitle: "الدفع يوصل قريب",
    paymentsSoonBody: "توّا التلاميذ يحجزو بلا ما يخلّصو على الخط. كي نربطو فلوسي و D17، رصيدك يبان هوني.",
    notifTitle: "الإشعارات",
    notifEmpty: "ما فماش جديد توّا.",
    justNow: "توّا",
    minsAgo: (n: number) => `منذ ${n} د`,
    hoursAgo: (n: number) => `منذ ${n} س`,
    daysAgo: (n: number) => `منذ ${n} يوم`,
  },
} as const;

// Union of both locales — copy[locale] is fr-shaped OR ar-shaped (same keys).
// (Named CopyDict, not Copy: `Copy` is already the clipboard icon import.)
type CopyDict = (typeof copy)["fr"] | (typeof copy)["ar"];

// Relative time. Rendered client-side only (data arrives in an effect) → no hydration risk.
function timeAgo(iso: string, c: CopyDict): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return c.justNow;
  if (mins < 60) return c.minsAgo(mins);
  const hours = Math.floor(mins / 60);
  if (hours < 24) return c.hoursAgo(hours);
  return c.daysAgo(Math.floor(hours / 24));
}

// ── Notifications bell (real: getNotifications / markNotificationsRead) ──────
function NotifBell() {
  const { t, locale } = useLocale();
  const c = copy[locale];
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [unread, setUnread] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    getNotifications()
      .then((n) => {
        if (!alive) return;
        setItems(n);
        setUnread(n.filter((x) => !x.read).length);
      })
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;
    // Refresh, then mark read server-side. We keep the per-item dots visible for
    // this open panel so the tutor can still see what was new.
    const fresh = await getNotifications().catch(() => [] as NotificationItem[]);
    setItems(fresh);
    if (fresh.some((n) => !n.read)) {
      await markNotificationsRead().catch(() => {});
      setUnread(0);
    }
  }

  const list = items ?? [];

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        className="iconbtn"
        type="button"
        aria-label={t.extra.notifications}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={toggle}
        style={{ position: "relative" }}
      >
        <Bell />
        {unread > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 6,
              insetInlineEnd: 6,
              minWidth: 8,
              height: 8,
              borderRadius: 999,
              background: "var(--green)",
              boxShadow: "0 0 0 2px var(--sand)",
            }}
          />
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={c.notifTitle}
          className="panel"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            insetInlineEnd: 0,
            width: "min(330px, calc(100vw - 32px))",
            maxHeight: 420,
            overflowY: "auto",
            zIndex: 60,
            padding: 6,
            textAlign: "start",
          }}
        >
          <div
            style={{
              fontFamily: "var(--fd)",
              fontSize: 13,
              fontWeight: 700,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: ".5px",
              padding: "10px 12px 8px",
            }}
          >
            {c.notifTitle}
          </div>

          {items === null ? (
            <div style={{ display: "grid", placeItems: "center", padding: 24 }}>
              <Spinner />
            </div>
          ) : list.length === 0 ? (
            <div style={{ padding: "14px 12px 18px", fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
              {c.notifEmpty}
            </div>
          ) : (
            list.map((n) => {
              const inner = (
                <>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 999,
                      background: n.read ? "transparent" : "var(--blue)",
                      flexShrink: 0,
                      marginTop: 7,
                    }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>
                      {n.title}
                    </span>
                    <span style={{ display: "block", fontSize: 12.5, color: "var(--ink2)", lineHeight: 1.5, marginTop: 2 }}>
                      {n.body}
                    </span>
                    <span style={{ display: "block", fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                      {timeAgo(n.createdAt, c)}
                    </span>
                  </span>
                </>
              );
              const rowStyle: React.CSSProperties = {
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                padding: "11px 12px",
                borderRadius: 12,
                color: "inherit",
                background: n.read ? "transparent" : "var(--blue50)",
                marginBottom: 3,
              };
              return n.href ? (
                <Link key={n.id} href={n.href} role="menuitem" style={rowStyle} onClick={() => setOpen(false)}>
                  {inner}
                </Link>
              ) : (
                <div key={n.id} role="menuitem" style={rowStyle}>
                  {inner}
                </div>
              );
            })
          )}
        </div>
      )}
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

// ── Balance card — always the REAL balance (0 while payments are off) ────────
function BalanceCard({ d }: { d: DashboardData }) {
  const { t, locale } = useLocale();
  const c = copy[locale];
  return (
    <div
      className="balance zellige hero-blue panel"
      style={{ borderRadius: "var(--r-l)", padding: "clamp(18px,2.4vw,26px)", border: "none" }}
    >
      <div className="lbl">
        <Wallet />
        {t.dashboard.balance}
      </div>
      <div className="amt">
        {d.balance_tnd.toLocaleString("fr-FR")}
        <small> TND</small>
      </div>
      <div
        style={{
          display: "flex", alignItems: "flex-start", gap: 8, marginTop: 15, background: "rgba(255,255,255,.13)",
          padding: "10px 12px", borderRadius: 12, fontSize: 12.5, color: "#EAF2FC", position: "relative", zIndex: 2,
          lineHeight: 1.5,
        }}
      >
        <span style={{ display: "inline-flex", color: "#F3C24B", flexShrink: 0, marginTop: 1 }}>
          <Bulb style={{ width: 16, height: 16 }} />
        </span>
        <span>{d.paymentsEnabled ? t.dashboard.emptyNote : c.paymentsSoonBody}</span>
      </div>
    </div>
  );
}

// ── Bookings: who actually booked (name + phone + when) ──────────────────────
type BookingGroup = { classId: string; classTitle: string; classTs: number; items: DashboardBooking[] };

function statusLabel(s: DashboardBooking["status"], c: CopyDict): string {
  if (s === "paid") return c.paid;
  if (s === "attended") return c.attended;
  return c.reserved;
}

function BookingsPanel({ d }: { d: DashboardData }) {
  const { locale } = useLocale();
  const c = copy[locale];

  const groups: BookingGroup[] = useMemo(() => {
    const map = new Map<string, BookingGroup>();
    for (const b of d.bookings) {
      if (b.status === "cancelled") continue; // a freed seat isn't a student
      const g = map.get(b.classId);
      if (g) g.items.push(b);
      else map.set(b.classId, { classId: b.classId, classTitle: b.classTitle, classTs: b.classTs, items: [b] });
    }
    return [...map.values()].sort((a, b) => a.classTs - b.classTs);
  }, [d.bookings]);

  return (
    <div className="panel panel-pad" style={{ marginBottom: "clamp(14px,2vw,22px)" }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: "var(--fd)", fontSize: 16, fontWeight: 700 }}>{c.bookings}</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{c.bookingsSub}</div>
      </div>

      {groups.length === 0 ? (
        <div
          style={{
            display: "flex", gap: 13, alignItems: "flex-start", padding: "16px 16px",
            background: "var(--cream)", border: "1px dashed var(--line)", borderRadius: 14,
          }}
        >
          <span style={{ color: "var(--blue)", display: "inline-flex", flexShrink: 0, marginTop: 2 }}>
            <Users />
          </span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{c.bookingsEmpty}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>{c.bookingsEmptyBody}</div>
          </div>
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.classId} style={{ marginBottom: 16 }}>
            <div
              style={{
                display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                paddingBottom: 8, borderBottom: "1px solid var(--line)", marginBottom: 6,
              }}
            >
              <span style={{ color: "var(--blue)", display: "inline-flex", flexShrink: 0 }}>
                <Video style={{ width: 16, height: 16 }} />
              </span>
              <Link
                href={`/class/${g.classId}`}
                style={{
                  fontSize: 13.5, fontWeight: 700, color: "var(--ink)", minWidth: 0,
                  overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                }}
              >
                {g.classTitle}
              </Link>
              <span
                style={{
                  marginInlineStart: "auto", fontSize: 11.5, fontWeight: 700, color: "var(--blue)",
                  background: "var(--blue50)", padding: "3px 9px", borderRadius: 999, flexShrink: 0,
                }}
              >
                {c.signedUp(g.items.length)}
              </span>
            </div>

            {g.items.map((b) => (
              <div
                key={b.bookingId}
                style={{
                  display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
                  padding: "11px 0", borderBottom: "1px solid var(--line)",
                }}
              >
                <div
                  style={{
                    width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: "grid", placeItems: "center",
                    background: "var(--sand)", color: "var(--ink2)", fontFamily: "var(--fd)", fontSize: 14, fontWeight: 700,
                  }}
                >
                  {(b.studentName ?? "?").trim().charAt(0).toUpperCase() || "?"}
                </div>

                <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13.5, fontWeight: 600, overflow: "hidden",
                      whiteSpace: "nowrap", textOverflow: "ellipsis",
                    }}
                  >
                    {b.studentName?.trim() || c.anon}
                  </div>
                  <div
                    style={{
                      fontSize: 11.5, color: "var(--muted)", marginTop: 2,
                      display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap",
                    }}
                  >
                    <Clock style={{ width: 12, height: 12 }} />
                    {c.bookedAgo} {timeAgo(b.bookedAt, c)}
                    <span aria-hidden="true">·</span>
                    <span style={{ color: b.isFree ? "var(--green)" : "var(--ink2)", fontWeight: 700 }}>
                      {b.isFree ? c.free : statusLabel(b.status, c)}
                    </span>
                  </div>
                </div>

                {b.studentPhone ? (
                  <a
                    href={`tel:${b.studentPhone}`}
                    className="btn btn-ghost btn-sm"
                    style={{ flexShrink: 0, marginInlineStart: "auto", width: "auto" }}
                  >
                    <Phone style={{ width: 15, height: 15 }} />
                    {b.studentPhone}
                  </a>
                ) : (
                  <span
                    style={{
                      flexShrink: 0, marginInlineStart: "auto", fontSize: 11.5,
                      color: "var(--muted)", fontStyle: "italic",
                    }}
                  >
                    {c.noPhone}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

// ── Real: tutor with a live storefront ──────────────────────────────────────
function RealDashboard({ d }: { d: DashboardData }) {
  const { t } = useLocale();
  const stats = [
    { value: d.students, label: t.dashboard.stStudents, color: "var(--blue)" },
    { value: d.sessions, label: t.dashboard.stSessions, color: "var(--ink)" },
    {
      value: d.reviewCount > 0 ? d.rating : "—",
      label: t.dashboard.stRating,
      color: "var(--amber)",
    },
  ];

  return (
    <>
      {/* Balance + stats */}
      <div className="grid-2" style={{ marginBottom: "clamp(14px,2vw,22px)" }}>
        <BalanceCard d={d} />

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

      {/* Who booked — the tutor's core job-to-be-done */}
      <BookingsPanel d={d} />

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

      {/* Storefront link + how-it-works for a tutor with nothing published yet */}
      {d.classes.length === 0 && d.packs.length === 0 ? (
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
      ) : (
        d.slug && (
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
        )
      )}

      {/* Cash-out CTA — only when payouts can actually happen. No promise otherwise. */}
      {d.paymentsEnabled && (
        <div style={{ marginBottom: "clamp(14px,2vw,22px)" }}>
          <Link href="/dashboard/payout">
            <Button variant="green">
              <Wallet />
              {t.dashboard.cashout}
            </Button>
          </Link>
        </div>
      )}

      {/* Create CTAs */}
      <div style={{ display: "flex", gap: 10 }}>
        <Link href="/dashboard/new-class" style={{ flex: 1 }}>
          <Button variant={d.classes.length === 0 ? "primary" : "ghost"}>
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

// ── Signed out / no session — never fabricate an earning view ───────────────
function SignedOut() {
  const { locale } = useLocale();
  const c = copy[locale];
  return (
    <div className="panel panel-pad" style={{ textAlign: "center", maxWidth: 560, marginInline: "auto" }}>
      <div style={{ width: 60, height: 60, borderRadius: 18, background: "var(--blue50)", color: "var(--blue)", display: "grid", placeItems: "center", margin: "0 auto 13px" }}>
        <Shield />
      </div>
      <h3 style={{ fontFamily: "var(--fd)", fontSize: 18, marginBottom: 7 }}>{c.signedOutTitle}</h3>
      <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, marginBottom: 18 }}>{c.signedOutBody}</p>
      <Link href="/auth" className="btn btn-primary" style={{ maxWidth: 260, marginInline: "auto" }}>
        {c.signIn}
      </Link>
    </div>
  );
}

// ── Verification status banner ──────────────────────────────────────────────
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

// ── Page header (greeting + actions + settings/notifications) ───────────────
function DashHeader({
  title,
  subtitle,
  actions,
  showTools,
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  showTools?: boolean;
}) {
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
        {showTools && (
          <>
            <Link href="/account" className="iconbtn" aria-label={t.extra.settings}>
              <Gear />
            </Link>
            <NotifBell />
          </>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { t, locale } = useLocale();
  const c = copy[locale];
  // undefined = loading · null = signed out / no session · object = real tutor data
  const [data, setData] = useState<DashboardData | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    getDashboard()
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, []);

  const firstName = (data?.name ?? "").trim().split(/\s+/)[0];
  const hasPublished = !!data && (data.classes.length > 0 || data.packs.length > 0);

  let header: React.ReactNode = null;
  let body: React.ReactNode;
  let banner: React.ReactNode = null;

  if (data === undefined) {
    body = (
      <div className="panel panel-pad" style={{ display: "grid", placeItems: "center", minHeight: 200 }}>
        <Spinner />
      </div>
    );
  } else if (data === null) {
    // No session (or no DB). Never render fabricated earnings — prompt sign-in.
    header = <DashHeader title={c.signedOutTitle} subtitle={c.signedOutBody} />;
    body = <SignedOut />;
  } else if (!data.has_storefront) {
    header = <DashHeader title={t.dashboard.createStore} subtitle={t.dashboard.createStoreBody} showTools />;
    body = <RealNoStore />;
  } else {
    header = (
      <DashHeader
        title={t.dashboard.hi(firstName || "👋")}
        subtitle={hasPublished ? t.dashboard.online : t.dashboard.createStoreBody}
        showTools
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
    body = <RealDashboard d={data} />;
    banner = <VerifBanner status={data.status} />;
  }

  return (
    <SiteShell>
      <section className="web-section tight">
        <div className="container">
          <div className="app-layout">
            <DashboardSidebar />
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
