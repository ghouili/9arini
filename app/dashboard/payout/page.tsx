"use client";
import React, { useState } from "react";
import Link from "next/link";
import { Button, Field } from "@/components/ui";
import { useLocale } from "@/components/LocaleProvider";
import { Back, Wallet, Shield, Bank } from "@/components/icons";
import { useToast } from "@/components/useToast";
import { demoTutorStatsEarning } from "@/lib/demo";
import { SiteShell } from "@/components/SiteShell";
import { DashboardSidebar } from "@/components/DashboardSidebar";

type Method = "flouci_wallet" | "bank_rib";

export default function PayoutPage() {
  const { t } = useLocale();
  const available = demoTutorStatsEarning.balance_tnd;

  const [method, setMethod] = useState<Method>("flouci_wallet");
  const [amount, setAmount] = useState(String(available));
  const [requested, setRequested] = useState(false);
  const { toast, showToast } = useToast();

  function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!num || num <= 0 || num > available) return;
    // TODO real payout — POST to a server action once payments clear legal
    setRequested(true);
    showToast(`${t.extra.payoutRequested} · ${t.common.demoMode}`);
  }

  const radioStyle = (active: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 13,
    padding: "14px 16px",
    borderRadius: 14,
    border: active ? "2px solid var(--blue)" : "1.5px solid var(--line)",
    background: active ? "var(--blue50)" : "var(--paper)",
    cursor: "pointer",
    marginBottom: 10,
    transition: ".15s",
  });

  return (
    <SiteShell>
      <section className="web-section tight">
        <div className="container">
          <div className="app-layout">
            <DashboardSidebar />

            {/* Main content column */}
            <div style={{ minWidth: 0 }}>
              {/* Page header */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: "clamp(18px,3vw,28px)",
              }}>
                <Link href="/dashboard">
                  <button className="iconbtn" aria-label={t.common.back}>
                    <Back />
                  </button>
                </Link>
                <h1 style={{
                  fontFamily: "var(--fd)",
                  fontSize: "clamp(20px,2.6vw,28px)",
                  letterSpacing: "-0.6px",
                  color: "var(--ink)",
                }}>
                  {t.payout.title}
                </h1>
              </div>

              {/* Form card */}
              <div style={{ maxWidth: 620, width: "100%" }}>

                {/* Available balance card */}
                <div
                  className="balance zellige hero-blue"
                  style={{ borderRadius: "var(--r-l)", marginBottom: 20 }}
                >
                  <div className="lbl">
                    <Wallet />
                    {t.payout.available}
                  </div>
                  <div className="amt">
                    {available.toLocaleString("fr-TN")}<small> TND</small>
                  </div>
                </div>

                {/* Payout form */}
                <div className="panel panel-pad">
                  <form onSubmit={handleRequest}>
                    {/* Method selection */}
                    <div style={{
                      fontSize: 12,
                      fontWeight: 700,
                      marginBottom: 10,
                      color: "var(--ink2)",
                    }}>
                      {t.payout.to}
                    </div>

                    <div role="radiogroup" aria-label={t.payout.to}>
                      {(
                        [
                          { value: "flouci_wallet", label: t.payout.wallet, Icon: Wallet },
                          { value: "bank_rib", label: t.payout.bank, Icon: Bank },
                        ] as { value: Method; label: string; Icon: typeof Wallet }[]
                      ).map((opt) => (
                        <div
                          key={opt.value}
                          role="radio"
                          aria-checked={method === opt.value}
                          aria-label={opt.label}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === " " || e.key === "Enter") {
                              e.preventDefault();
                              setMethod(opt.value);
                            }
                          }}
                          style={radioStyle(method === opt.value)}
                          onClick={() => setMethod(opt.value)}
                        >
                          {/* Custom radio dot */}
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              minWidth: 20,
                              borderRadius: "50%",
                              border: method === opt.value ? "6px solid var(--blue)" : "2px solid var(--line)",
                              flexShrink: 0,
                              transition: ".15s",
                            }}
                          />
                          <span style={{ color: "var(--blue)", display: "inline-flex" }}>
                            <opt.Icon />
                          </span>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{opt.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Amount input */}
                    <div style={{ marginTop: 6 }}>
                      <Field label={t.payout.amount}>
                        <div className="inp">
                          <input
                            type="number"
                            min={1}
                            max={available}
                            step={0.5}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                            style={{ fontFamily: "var(--fd)", fontSize: 18, fontWeight: 700 }}
                          />
                          <span className="pre">{t.common.tnd}</span>
                        </div>
                      </Field>
                    </div>

                    {/* Quick-fill chips — flex-wrap so they stack on very narrow screens */}
                    <div style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginBottom: 18,
                    }}>
                      {[available, Math.floor(available / 2), 100].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setAmount(String(v))}
                          className="btn btn-ghost btn-sm"
                          style={{ flex: "1 1 80px", minWidth: 0 }}
                        >
                          {v} TND
                        </button>
                      ))}
                    </div>

                    {/* Trust note */}
                    <div className="trust" style={{ marginBottom: 18 }}>
                      <Shield />
                      <p>
                        <strong>{t.payout.note}</strong>
                        <br />
                        {t.payout.pending}
                      </p>
                    </div>

                    {/* Request button */}
                    <Button
                      type="submit"
                      variant="green"
                      disabled={
                        requested ||
                        !amount ||
                        parseFloat(amount) <= 0 ||
                        parseFloat(amount) > available
                      }
                    >
                      <Wallet />
                      {t.payout.request}
                    </Button>
                  </form>
                </div>
              </div>
            </div>
            {/* end main column */}
          </div>
        </div>
      </section>
      {toast}
    </SiteShell>
  );
}
