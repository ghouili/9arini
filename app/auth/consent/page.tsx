"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field } from "@/components/ui";
import { useLocale } from "@/components/LocaleProvider";
import { Shield, Phone, User } from "@/components/icons";
import { saveConsent } from "@/app/actions";
import { SiteShell } from "@/components/SiteShell";

export default function ConsentPage() {
  const { t } = useLocale();
  const router = useRouter();

  const [gName, setGName] = useState("");
  const [gPhone, setGPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!agreed || !gName.trim() || !gPhone.trim()) return;
    setLoading(true);
    const res = await saveConsent({ guardianName: gName, guardianPhone: gPhone });
    setLoading(false);
    if (res.ok) router.push("/student");
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
                    fontSize: 12,
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
