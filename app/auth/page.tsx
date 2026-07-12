"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Field, Spinner } from "@/components/ui";
import { useLocale } from "@/components/LocaleProvider";
import { Phone, Book, User } from "@/components/icons";
import { requestOtp, verifyOtp } from "@/app/actions";
import { SiteShell } from "@/components/SiteShell";

type AuthRole = "tutor" | "student";

/* Page-local copy for the student birth-year field (lib/i18n.ts stays shared —
   this is auth-specific). Founder decision 2026-07-12: collect birth year at
   student signup; guardian consent is required only for under-18s. */
const BY_COPY = {
  fr: {
    label: "Année de naissance de l'élève",
    ph: "Choisir…",
    note: "Pour un élève de moins de 18 ans, l'accord d'un parent ou tuteur est demandé avant la 1ʳᵉ séance.",
  },
  ar: {
    label: "سنة ولادة التلميذ",
    ph: "اختر…",
    note: "للتلميذ اللي عمرو أقلّ من 18 سنة، تتطلب موافقة الولي قبل الحصة الأولى.",
  },
} as const;

/* Open-redirect guard for ?next=.
   middleware.ts and /live bounce guests here with ?next=<path> (e.g. /live/abc,
   /checkout?class=x). That value is attacker-controllable, so we only ever follow
   it when it is a *relative, same-origin* path:
     • must start with a single "/"
     • "//evil.tn" and "/\evil.tn" are protocol-relative → rejected
     • any backslash, control char, or "scheme:" prefix → rejected
     • "/auth..." → rejected (would loop back into this page)
   Anything suspicious falls through to the normal role-based destination. */
function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v.startsWith("/")) return null;                 // absolute URL or bare word
  if (v.startsWith("//") || v.startsWith("/\\")) return null; // protocol-relative
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(v)) return null;   // "/javascript:…" & friends
  if (v.includes("\\")) return null;                   // "/\evil.tn", backslash tricks
  for (const ch of v) {                                // control chars (CR/LF header smuggling)
    const c = ch.codePointAt(0) ?? 0;
    if (c < 0x20 || c === 0x7f) return null;
  }
  if (v === "/auth" || v.startsWith("/auth/") || v.startsWith("/auth?")) return null;
  return v;
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <SiteShell>
          <section className="web-section">
            <div
              className="container container-narrow"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 240 }}
            >
              <Spinner />
            </div>
          </section>
        </SiteShell>
      }
    >
      <AuthInner />
    </Suspense>
  );
}

function AuthInner() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));

  const [role, setRole] = useState<AuthRole | null>(null);
  const [phone, setPhone] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSendCode() {
    if (!phone.trim() || !role || (role === "student" && !birthYear)) return;
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
    const res = await verifyOtp({ phone, code, role, locale, birthYear: birthYear ? Number(birthYear) : undefined });
    setLoading(false);
    if (!res.ok) {
      setError(t.extra.error);
      return;
    }
    /* Destination priority:
       1. Guardian consent — a minor cannot use the app until it is signed, so it
          wins over everything, ?next= included. We FORWARD ?next= to /auth/consent
          so a minor bounced out of /checkout?class=x resumes their booking once the
          guardian signs, instead of being dumped on /student. /auth/consent re-runs
          the same safeNext() check on it before following it.
       2. ?next= — the page middleware.ts / /live bounced them off of. Already
          validated by safeNext(), so it is a relative, same-origin path.
       3. The role default. */
    if (res.needsConsent) {
      router.push(next ? `/auth/consent?next=${encodeURIComponent(next)}` : "/auth/consent");
    } else if (next) router.push(next);
    else if (res.role === "tutor") router.push("/onboarding");
    else router.push("/student");
  }

  const roleCards: { id: AuthRole; label: string }[] = [
    { id: "tutor", label: t.auth.asTutor },
    { id: "student", label: t.auth.asStudent },
  ];

  const by = BY_COPY[locale === "ar" ? "ar" : "fr"];
  // From a ~5-year-old pupil down to a ~85-year-old learner. Within vBirthYear's
  // accepted range (lib/validation.ts); the server re-validates and fails safe.
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 81 }, (_, i) => currentYear - 5 - i);
  // Students must give a birth year before we send the code (it drives the
  // minor-consent gate); tutors never need it.
  const canSendCode = Boolean(phone.trim() && role && !(role === "student" && !birthYear));

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

            {/* Birth year — students only. Drives the minor-consent gate: under-18
                (or unknown) needs a guardian's consent before the first booking. */}
            {role === "student" && (
              <Field label={by.label}>
                <div className="inp">
                  <select
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    disabled={codeSent}
                    aria-label={by.label}
                    style={{
                      minWidth: 0,
                      width: "100%",
                      border: "none",
                      background: "transparent",
                      font: "inherit",
                      color: birthYear ? "var(--ink)" : "var(--muted)",
                      appearance: "none",
                      cursor: codeSent ? "not-allowed" : "pointer",
                    }}
                  >
                    <option value="" disabled>{by.ph}</option>
                    {years.map((y) => (
                      <option key={y} value={y} style={{ color: "var(--ink)" }}>{y}</option>
                    ))}
                  </select>
                </div>
                <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>{by.note}</p>
              </Field>
            )}

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
                disabled={loading || !canSendCode}
              >
                {loading ? t.common.loading : t.auth.sendCode}
              </Button>
            ) : (
              <div className="rise">
                {/* Dev code note — only ever set when no SMS provider is configured
                    (lib/sms.ts). In production requestOtp() never returns the code. */}
                {devCode && (
                  <div
                    style={{
                      background: "var(--sand)",
                      border: "1.4px dashed var(--ochre)",
                      borderRadius: "var(--r)",
                      padding: "10px 12px",
                      marginBottom: 14,
                      textAlign: "center",
                      fontSize: 12.5,
                      color: "var(--ink2)",
                      lineHeight: 1.5,
                    }}
                  >
                    <b
                      style={{
                        fontFamily: "var(--fd)",
                        fontSize: 18,
                        letterSpacing: 3,
                        color: "var(--ink)",
                        display: "block",
                      }}
                    >
                      {devCode}
                    </b>
                  </div>
                )}

                {/* Code field */}
                <Field label={t.auth.code}>
                  <div className="inp">
                    <input
                      type="text"
                      placeholder="000000"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      style={{ minWidth: 0, letterSpacing: 3, fontFamily: "var(--fd)" }}
                    />
                  </div>
                </Field>

                <Button
                  variant="primary"
                  onClick={handleVerify}
                  disabled={loading || !code.trim() || !role}
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
