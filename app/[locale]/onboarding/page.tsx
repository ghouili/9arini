"use client";
import { useState } from "react";
import { Link } from "@/components/Link";
import { Button, Field, Avatar, Verified } from "@/components/ui";
import { Eye } from "@/components/icons";
import { useLocale } from "@/components/LocaleProvider";
import { SiteShell } from "@/components/SiteShell";
import { createTutor } from "@/app/actions";
import { useToast } from "@/components/useToast";

/* Page-local copy (FR + Tunisian Derija). lib/i18n.ts is shared/owned elsewhere;
   this covers the live-preview placeholders that aren't in the dictionary. */
const copy = {
  fr: { yourName: "Ton nom…" },
  ar: { yourName: "اسمك…" },
} as const;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function OnboardingPage() {
  const { t, locale } = useLocale();
  const c = copy[locale === "ar" ? "ar" : "fr"];
  const { toast, showToast } = useToast();

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bio, setBio] = useState("");
  const [published, setPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const slug = slugify(name);
  const inits = initials(name);
  const step = name && subject ? 2 : 1;

  async function handlePublish() {
    if (publishing) return;
    setPublishing(true);
    try {
      const res = await createTutor({ name, subject, bio, slug });
      if (res.ok) {
        showToast(res.demo ? `${t.onboarding.done} · ${t.common.demoMode}` : t.onboarding.done);
        setPublished(true);
      } else {
        showToast(t.extra.error);
      }
    } catch {
      showToast(t.extra.error);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <SiteShell>
      <section className="web-section">
        <div className="container">
          <div className="web-hero">
            {/* ── Form column ── */}
            <div style={{ minWidth: 0 }}>
              {/* Progress */}
              <div
                role="progressbar"
                aria-valuemin={1}
                aria-valuemax={3}
                aria-valuenow={step}
                aria-valuetext={t.onboarding.step(step, 3)}
                aria-label={t.onboarding.step(step, 3)}
                style={{ display: "flex", gap: 6, marginBottom: 20, maxWidth: 360 }}
              >
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ height: 5, flex: 1, borderRadius: 9, background: i <= step ? "var(--ochre)" : "var(--line)", transition: "background .3s" }} />
                ))}
              </div>

              <h1 className="web-h2" style={{ marginBottom: 8 }}>{t.onboarding.title}</h1>
              <p className="web-lead" style={{ marginBottom: 26, maxWidth: 520 }}>{t.onboarding.lead}</p>

              <div style={{ maxWidth: 520 }}>
                <Field label={t.onboarding.name}>
                  <div className="inp" style={name ? { borderColor: "var(--blue)" } : {}}>
                    <input type="text" placeholder={t.onboarding.namePh} value={name} onChange={(e) => setName(e.target.value)} style={{ minWidth: 0 }} />
                  </div>
                </Field>

                <Field label={t.onboarding.subject}>
                  <div className="inp" style={subject ? { borderColor: "var(--blue)" } : {}}>
                    <input type="text" placeholder={t.onboarding.subjectPh} value={subject} onChange={(e) => setSubject(e.target.value)} style={{ minWidth: 0 }} />
                  </div>
                </Field>

                <Field label={t.onboarding.bio}>
                  <div className="inp" style={bio ? { borderColor: "var(--blue)" } : {}}>
                    <textarea rows={2} placeholder={t.onboarding.bioPh} value={bio} onChange={(e) => setBio(e.target.value)} style={{ resize: "none", minWidth: 0 }} />
                  </div>
                </Field>

                <Field label={t.onboarding.link}>
                  <div className="inp" dir="ltr" style={slug ? { borderColor: "var(--blue)" } : {}}>
                    <span className="pre" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>9arini.tn/</span>
                    <span style={{ fontWeight: 600, color: slug ? "var(--ink)" : "var(--muted)", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {slug || "…"}
                    </span>
                  </div>
                </Field>

                <div style={{ maxWidth: 360, marginTop: 6 }}>
                  {published ? (
                    <Link href="/onboarding/verify" className="btn btn-primary">{t.verif.draftCta}</Link>
                  ) : (
                    <Button variant="primary" onClick={handlePublish} disabled={!name || !subject || publishing}>
                      {publishing ? t.common.loading : t.onboarding.cta}
                    </Button>
                  )}
                  <p style={{ textAlign: "center", fontSize: 11.5, color: "var(--muted)", marginTop: 11 }}>{t.onboarding.fine}</p>
                </div>
              </div>
            </div>

            {/* ── Live preview column (sticky on desktop) ── */}
            <div style={{ minWidth: 0 }}>
              <div className="panel panel-pad" style={{ position: "sticky", top: 84, background: "var(--sand)", border: "1px solid var(--line)" }}>
                <div className="plbl" style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--muted)", marginBottom: 12, display: "flex", alignItems: "center", gap: 7 }}>
                  <Eye style={{ width: 14, height: 14 }} /> {t.onboarding.preview}
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center", background: "var(--paper)", borderRadius: 13, padding: 14 }}>
                  <Avatar initials={name ? inits : "??"} size={52} square />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--fd)", fontSize: 16, display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      {name || <span style={{ color: "var(--muted)" }}>{c.yourName}</span>}
                      {name && <Verified />}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {subject || t.onboarding.subjectPh}
                    </div>
                  </div>
                </div>
                {bio && (
                  <p style={{ fontSize: 13, color: "var(--ink2)", lineHeight: 1.6, marginTop: 14 }}>{bio}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      {toast}
    </SiteShell>
  );
}
