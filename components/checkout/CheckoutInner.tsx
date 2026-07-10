"use client";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";
import { Shield, Lock } from "@/components/icons";
import { Spinner } from "@/components/ui";
import { getClass, reserveSeat } from "@/app/actions";
import type { ClassItem } from "@/lib/types";

/* ---------- types ---------- */
type PayMethod = "flouci" | "card" | "d17";

/* ---------- confetti ---------- */
const CONFETTI_COLORS = ["#E0852E", "#1B9C6F", "#0E5AA6", "#F3C24B"];

function Confetti() {
  // 12 pieces scattered around the check circle
  const pieces = Array.from({ length: 12 }, (_, i) => ({
    key: i,
    color: CONFETTI_COLORS[i % 4],
    left: 20 + Math.random() * 60,
    delay: Math.random() * 0.35,
    size: 7 + Math.random() * 5,
  }));
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes confetti-pop {
          0%   { opacity: 0; transform: translateY(0)    scale(.4) rotate(0deg);   }
          25%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(-70px) scale(1.1) rotate(200deg); }
        }
      `}} />
      {pieces.map((p) => (
        <span
          key={p.key}
          style={{
            position: "absolute",
            width: p.size,
            height: p.size,
            borderRadius: 2,
            background: p.color,
            left: `${p.left}%`,
            top: "35%",
            animationName: "confetti-pop",
            animationDuration: "0.95s",
            animationTimingFunction: "ease-out",
            animationFillMode: "forwards",
            animationDelay: `${p.delay}s`,
            pointerEvents: "none",
          }}
        />
      ))}
    </>
  );
}

/* ---------- payment option row ---------- */
interface PmOptProps {
  selected: boolean;
  onSelect: () => void;
  logoColor: string;
  logoText: string;
  title: string;
  subtitle: string;
}
function PmOpt({ selected, onSelect, logoColor, logoText, title, subtitle }: PmOptProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={title}
      onClick={onSelect}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 13,
        padding: "14px 16px",
        border: selected
          ? "1.6px solid var(--blue)"
          : "1.6px solid var(--lineCool)",
        borderRadius: 15,
        marginBottom: 10,
        cursor: "pointer",
        background: "var(--paper)",
        width: "100%",
        textAlign: "start",
        transition: "border-color .15s",
        boxShadow: selected ? "0 0 0 3px rgba(14,90,166,.12)" : "none",
        minHeight: 56,
      }}
    >
      {/* Logo badge */}
      <div
        style={{
          width: 48,
          height: 34,
          borderRadius: 9,
          flex: "none",
          display: "grid",
          placeItems: "center",
          background: logoColor,
          fontFamily: "var(--fd)",
          fontWeight: 700,
          fontSize: 11,
          color: "#fff",
          letterSpacing: 0.3,
        }}
      >
        {logoText}
      </div>

      {/* Label */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
        <div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 2 }}>{subtitle}</div>
      </div>

      {/* Radio indicator */}
      <div
        style={{
          width: 21,
          height: 21,
          borderRadius: "50%",
          border: `2px solid ${selected ? "var(--blue)" : "var(--lineCool)"}`,
          flex: "none",
          display: "grid",
          placeItems: "center",
          marginInlineStart: "auto",
          transition: "border-color .15s",
        }}
      >
        {selected && (
          <div
            style={{
              width: 11,
              height: 11,
              borderRadius: "50%",
              background: "var(--blue)",
            }}
          />
        )}
      </div>
    </button>
  );
}

/* ---------- success overlay ---------- */
interface SuccessOverlayProps {
  show: boolean;
  okTitle: string;
  okBody: string;
  okCta: string;
}
function SuccessOverlay({ show, okTitle, okBody, okCta }: SuccessOverlayProps) {
  if (!show) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--cream)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "40px clamp(20px, 5vw, 48px)",
        zIndex: 40,
        animation: "rise .45s cubic-bezier(.2,.7,.2,1)",
        borderRadius: "inherit",
      }}
    >
      {/* Confetti burst */}
      <Confetti />

      {/* Green check circle */}
      <div
        style={{
          width: 98,
          height: 98,
          borderRadius: "50%",
          background: "var(--green)",
          display: "grid",
          placeItems: "center",
          marginBottom: 22,
          boxShadow: "0 16px 32px -10px rgba(27,156,111,.75)",
          position: "relative",
          zIndex: 2,
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes draw-check {
            to { stroke-dashoffset: 0; }
          }
          .succ-check {
            stroke-dasharray: 40;
            stroke-dashoffset: 40;
            animation: draw-check .55s .15s forwards;
          }
        `}} />
        <svg
          viewBox="0 0 24 24"
          style={{
            width: 50,
            height: 50,
            stroke: "#fff",
            fill: "none",
            strokeWidth: 3.4,
            strokeLinecap: "round",
            strokeLinejoin: "round",
          }}
        >
          <polyline points="5 13 10 18 19 7" className="succ-check" />
        </svg>
      </div>

      <h2
        style={{
          fontFamily: "var(--fd)",
          fontSize: 24,
          letterSpacing: -0.5,
          marginBottom: 10,
          position: "relative",
          zIndex: 2,
        }}
      >
        {okTitle}
      </h2>
      <p
        style={{
          color: "var(--muted)",
          fontSize: 14,
          lineHeight: 1.65,
          maxWidth: 260,
          marginBottom: 28,
          position: "relative",
          zIndex: 2,
        }}
      >
        {okBody}
      </p>

      <Link
        href="/student"
        className="btn btn-ink"
        style={{ width: "100%", maxWidth: 220, position: "relative", zIndex: 2 }}
      >
        {okCta}
      </Link>
    </div>
  );
}

