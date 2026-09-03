"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocalizedRouter } from "@/components/Link";
import { Button, Field, Spinner } from "@/components/ui";
import { useLocale } from "@/components/LocaleProvider";
import { Shield, Phone, User } from "@/components/icons";
import { saveConsent } from "@/app/actions";
import { SiteShell } from "@/components/SiteShell";
import { safeNext } from "@/lib/validation";

/* Guardian consent sits in the middle of a flow: middleware.ts / /live bounce a
   guest to /auth?next=<path> (e.g. /checkout?class=x), the OTP is verified, and a
   MINOR is routed here before they may use the app. ?next= is forwarded to this
   page; we hand the student back to it once consent is signed, instead of dumping
   them on /student and losing the booking they came for. That value may itself
   point at /student/welcome carrying a further ?next= — see lib/auth-destination.ts
   for the chain.

   The open-redirect guard for it is safeNext() in lib/validation.ts. It used to be
   a VERBATIM COPY sitting right here, under a comment conceding that the rule
   "must not drift silently; if you change one, change both" — which describes a
   bug waiting to happen rather than a mitigation. One implementation, and every
   caller (this page, /auth, /signup/prof, /signup/eleve, /student/welcome) gets
   the same answer. */

/* useSearchParams() opts the subtree into client-side rendering. Without a
   <Suspense> boundary `next build` fails the whole route on the CSR bailout —
   same reason app/auth/page.tsx is wrapped. */
export default function ConsentPage() {
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
      <ConsentInner />
    </Suspense>
  );
}

function ConsentInner() {
  const { t } = useLocale();
  const router = useLocalizedRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));

  const [gName, setGName] = useState("");
  const [gPhone, setGPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!agreed || !gName.trim() || !gPhone.trim()) return;
    setLoading(true);
    setError(null);
    let res: Awaited<ReturnType<typeof saveConsent>>;
    try {
      res = await saveConsent({ guardianName: gName, guardianPhone: gPhone });
    } catch {
      // Network hiccup on 3G — never leave a legal consent silently un-saved.
      setLoading(false);
      setError(t.extra.error);
      return;
    }
    setLoading(false);
    // Consent signed → resume whatever the student was doing (a /checkout?class=x
    // they were bounced out of), else the student home. `next` is already
    // validated by safeNext(): a relative, same-origin path.
    if (res.ok) router.push(next ?? "/student");
    else setError(t.extra.error);
  }

  const canSubmit = agreed && gName.trim().length > 0 && gPhone.trim().length > 0 && !loading;

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
                marginBottom: 24,
                color: "var(--ink)",
              }}
            >
              {t.consent.title}
            </h1>

            {/* INPDP trust block */}
            <div
              style={{
                display: "flex",
                gap: 14,
                alignItems: "flex-start",
                padding: "16px",
                background: "var(--blue50)",
                borderRadius: "var(--r)",
                marginBottom: 24,
              }}
            >
              <Shield
                style={{
                  color: "var(--blue)",
                  width: 26,
                  height: 26,
                  flexShrink: 0,
                  marginTop: 2,
                }}
              />
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--blue)",
                    marginBottom: 6,
                    letterSpacing: 0.3,
                    textTransform: "uppercase",
                  }}
                >
                  INPDP
                </p>
                <p style={{ fontSize: 13, color: "var(--ink2)", lineHeight: 1.6 }}>
                  {t.consent.body}
                </p>
              </div>
            </div>

            {/* Guardian name */}
            <Field label={t.consent.gName}>
              <div className="inp">
                <User />
                <input
                  type="text"
                  placeholder="…"
                  value={gName}
                  onChange={(e) => setGName(e.target.value)}
                  autoComplete="name"
                  style={{ minWidth: 0 }}
                />
              </div>
            </Field>

            {/* Guardian phone */}
            <Field label={t.consent.gPhone}>
              <div className="inp">
                <Phone />
                <input
                  type="tel"
                  dir="ltr"
                  placeholder="+216 …"
                  value={gPhone}
                  onChange={(e) => setGPhone(e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  style={{ minWidth: 0 }}
                />
              </div>
            </Field>

            {/* Checkbox agreement */}
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                cursor: "pointer",
                padding: "14px",
                border: agreed ? "1.6px solid var(--blue)" : "1.6px solid var(--line)",
                borderRadius: "var(--r-s)",
                background: agreed ? "var(--blue50)" : "var(--paper)",
                marginBottom: 22,
                transition: ".16s",
              }}
            >
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{
                  width: 18,
                  height: 18,
                  accentColor: "var(--blue)",
                  flexShrink: 0,
                  marginTop: 2,
                  cursor: "pointer",
                }}
              />
              <span
                style={{
                  fontSize: 13,
                  color: agreed ? "var(--blue)" : "var(--ink2)",
                  lineHeight: 1.55,
                  fontWeight: agreed ? 600 : 400,
                }}
              >
                {t.consent.agree}
              </span>
            </label>

            {/* Error display — role="alert" so screen readers announce a failed save */}
            {error && (
              <p
                role="alert"
                style={{
                  color: "var(--rose)",
                  fontSize: 13,
                  fontWeight: 600,
                  lineHeight: 1.5,
                  margin: "0 0 14px",
                  textAlign: "start",
                }}
              >
                {error}
              </p>
            )}

            <Button
              variant="green"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {loading ? t.common.loading : t.consent.submit}
            </Button>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
