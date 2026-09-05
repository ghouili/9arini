"use client";
import React, { useEffect, useState } from "react";
import { Link } from "@/components/Link";
import { Button, Spinner } from "@/components/ui";
import { useLocale } from "@/components/LocaleProvider";
import { Back, Wallet, Shield, Bank, Bulb } from "@/components/icons";
import { SiteShell } from "@/components/SiteShell";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { getDashboard } from "@/app/actions";
import { WrongRoleNotice } from "@/components/WrongRoleNotice";
import type { DashboardData, DashboardResult } from "@tnajem/shared";
import { bilingual } from "@/lib/i18n";

/* Page-local copy (never edit lib/i18n.ts from here). FR + Derija, RTL-safe. */
const copy = bilingual({
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
});

/* Page-scoped CSS (`qp-`), injected with dangerouslySetInnerHTML and UNLAYERED so
   it wins over globals.css's @layer components.
   .balance .amt is 42px / -1.4px tracking there: a 5-digit balance overflows the
   card, Space Grotesk (--fd) has no Arabic glyphs, and the negative tracking
   severs Arabic cursive joins. Clamped + RTL fallback + LTR-isolated number. */
const CSS = `
.qp-balance .amt{font-size:clamp(26px,6.5vw,40px);letter-spacing:-1px;line-height:1.08;
  overflow-wrap:anywhere;font-variant-numeric:tabular-nums;margin-top:4px}
html[dir="rtl"] .qp-balance .amt{font-family:var(--fa);letter-spacing:normal}
.qp-num{direction:ltr;unicode-bidi:isolate;display:inline-block}
`;

export default function PayoutPage() {
  const { t, locale } = useLocale();
  const c = copy[locale];

  /* undefined = loading · null = signed out · {wrongRole} = signed in as a student
     · object = real data (real balance) */
  const [result, setResult] = useState<DashboardResult | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    getDashboard()
      .then((d) => alive && setResult(d))
      .catch(() => alive && setResult(null));
    return () => {
      alive = false;
    };
  }, []);

  // Same split as /dashboard — a payout screen must never render for a student.
  const wrong = result && "wrongRole" in result ? result : null;
  const data: DashboardData | null | undefined =
    result === undefined ? undefined
      : result === null || "wrongRole" in result ? null
      : result;

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
      <span className="text-blue inline-flex shrink-0" aria-hidden="true">
        <Icon />
      </span>
      <span className="text-[14px] font-semibold min-w-0">{label}</span>
    </div>
  );

  let body: React.ReactNode;

  if (data === undefined) {
    body = (
      <div className="panel panel-pad grid place-items-center min-h-[200px]">
        <Spinner />
      </div>
    );
  } else if (wrong) {
    body = <WrongRoleNotice role={wrong.wrongRole} />;
  } else if (data === null) {
    body = (
      <div className="panel panel-pad text-center">
        <div
          style={{
            width: 60, height: 60, borderRadius: 18, background: "var(--blue50)", color: "var(--blue)",
            display: "grid", placeItems: "center", margin: "0 auto 13px",
          }}
        >
          <Shield />
        </div>
        {/* h2, not h3: this panel replaces the page body when signed out, so it
            is the first heading under the page h1 — an h3 here skips a level. */}
        <h2 className="font-display text-[18px] mb-[7px]">{c.signedOutTitle}</h2>
        <p className="text-[13px] text-muted leading-[1.6] mb-[18px]">{c.signedOutBody}</p>
        <Link href="/auth" className="btn btn-primary max-w-[260px] mx-auto">
          {c.signIn}
        </Link>
      </div>
    );
  } else {
    body = (
      <>
        {/* Available balance — the REAL number from getDashboard (0 while payments are off) */}
        <div className="balance qp-balance zellige hero-blue rounded-brand-lg mb-5 min-w-0">
          <div className="lbl">
            <Wallet />
            {t.payout.available}
          </div>
          <div className="amt">
            <span className="qp-num">
              {balance.toLocaleString("fr-FR")}
              <small> TND</small>
            </span>
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
            <span className="text-blue inline-flex shrink-0 mt-0.5">
              <Bulb />
            </span>
            <div>
              <div className="font-display text-[15px] font-bold text-blue mb-[5px]">
                {paymentsEnabled ? c.zeroTitle : c.soonTitle}
              </div>
              <p className="text-[13px] text-blue700 leading-[1.65]">
                {paymentsEnabled ? c.zeroBody : c.soonBody}
              </p>
            </div>
          </div>

          {/* What the payout rails will be — shown as inert preview, not a live form. */}
          <div className="text-[13px] font-bold mb-2.5 text-ink2">
            {c.comingRails}
          </div>
          {railRow(t.payout.wallet, Wallet)}
          {railRow(t.payout.bank, Bank)}

          <div className="trust mt-[18px] mb-[18px]">
            <Shield />
            <p>{c.soonNote}</p>
          </div>

          {/* Never confirms a fake withdrawal: no submit, no toast, always disabled. */}
          <Button type="button" variant="green" disabled={!canWithdraw}>
            <Wallet />
            {c.disabledBtn}
          </Button>

          <div className="mt-3 text-center">
            <Link href="/dashboard" className="linklike text-[13px]">
              {c.backDash}
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <SiteShell>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section className="web-section tight">
        <div className="container">
          <div className="app-layout">
            <DashboardSidebar paymentsEnabled={paymentsEnabled} />

            {/* Main content column */}
            <div className="min-w-0">
              {/* Page header */}
              <div
                className="flex items-center gap-3 mb-[clamp(18px,3vw,28px)]"
              >
                <Link href="/dashboard" className="iconbtn flex-none" aria-label={t.common.back}>
                  <Back />
                </Link>
                <h1
                  className="font-display text-[clamp(20px,2.6vw,28px)] tracking-[-0.6px] text-ink min-w-0"
                >
                  {t.payout.title}
                </h1>
              </div>

              <div className="max-w-[620px] w-full">{body}</div>
            </div>
            {/* end main column */}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