/* ---------- main component ---------- */
export default function CheckoutInner() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const classId = searchParams.get("class") ?? "";

  // Fetch the real class (demo class in demo mode).
  const [cls, setCls] = useState<ClassItem | null | undefined>(undefined);
  useEffect(() => {
    getClass(classId).then(setCls).catch(() => setCls(null));
  }, [classId]);

  const [selected, setSelected] = useState<PayMethod>("flouci");
  const [paid, setPaid] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [err, setErr] = useState<"auth" | "full" | "generic" | null>(null);

  const handlePay = useCallback(async () => {
    setErr(null);
    setReserving(true);
    const res = await reserveSeat({ classId });
    setReserving(false);
    if (res.ok) {
      setPaid(true);
      return;
    }
    if (res.error === "not-authenticated") setErr("auth");
    else if (res.error === "full") setErr("full");
    else setErr("generic");
  }, [classId]);

  // ── Loading / not-found ──
  if (cls === undefined) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 240 }}>
        <Spinner />
      </div>
    );
  }
  if (cls === null) {
    return (
      <div className="card card-pad" style={{ textAlign: "center", maxWidth: 460, marginInline: "auto" }}>
        <h1 style={{ fontFamily: "var(--fd)", fontSize: 18, marginBottom: 12 }}>{t.checkout.errGeneric}</h1>
        <Link href="/explore" className="btn btn-primary" style={{ maxWidth: 220, marginInline: "auto" }}>
          {t.nav.explore}
        </Link>
      </div>
    );
  }

  const isFree = cls.is_free_first;

  return (
    /*
     * Outer wrapper: relative so the success overlay can fill it.
     * max-width + mx-auto centres on wide viewports; width:100% ensures
     * it fills the container-narrow column on small screens.
     */
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 560,
        marginInline: "auto",
      }}
    >
      {/* ── Page title + back link ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <Link
          href={`/class/${cls.id}`}
          className="iconbtn"
          aria-label={t.common.back}
          style={{ flexShrink: 0 }}
        >
          <svg viewBox="0 0 24 24" className="ic flip" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <h1
          style={{
            fontFamily: "var(--fd)",
            fontSize: "clamp(18px,3vw,22px)",
            fontWeight: 700,
            letterSpacing: -0.4,
          }}
        >
          {t.checkout.title}
        </h1>
      </div>

      {/* ── Class summary card ── */}
      <div
        className="card card-pad"
        style={{
          display: "flex",
          gap: 13,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div
          className="thumb"
          style={{ background: "var(--blue)", color: "#fff", flexShrink: 0 }}
        >
          <b>{cls.day}</b>
          <span>{cls.month}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 14.5,
              marginBottom: 3,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {cls.title}
          </div>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>
            {t.classDetail.with} {cls.tutor_name ?? "—"} · {cls.time}
          </div>
        </div>
      </div>

      {/* ── Price lines ── */}
      <div
        className="panel panel-pad"
        style={{ marginBottom: 16 }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "10px 0",
            fontSize: 14,
          }}
        >
          <span style={{ color: "var(--muted)" }}>{t.checkout.trial}</span>
          <span className="price" style={{ color: "var(--green)" }}>
            0 {t.common.tnd}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "10px 0",
            borderTop: "1px solid var(--line)",
            fontSize: 14,
          }}
        >
          <span>{t.checkout.nextSessions}</span>
          <span className="price">
            {cls.price_tnd} {t.common.tnd}
          </span>
        </div>
      </div>

      {/* ── Payment method section ── */}
      <div className="sec" style={{ marginBottom: 10 }}>
        <span>{t.checkout.method}</span>
      </div>

      <div role="radiogroup" aria-label={t.checkout.method} style={{ marginBottom: 16 }}>
        <PmOpt
          selected={selected === "flouci"}
          onSelect={() => setSelected("flouci")}
          logoColor="#5B3DF5"
          logoText="flouci"
          title="Flouci"
          subtitle={t.checkout.flouci}
        />
        <PmOpt
          selected={selected === "card"}
          onSelect={() => setSelected("card")}
          logoColor="var(--blue)"
          logoText="CIB"
          title={t.checkout.card}
          subtitle={t.checkout.cardSub}
        />
        <PmOpt
          selected={selected === "d17"}
          onSelect={() => setSelected("d17")}
          logoColor="#0A7D3E"
          logoText="D17"
          title="D17"
          subtitle={t.checkout.d17}
        />
      </div>

      {/* ── Trust block ── */}
      <div className="trust" style={{ marginBottom: 20 }}>
        <Shield />
        <p>
          <strong>{t.checkout.trust.split(".")[0]}.</strong>{" "}
          {t.checkout.trust.split(".").slice(1).join(".")}
        </p>
      </div>

      {/* ── Error (auth / full / generic) ── */}
      {err && (
        <div
          role="alert"
          style={{
            background: "#FDECEA", border: "1px solid #F5C2BC", color: "#A3261B",
            borderRadius: 12, padding: "11px 13px", fontSize: 13, marginBottom: 12, textAlign: "center",
          }}
        >
          {err === "auth" ? t.checkout.errAuth : err === "full" ? t.checkout.errFull : t.checkout.errGeneric}
          {err === "auth" && (
            <>
              {" "}
              <Link href="/auth" style={{ color: "var(--blue)", fontWeight: 700, textDecoration: "underline" }}>
                {t.auth.title}
              </Link>
            </>
          )}
        </div>
      )}

      {/* ── Pay button + fine print ── */}
      <button
        className="btn btn-primary"
        onClick={handlePay}
        disabled={paid || reserving}
        style={{ minHeight: 52 }}
      >
        <Lock />
        <span>{reserving ? "…" : isFree ? t.checkout.pay : t.checkout.payPaid(cls.price_tnd)}</span>
      </button>

      <p
        style={{
          textAlign: "center",
          color: "var(--muted)",
          fontSize: 11.5,
          marginTop: 11,
          fontWeight: 600,
        }}
      >
        {t.checkout.noCharge}
      </p>

      {/* Demo pending note */}
      <p
        style={{
          textAlign: "center",
          color: "var(--muted)",
          fontSize: 11,
          marginTop: 6,
          fontStyle: "italic",
          marginBottom: 32,
        }}
      >
        {t.checkout.pending}
      </p>

      {/* ── Success overlay ── */}
      <SuccessOverlay
        show={paid}
        okTitle={t.checkout.okTitle}
        okBody={t.checkout.okBody}
        okCta={t.checkout.okCta}
      />
    </div>
  );
}
