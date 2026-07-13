"use client";
import React, { useEffect, useState } from "react";
import { Link } from "@/components/Link";
import { Button, Spinner } from "@/components/ui";
import { useLocale } from "@/components/LocaleProvider";
import { Back, Wallet, Shield, Bank, Bulb } from "@/components/icons";
import { SiteShell } from "@/components/SiteShell";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { getDashboard } from "@/app/actions";
import type { DashboardData } from "@/lib/types";

/* Page-local copy (never edit lib/i18n.ts from here). FR + Derija, RTL-safe. */
const copy = {
  fr: {
    signedOutTitle: "Connecte-toi pour voir ton solde",
    signedOutBody: "Ton solde et tes retraits s'affichent ici une fois connecté.",
    signIn: "Se connecter",
    soonTitle: "Les paiements arrivent bientôt",
    soonBody:
      "On finalise Flouci et D17. En attendant, tes élèves réservent sans payer en ligne — donc ton solde est à 0, pour de vrai. Dès que les paiements s'ouvrent, chaque réservation payée arrive ici et tu pourras retirer.",
    soonNote: "On te préviendra dès que le retrait est ouvert. Rien à faire de ton côté.",
    comingRails: "Retraits prévus vers",
    disabledBtn: "Retrait pas encore disponible",
    zeroTitle: "Rien à retirer pour l'instant",
    zeroBody: "Ton solde est à 0. Il montera dès qu'un élève paiera une de tes séances.",
    backDash: "Retour au tableau de bord",
  },
  ar: {
    signedOutTitle: "ادخل لحسابك باش تشوف رصيدك",
    signedOutBody: "رصيدك والسحوبات يبانو هوني كي تدخل.",
    signIn: "دخول",
    soonTitle: "الدفع يوصل قريب",
    soonBody:
      "قاعدين نكمّلو في فلوسي و D17. توّا التلاميذ يحجزو بلا ما يخلّصو على الخط — علاخاطر هكّا رصيدك 0، بصحّ. كي يتفتح الدفع، كل حجز مخلّص يوصل لهوني وتنجم تسحب.",
    soonNote: "نعيّطولك أوّل ما السحب يتفتح. ما عندك ما تعمل.",
    comingRails: "السحب باش يمشي نحو",
    disabledBtn: "السحب ما زال ما تفعّلش",
    zeroTitle: "ما فماش شيء تسحبو توّا",
    zeroBody: "رصيدك 0. يطلع أوّل ما تلميذ يخلّص حصة متاعك.",
    backDash: "ارجع للوحة",
  },
} as const;

export default function PayoutPage() {
  const { t, locale } = useLocale();
  const c = copy[locale];

  // undefined = loading · null = signed out · object = real data (real balance)
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

  const balance = data?.balance_tnd ?? 0;
  const paymentsEnabled = data?.paymentsEnabled ?? false;
  // No payout rail is implemented yet (lib/payments.ts throws) — we never confirm
  // a withdrawal we can't actually make.
  const canWithdraw = false;

  const railRow = (label: string, Icon: typeof Wallet) => (
    <div
      key={label}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 13,
        padding: "14px 16px",
        borderRadius: 14,
        border: "1.5px solid var(--line)",
        background: "var(--cream)",
        marginBottom: 10,
        opacity: 0.75,
      }}
    >
      <span style={{ color: "var(--blue)", display: "inline-flex", flexShrink: 0 }}>
        <Icon />
      </span>
      <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
    </div>
  );

  let body: React.ReactNode;

  if (data === undefined) {
    body = (
      <div className="panel panel-pad" style={{ display: "grid", placeItems: "center", minHeight: 200 }}>
        <Spinner />
      </div>
    );
  } else if (data === null) {
    body = (
      <div className="panel panel-pad" style={{ textAlign: "center" }}>
        <div
          style={{
            width: 60, height: 60, borderRadius: 18, background: "var(--blue50)", color: "var(--blue)",
            display: "grid", placeItems: "center", margin: "0 auto 13px",
          }}
        >
          <Shield />
        </div>
        <h3 style={{ fontFamily: "var(--fd)", fontSize: 18, marginBottom: 7 }}>{c.signedOutTitle}</h3>
        <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, marginBottom: 18 }}>{c.signedOutBody}</p>
        <Link href="/auth" className="btn btn-primary" style={{ maxWidth: 260, marginInline: "auto" }}>
          {c.signIn}
        </Link>
      </div>
    );
  } else {
    body = (
      <>
        {/* Available balance — the REAL number from getDashboard (0 while payments are off) */}
        <div className="balance zellige hero-blue" style={{ borderRadius: "var(--r-l)", marginBottom: 20 }}>
          <div className="lbl">
            <Wallet />
            {t.payout.available}
          </div>
          <div className="amt">
            {balance.toLocaleString("fr-FR")}
            <small> TND</small>
          </div>
        </div>

        <div className="panel panel-pad">
          {/* Honest state: payments (and therefore payouts) are not live yet. */}
          <div
            style={{
              display: "flex",
              gap: 13,
              alignItems: "flex-start",
              padding: "16px",
              borderRadius: 14,
              background: "var(--blue50)",
              marginBottom: 20,
            }}
          >
            <span style={{ color: "var(--blue)", display: "inline-flex", flexShrink: 0, marginTop: 2 }}>
              <Bulb />
            </span>
            <div>
              <div style={{ fontFamily: "var(--fd)", fontSize: 15, fontWeight: 700, color: "var(--blue)", marginBottom: 5 }}>
                {paymentsEnabled ? c.zeroTitle : c.soonTitle}
              </div>
              <p style={{ fontSize: 13, color: "var(--blue700)", lineHeight: 1.65 }}>
                {paymentsEnabled ? c.zeroBody : c.soonBody}
              </p>
            </div>
          </div>

          {/* What the payout rails will be — shown as inert preview, not a live form. */}
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: "var(--ink2)" }}>
            {c.comingRails}
          </div>
          {railRow(t.payout.wallet, Wallet)}
          {railRow(t.payout.bank, Bank)}

          <div className="trust" style={{ marginTop: 18, marginBottom: 18 }}>
            <Shield />
            <p>{c.soonNote}</p>
          </div>

          {/* Never confirms a fake withdrawal: no submit, no toast, always disabled. */}
          <Button type="button" variant="green" disabled={!canWithdraw}>
            <Wallet />
            {c.disabledBtn}
          </Button>

          <div style={{ marginTop: 12, textAlign: "center" }}>
            <Link href="/dashboard" className="linklike" style={{ fontSize: 12.5 }}>
              {c.backDash}
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <SiteShell>
      <section className="web-section tight">
        <div className="container">
          <div className="app-layout">
            <DashboardSidebar />

            {/* Main content column */}
            <div style={{ minWidth: 0 }}>
              {/* Page header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: "clamp(18px,3vw,28px)",
                }}
              >
                <Link href="/dashboard">
                  <button className="iconbtn" aria-label={t.common.back}>
                    <Back />
                  </button>
                </Link>
                <h1
                  style={{
                    fontFamily: "var(--fd)",
                    fontSize: "clamp(20px,2.6vw,28px)",
                    letterSpacing: "-0.6px",
                    color: "var(--ink)",
                  }}
                >
                  {t.payout.title}
                </h1>
              </div>

              <div style={{ maxWidth: 620, width: "100%" }}>{body}</div>
            </div>
            {/* end main column */}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
