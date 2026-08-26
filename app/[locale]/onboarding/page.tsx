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
    progressLabel: "Progression de ton inscription",
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
    progressLabel: "تقدّم التسجيل متاعك",
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
            <div className="min-w-0">
              {/* Progress — named steps, so "étape 2/3" means something */}
              <div
                role="progressbar"
                aria-label={c.progressLabel}
                aria-valuemin={1}
                aria-valuemax={3}
                aria-valuenow={step}
                aria-valuetext={`${c.stepOf(step, 3)} — ${c.steps[step - 1]}`}
                className="mb-[22px] max-w-[420px]"
              >
                <div className="flex gap-1.5">
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
                <div className="flex gap-1.5 mt-[7px]">
                  {c.steps.map((label, i) => (
                    <div
                      key={label}
                      style={{
                        flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700,
                        color: i + 1 <= step ? "var(--ink2)" : "var(--muted)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}
                    >
                      {i + 1}. {label}
                    </div>
                  ))}
                </div>
              </div>

              <h1 className="web-h2 mb-2">{t.onboarding.title}</h1>
              <p className="web-lead mb-[18px] max-w-[520px]">{t.onboarding.lead}</p>

              {/* What they actually get — three facts, no promises we can't keep */}
              <ul className="list-none flex flex-col gap-2 mb-[26px] max-w-[520px]">
                {c.perks.map((p) => (
                  <li key={p} className="flex items-start gap-[9px] text-[13.5px] text-ink2 leading-[1.5]">
                    <Check className="w-4 h-4 text-green flex-none mt-0.5" />
                    <span className="min-w-0">{p}</span>
                  </li>
                ))}
              </ul>

              <div className="max-w-[520px]">
                <Field label={t.onboarding.name}>
                  <div className="inp" style={name ? { borderColor: "var(--blue)" } : {}}>
                    <input type="text" placeholder={t.onboarding.namePh} value={name} onChange={(e) => setName(e.target.value)} className="min-w-0" />
                  </div>
                </Field>

                <Field label={t.onboarding.subject}>
                  <div className="inp" style={subject ? { borderColor: "var(--blue)" } : {}}>
                    <input type="text" placeholder={t.onboarding.subjectPh} value={subject} onChange={(e) => setSubject(e.target.value)} className="min-w-0" />
                  </div>
                </Field>

                <Field label={t.onboarding.bio}>
                  <div className="inp" style={bio ? { borderColor: "var(--blue)" } : {}}>
                    <textarea rows={2} placeholder={t.onboarding.bioPh} value={bio} onChange={(e) => setBio(e.target.value)} style={{ resize: "none", minWidth: 0 }} />
                  </div>
                </Field>

                <Field label={t.onboarding.link}>
                  <div className="inp" dir="ltr" style={slug ? { borderColor: "var(--blue)" } : {}}>
                    <span className="pre whitespace-nowrap shrink-0">9arini.tn/</span>
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
                    <div className="flex gap-2.5 items-start">
                      <span className="text-green inline-flex flex-none mt-[1px]" aria-hidden="true">
                        <Check />
                      </span>
                      <div className="min-w-0">
                        <div className="font-display font-bold text-[15px] mb-1">
                          {c.publishedTitle}
                        </div>
                        <p className="text-[13px] text-ink2 leading-[1.6]">{c.publishedBody}</p>
                      </div>
                    </div>
                    <div className="mt-3.5 max-w-[360px]">
                      <Link href="/onboarding/verify" className="btn btn-primary">
                        <Shield className="w-[18px] h-[18px]" />
                        {t.verif.draftCta}
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-[360px] mt-1.5">
                    <Button variant="primary" onClick={handlePublish} disabled={!name || !subject || publishing}>
                      {publishing ? t.common.loading : t.onboarding.cta}
                    </Button>
                    <p className="text-center text-[13px] text-muted mt-[11px] leading-[1.5]">
                      {c.fine}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Live preview column (sticky on desktop) ── */}
            <div className="min-w-0">
              <div className="panel panel-pad" style={{ position: "sticky", top: 84, background: "var(--sand)", border: "1px solid var(--line)" }}>
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className="text-[13px] font-bold uppercase tracking-[0.6px] text-muted inline-flex items-center gap-[7px]">
                    <Eye className="w-3.5 h-3.5" /> {t.onboarding.preview}
                  </span>
                  {/* No fake "Vérifié" badge here: the account is not verified yet. */}
                  <span className="chip chip-sand ms-auto flex-none">{c.notPublic}</span>
                </div>

                <div className="flex gap-3 items-center bg-paper rounded-[13px] p-3.5">
                  <Avatar initials={name ? inits : "??"} size={52} square />
                  <div className="min-w-0">
                    <div style={{ fontFamily: "var(--fd)", fontSize: 16, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {name || <span className="text-muted">{c.yourName}</span>}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {subject || t.onboarding.subjectPh}
                    </div>
                  </div>
                </div>

                {bio && (
                  <p className="text-[13px] text-ink2 leading-[1.6] mt-3.5">{bio}</p>
                )}
                <p className="text-[13px] text-muted mt-3.5 leading-[1.5]">{c.previewNote}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      {toast}
    </SiteShell>
  );
}
