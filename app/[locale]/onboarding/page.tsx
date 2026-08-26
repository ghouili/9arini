"use client";
import { useState } from "react";
import { Link } from "@/components/Link";
import { Button, Field, Avatar } from "@/components/ui";
import { Eye, Check, Shield } from "@/components/icons";
import { useLocale } from "@/components/LocaleProvider";
import { SiteShell } from "@/components/SiteShell";
import { createTutor } from "@/app/actions";
import { useToast } from "@/components/useToast";

/* Page-local copy (FR + Tunisian Derija). lib/i18n.ts is shared/read-only, and
   two of its strings can't be used here:
     • t.onboarding.fine promises "9arini prend 12 %" — during the pilot 9arini
       takes 0 % and touches no money, so we say that instead.
     • the live preview needs its own placeholder + status labels. */
const copy = {
  fr: {
    yourName: "Ton nom…",
    steps: ["Ta page", "Vérification", "Ta 1ʳᵉ classe"],
    stepOf: (a: number, b: number) => `Étape ${a} sur ${b}`,
    fine: "Gratuit, sans carte. Zéro commission pendant le pilote : l'élève te paie directement.",
    perks: [
      "Ta page prête en 2 minutes",
      "Tu fixes ton prix, tu gardes 100 %",
      "Vérification à la main par notre équipe",
    ],
    previewNote: "Voilà ce que tes élèves verront.",
    notPublic: "Pas encore publique",
    publishedTitle: "Ta page est créée",
    publishedBody: "Dernière étape : envoie ta pièce d'identité. On vérifie à la main, puis ta page passe en ligne et apparaît dans Explorer.",
  },
  ar: {
    yourName: "اسمك…",
    steps: ["صفحتك", "التثبّت", "أول حصة"],
    stepOf: (a: number, b: number) => `مرحلة ${a} من ${b}`,
    fine: "فابور، بلا كارت. بلا عمولة في فترة التجربة : التلميذ يخلّصك مباشرة.",
    perks: [
      "صفحتك حاضرة في دقيقتين",
      "إنتي تحدّد ثمنك، وتحتفظ بـ 100 %",
      "التثبّت يتعمل بيدينا",
    ],
    previewNote: "هكّا باش يشوفوك تلامذتك.",
    notPublic: "ما زالت مش ظاهرة",
    publishedTitle: "صفحتك تعملت",
    publishedBody: "آخر مرحلة : ابعث بطاقة تعريفك. نتثبّتو بيدينا، ومن بعد صفحتك تولّي أونلاين وتبان في «اكتشف».",
  },
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
  const c = copy[locale];
  const { toast, showToast } = useToast();

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bio, setBio] = useState("");
  const [published, setPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const slug = slugify(name);
  const inits = initials(name);
  const step = published ? 2 : 1;

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
              {/* Progress — named steps, so "étape 2/3" means something */}
              <div
                role="progressbar"
                aria-valuemin={1}
                aria-valuemax={3}
                aria-valuenow={step}
                aria-valuetext={`${c.stepOf(step, 3)} — ${c.steps[step - 1]}`}
                style={{ marginBottom: 22, maxWidth: 420 }}
              >
                <div style={{ display: "flex", gap: 6 }}>
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      style={{
                        height: 5, flex: 1, borderRadius: 9,
                        background: i <= step ? "var(--ochre)" : "var(--line)",
                        transition: "background .3s",
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 7 }}>
                  {c.steps.map((label, i) => (
                    <div
                      key={label}
                      style={{
                        flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: 700,
                        color: i + 1 <= step ? "var(--ink2)" : "var(--muted)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}
                    >
                      {i + 1}. {label}
                    </div>
                  ))}
                </div>
              </div>

              <h1 className="web-h2" style={{ marginBottom: 8 }}>{t.onboarding.title}</h1>
              <p className="web-lead" style={{ marginBottom: 18, maxWidth: 520 }}>{t.onboarding.lead}</p>

              {/* What they actually get — three facts, no promises we can't keep */}
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8, marginBottom: 26, maxWidth: 520 }}>
                {c.perks.map((p) => (
                  <li key={p} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13.5, color: "var(--ink2)", lineHeight: 1.5 }}>
                    <Check style={{ width: 16, height: 16, color: "var(--green)", flex: "none", marginTop: 2 }} />
                    <span style={{ minWidth: 0 }}>{p}</span>
                  </li>
                ))}
              </ul>

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
                    <span style={{ fontWeight: 600, color: slug ? "var(--ink)" : "var(--muted)", fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {slug || "…"}
                    </span>
                  </div>
                </Field>

                {published ? (
                  /* Created ≠ live: the page only goes public after verification. */
                  <div
                    className="panel panel-pad"
                    style={{ marginTop: 8, background: "var(--green50)", border: "1px solid var(--green)" }}
                  >
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ color: "var(--green)", display: "inline-flex", flex: "none", marginTop: 1 }} aria-hidden="true">
                        <Check />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: "var(--fd)", fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                          {c.publishedTitle}
                        </div>
                        <p style={{ fontSize: 13, color: "var(--ink2)", lineHeight: 1.6 }}>{c.publishedBody}</p>
                      </div>
                    </div>
                    <div style={{ marginTop: 14, maxWidth: 360 }}>
                      <Link href="/onboarding/verify" className="btn btn-primary">
                        <Shield style={{ width: 18, height: 18 }} />
                        {t.verif.draftCta}
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div style={{ maxWidth: 360, marginTop: 6 }}>
                    <Button variant="primary" onClick={handlePublish} disabled={!name || !subject || publishing}>
                      {publishing ? t.common.loading : t.onboarding.cta}
                    </Button>
                    <p style={{ textAlign: "center", fontSize: 11.5, color: "var(--muted)", marginTop: 11, lineHeight: 1.5 }}>
                      {c.fine}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Live preview column (sticky on desktop) ── */}
            <div style={{ minWidth: 0 }}>
              <div className="panel panel-pad" style={{ position: "sticky", top: 84, background: "var(--sand)", border: "1px solid var(--line)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 7 }}>
                    <Eye style={{ width: 14, height: 14 }} /> {t.onboarding.preview}
                  </span>
                  {/* No fake "Vérifié" badge here: the account is not verified yet. */}
                  <span className="chip chip-sand" style={{ marginInlineStart: "auto", flex: "none" }}>{c.notPublic}</span>
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "center", background: "var(--paper)", borderRadius: 13, padding: 14 }}>
                  <Avatar initials={name ? inits : "??"} size={52} square />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--fd)", fontSize: 16, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {name || <span style={{ color: "var(--muted)" }}>{c.yourName}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {subject || t.onboarding.subjectPh}
                    </div>
                  </div>
                </div>

                {bio && (
                  <p style={{ fontSize: 13, color: "var(--ink2)", lineHeight: 1.6, marginTop: 14 }}>{bio}</p>
                )}
                <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 14, lineHeight: 1.5 }}>{c.previewNote}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      {toast}
    </SiteShell>
  );
}
