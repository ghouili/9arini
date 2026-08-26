"use client";
/* The login screen's interactive body. Split out of app/[locale]/auth/page.tsx,
   which is now a SERVER component.

   Why: this file used to read ?next= with the client search-params hook, which
   forced the whole form into a <Suspense> boundary. Next bails such a boundary
   to CLIENT-ONLY rendering on a statically-rendered route, so the production
   HTML for /fr/auth carried no <h1>, no phone field and no submit button - just
   a spinner. On 3G that is a blank login page for the whole bundle window, and a
   permanently blank one if the bundle never lands. ?next= is now read on the
   server and handed down as a prop, so the form is in the first HTML payload.

   The ?next= open-redirect sanitiser moved to lib/validation.ts: the server page
   calls it, and a function exported from a "use client" module is replaced by a
   client REFERENCE when a server component imports it — calling it server-side
   throws "is not a function". It has to live in a plain module. */
import { useState } from "react";
import { useLocalizedRouter } from "@/components/Link";
import { Button, Field } from "@/components/ui";
import { useLocale } from "@/components/LocaleProvider";
import { Phone, Book, User, Calendar } from "@/components/icons";
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

/* Page-local copy. The shared t.auth.pending string explains our SMS provider
   status ("une fois le fournisseur SMS branché… mode dev") — that is release
   plumbing, not something to greet a visitor with. Plain language instead. */
const A_COPY = {
  fr: {
    lead: "Entre ton numéro : on t'envoie un code par SMS. Pas de mot de passe.",
    tutorSub: "Je veux enseigner",
    studentSub: "Je cherche un prof",
    sentTo: (p: string) => `Code envoyé au ${p}`,
    changeNumber: "Changer de numéro",
    devCodeNote: "Code de test — aucun SMS n'est envoyé pour l'instant",
    codeHelp: "6 chiffres.",
  },
  ar: {
    lead: "حطّ نمرتك : نبعثولك كود بالـSMS. بلا كلمة سرّ.",
    tutorSub: "نحب نقرّي",
    studentSub: "نلوّج على أستاذ",
    sentTo: (p: string) => `الكود تبعث لـ ${p}`,
    changeNumber: "بدّل النمرة",
    devCodeNote: "كود للتجربة — توّا ما يتبعث حتى SMS",
    codeHelp: "6 أرقام.",
  },
} as const;


export function AuthInner({ next }: { next: string | null }) {
  const { t, locale } = useLocale();
  const router = useLocalizedRouter();

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
    let res: Awaited<ReturnType<typeof requestOtp>>;
    try {
      res = await requestOtp({ phone });
    } catch {
      // Network hiccup on 3G — never leave the button stuck on "Chargement…".
      setLoading(false);
      setError(t.extra.error);
      return;
    }
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
    let res: Awaited<ReturnType<typeof verifyOtp>>;
    try {
      res = await verifyOtp({ phone, code, role, locale, birthYear: birthYear ? Number(birthYear) : undefined });
    } catch {
      // Network hiccup on 3G — reset the button and let them retry.
      setLoading(false);
      setError(t.extra.error);
      return;
    }
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

  const a = A_COPY[locale === "ar" ? "ar" : "fr"];
  const roleCards: { id: AuthRole; label: string; sub: string }[] = [
    { id: "tutor", label: t.auth.asTutor, sub: a.tutorSub },
    { id: "student", label: t.auth.asStudent, sub: a.studentSub },
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
        <div className="container container-narrow flex justify-center">
          <div
            className="panel panel-pad rise w-full max-w-[460px] min-w-0"
          >
            {/* Title */}
            <h1
              className="font-display text-[clamp(22px,_4vw,_28px)] tracking-[-0.6px] mb-1.5 text-ink"
            >
              {t.auth.title}
            </h1>
            <p className="text-[13.5px] text-muted mb-6 leading-[1.55]">
              {a.lead}
            </p>

            {/* Role selection */}
            <div className="mb-5">
              <p
                id="auth-role-label"
                className="text-[13px] font-bold mb-2.5 text-muted uppercase tracking-[0.4px]"
              >
                {t.account.role}
              </p>
              <div
                role="group"
                aria-labelledby="auth-role-label"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                {roleCards.map(({ id, label, sub }) => {
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
                          <Book className="w-6 h-6" />
                        ) : (
                          <User className="w-6 h-6" />
                        )}
                      </span>
                      <span className="block leading-[1.2] min-w-0">{label}</span>
                      <span
                        style={{
                          display: "block", lineHeight: 1.3, fontSize: 13, fontWeight: 600,
                          color: active ? "var(--blue)" : "var(--muted)", minWidth: 0,
                        }}
                      >
                        {sub}
                      </span>
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
                  dir="ltr"
                  placeholder={t.auth.phonePh}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  disabled={codeSent}
                  className="min-w-0"
                />
              </div>
            </Field>

            {/* Birth year — students only. Drives the minor-consent gate: under-18
                (or unknown) needs a guardian's consent before the first booking. */}
            {role === "student" && (
              <Field label={by.label}>
                <div className="inp">
                  <Calendar className="" />
                  <select
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    disabled={codeSent}
                    required
                    aria-required="true"
                    aria-label={by.label}
                    style={{
                      minWidth: 0,
                      width: "100%",
                      border: "none",
                      background: "transparent",
                      font: "inherit",
                      color: birthYear ? "var(--ink)" : "var(--muted)",
                      cursor: codeSent ? "not-allowed" : "pointer",
                    }}
                  >
                    <option value="" disabled>{by.ph}</option>
                    {years.map((y) => (
                      <option key={y} value={y} className="text-ink">{y}</option>
                    ))}
                  </select>
                </div>
                <p className="text-[13px] text-muted mt-1.5 leading-[1.5]">{by.note}</p>
              </Field>
            )}

            {/* Error display — role="alert" so screen readers announce it on change */}
            {error && (
              <p
                role="alert"
                style={{
                  color: "var(--rose)",
                  fontSize: 13,
                  fontWeight: 600,
                  lineHeight: 1.5,
                  margin: "0 0 12px",
                  textAlign: "start",
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
                {/* Where the code went + an escape hatch if the number is wrong. */}
                <div
                  className="flex items-center justify-between gap-2.5 flex-wrap mb-3.5"
                >
                  <span className="text-[13px] text-ink2 min-w-0">
                    {a.sentTo(phone.trim())}
                  </span>
                  <button
                    type="button"
                    className="linklike"
                    onClick={() => { setCodeSent(false); setCode(""); setDevCode(null); setError(null); }}
                    style={{ background: 0, border: 0, fontSize: 13, minHeight: 44, flex: "none", fontFamily: "inherit" }}
                  >
                    {a.changeNumber}
                  </button>
                </div>

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
                      fontSize: 13,
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
                        direction: "ltr",
                      }}
                    >
                      {devCode}
                    </b>
                    {a.devCodeNote}
                  </div>
                )}

                {/* Code field */}
                <Field label={t.auth.code} help={a.codeHelp}>
                  <div className="inp">
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="000000"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      className="min-w-0 tracking-[3px] font-display"
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
