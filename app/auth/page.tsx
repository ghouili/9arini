"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field } from "@/components/ui";
import { useLocale } from "@/components/LocaleProvider";
import { Phone, Book, User } from "@/components/icons";
import { requestOtp, verifyOtp } from "@/app/actions";
import { SiteShell } from "@/components/SiteShell";
import type { Role } from "@/lib/types";

type AuthRole = "tutor" | "student";

export default function AuthPage() {
  const { t, locale } = useLocale();
  const router = useRouter();

  const [role, setRole] = useState<AuthRole | null>(null);
  const [phone, setPhone] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSendCode() {
    if (!phone.trim() || !role) return;
    setLoading(true);
    setError(null);
    const res = await requestOtp({ phone });
    setLoading(false);
    if (res.ok) {
      setCodeSent(true);
      setDevCode(res.devCode ?? null);
    } else {
      const ar = locale === "ar";
      if (res.error === "too-soon") {
        setError(
          ar
            ? `استنّى ${res.retryAfter ?? 60} ثانية قبل ما تطلب كود جديد.`
            : `Patiente ${res.retryAfter ?? 60}s avant de redemander un code.`,
        );
      } else if (res.error === "sms-failed") {
        setError(ar ? "تعذّر إرسال الكود. عاود المحاولة." : "Envoi du code impossible. Réessaie.");
      } else if (res.error === "invalid-phone") {
        setError(ar ? "رقم الهاتف موش صحيح." : "Numéro de téléphone invalide.");
      } else {
        setError(t.extra.error);
      }
    }
  }

  async function handleVerify() {
    if (!code.trim() || !role) return;
    setLoading(true);
    setError(null);
    const res = await verifyOtp({ phone, code, role, locale });
    setLoading(false);
    if (!res.ok) {
      setError(t.extra.error);
      return;
    }
    if (res.role === "tutor") router.push("/onboarding");
    else if (res.needsConsent) router.push("/auth/consent");
    else router.push("/student");
  }

  const roleCards: { id: AuthRole; label: string }[] = [
    { id: "tutor", label: t.auth.asTutor },
    { id: "student", label: t.auth.asStudent },
  ];

  return (
    <SiteShell>
      <section className="web-section">
        <div className="container container-narrow" style={{ display: "flex", justifyContent: "center" }}>
          <div
            className="panel panel-pad rise"
            style={{
              width: "100%",
              maxWidth: 460,
              minWidth: 0,
            }}
          >
            {/* Title */}
            <h1
              style={{
                fontFamily: "var(--fd)",
                fontSize: "clamp(22px, 4vw, 28px)",
                letterSpacing: "-0.6px",
                marginBottom: 6,
                color: "var(--ink)",
              }}
            >
              {t.auth.title}
            </h1>
            <p style={{ fontSize: 13.5, color: "var(--muted)", marginBottom: 24 }}>
              {t.auth.pending}
            </p>

            {/* Role selection */}
            <div style={{ marginBottom: 20 }}>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 10,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                }}
              >
                {t.account.role}
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                {roleCards.map(({ id, label }) => {
                  const active = role === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setRole(id)}
                      aria-pressed={active}
                      style={{
                        border: active ? "2px solid var(--blue)" : "1.6px solid var(--line)",
                        borderRadius: "var(--r)",
                        padding: "clamp(12px, 2.5vw, 18px) 10px",
                        background: active ? "var(--blue50)" : "var(--paper)",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        fontWeight: 700,
                        fontSize: 14,
                        color: active ? "var(--blue)" : "var(--ink2)",
                        textAlign: "center",
                        transition: ".16s",
                        boxShadow: active ? "0 0 0 3px rgba(14,90,166,.12)" : "none",
                        minHeight: 44,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        minWidth: 0,
                        width: "100%",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          color: active ? "var(--blue)" : "var(--muted)",
                        }}
                      >
                        {id === "tutor" ? (
                          <Book style={{ width: 24, height: 24 }} />
                        ) : (
                          <User style={{ width: 24, height: 24 }} />
                        )}
                      </span>
                      <span style={{ display: "block", lineHeight: 1.2 }}>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Phone field */}
            <Field label={t.auth.phone}>
              <div className="inp">
                <Phone className="" />
                <input
                  type="tel"
                  placeholder={t.auth.phonePh}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  disabled={codeSent}
                  style={{ minWidth: 0 }}
                />
              </div>
            </Field>

            {/* Error display */}
            {error && (
              <p
                style={{
                  color: "var(--rose)",
                  fontSize: 12.5,
                  margin: "0 0 12px",
                  textAlign: "center",
                }}
              >
                {error}
              </p>
            )}

            {!codeSent ? (
              <Button
                variant="primary"
                onClick={handleSendCode}
                disabled={loading || !phone.trim() || !role}
              >
                {loading ? t.common.loading : t.auth.sendCode}
              </Button>
            ) : (
              <div className="rise">
                {/* Dev code note */}
                {devCode && (
                  <div
                    style={{
                      marginBottom: 12,
                      padding: "10px 12px",
                      background: "var(--green50)",
                      borderRadius: "var(--r-s)",
                      fontSize: 12.5,
                      color: "#13724f",
                      textAlign: "center",
                    }}
                  >
                    Code (dev) :{" "}
                    <b style={{ fontFamily: "var(--fd)", letterSpacing: 2 }}>{devCode}</b>
                  </div>
                )}

                {/* OTP code field */}
                <Field label={t.auth.code}>
                  <div className="inp">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="• • • • • •"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      style={{
                        letterSpacing: 6,
                        fontFamily: "var(--fd)",
                        fontSize: 18,
                        minWidth: 0,
                      }}
                      autoComplete="one-time-code"
                      autoFocus
                    />
                  </div>
                </Field>

                <Button
                  variant="green"
                  onClick={handleVerify}
                  disabled={loading || code.length < 4}
                >
                  {loading ? t.common.loading : t.auth.verify}
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
