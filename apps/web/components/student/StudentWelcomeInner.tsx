"use client";
/* /student/welcome — the student half of onboarding.

   IT DID NOT EXIST. A student gave a phone number and a birth year and went
   straight into the product, so `profiles.full_name` was null for every student,
   forever — nothing else ever wrote it (createTutor was the only writer). Three
   surfaces lied as a direct result:

     • the tutor's booking list showed "Élève" plus a raw phone number as the ONLY
       handle they had on a child they were about to teach
     • the new_booking notification read "Un élève a réservé …", always
     • public reviews shipped with no author (publicName(null) → null)

   So this screen is not decoration for symmetry with the tutor flow. It is the
   step that makes the tutor's side of the product tell the truth.

   IT IS SKIPPABLE, deliberately. It sits between logging in and using the product,
   and a student who arrived here mid-booking (?next=/checkout?class=x) must never
   lose that booking to an onboarding screen. Skipping keeps ?next= and asks again
   on the next login (verifyOtp recomputes needsProfile every time). */
import { useState } from "react";
import { useLocalizedRouter } from "@/components/Link";
import { Button, Field } from "@/components/ui";
import { ProgressSteps } from "@/components/ProgressSteps";
import type { ProgressSeg } from "@/components/ProgressSteps";
import { useLocale } from "@/components/LocaleProvider";
import { User, Book, Phone } from "@/components/icons";
import { saveStudentProfile } from "@/app/actions";
import { SiteShell } from "@/components/SiteShell";
import { STUDENT_LEVELS } from "@tnajem/shared";
import type { StudentLevel, StudentProfile } from "@tnajem/shared";

const COPY = {
  fr: {
    steps: ["Ton compte", "Ton profil", "Ta 1ʳᵉ séance"],
    progressLabel: "Progression de ton inscription",
    stepOf: (a: number, b: number) => `Étape ${a} sur ${b}`,

    title: "Bienvenue — dis-nous qui tu es",
    lead: "Deux champs. Ton prof voit ton nom quand tu réserves, et on te propose les bons profs.",

    name: "Ton prénom et ton nom",
    namePh: "ex. Amine Karoui",
    nameHelp: "Ton prof voit ton prénom quand tu réserves — rien d'autre. Ton numéro et ton email ne lui sont jamais montrés.",

    level: "Ton niveau",
    levelPh: "Choisir…",

    phone: "Ton numéro (optionnel)",
    phonePh: "+216 …",
    phoneHelp: "Pour que ton prof puisse te joindre avant la séance. On ne l'affiche jamais publiquement.",
    errPhone: "Ce numéro n'est pas valide.",

    subjects: "Les matières qui t'intéressent",
    subjectsHelp: "Optionnel. Choisis-en autant que tu veux.",

    save: "Continuer",
    saving: "Enregistrement…",
    skip: "Plus tard",

    errName: "Écris ton prénom et ton nom (2 caractères minimum).",
    errAuth: "Ta session a expiré. Reconnecte-toi.",
    errGeneric: "L'enregistrement n'a pas marché. Réessaie.",
  },
  ar: {
    steps: ["حسابك", "بروفايلك", "أول حصة"],
    progressLabel: "تقدّم التسجيل متاعك",
    stepOf: (a: number, b: number) => `مرحلة ${a} من ${b}`,

    title: "مرحبا — قلّنا شكون إنتي",
    lead: "زوز خانات. أستاذك يشوف اسمك كي تحجز، وأحنا نقترحولك الأساتذة اللي يلزموك.",

    name: "اسمك ولقبك",
    namePh: "مثال: أمين القروي",
    nameHelp: "أستاذك يشوف إسمك الأول كي تحجز — والو أكثر. نمرتك والإيميل متاعك عمرهم ما يتورّاولو.",

    level: "مستواك",
    levelPh: "اختر…",

    phone: "نمرتك (اختياري)",
    phonePh: "+216 …",
    phoneHelp: "باش أستاذك ينجم يتصل بيك قبل الحصة. ما نظهروهاش للناس.",
    errPhone: "هذي النمرة موش صحيحة.",

    subjects: "المواد اللي تهمّك",
    subjectsHelp: "اختياري. اختار قدّ ما تحب.",

    save: "كمّل",
    saving: "قاعد يتسجّل…",
    skip: "من بعد",

    errName: "اكتب اسمك ولقبك (حرفين على الأقل).",
    errAuth: "الجلسة متاعك سالات. عاود ادخل.",
    errGeneric: "التسجيل ما مشاش. عاود حاول.",
  },
} as const;

/* Labels for the closed level set in lib/types.ts (STUDENT_LEVELS). The Tunisian
   school ladder, in order — not alphabetical. */
const LEVEL_LABEL: Record<StudentLevel, { fr: string; ar: string }> = {
  primaire: { fr: "Primaire", ar: "ابتدائي" },
  college: { fr: "Collège", ar: "إعدادي" },
  lycee: { fr: "Lycée", ar: "ثانوي" },
  bac: { fr: "Bac", ar: "باكالوريا" },
  superieur: { fr: "Supérieur", ar: "جامعي" },
  autre: { fr: "Autre", ar: "أخرى" },
};

/* Suggestions only — saveStudentProfile accepts any bounded strings, so this list
   can grow without a migration. Kept short so it stays scannable on a 320px phone. */
const SUBJECTS = [
  { fr: "Maths", ar: "رياضيات" },
  { fr: "Physique", ar: "فيزياء" },
  { fr: "SVT", ar: "علوم الحياة" },
  { fr: "Français", ar: "فرنسية" },
  { fr: "Anglais", ar: "إنقليزية" },
  { fr: "Arabe", ar: "عربية" },
  { fr: "Histoire-Géo", ar: "تاريخ وجغرافيا" },
  { fr: "Philosophie", ar: "فلسفة" },
  { fr: "Informatique", ar: "إعلامية" },
  { fr: "Économie", ar: "اقتصاد" },
] as const;

// saveStudentProfile caps the list at 8; stop the user at the same number rather
// than silently dropping their last choices on the server.
const MAX_SUBJECTS = 8;

export function StudentWelcomeInner({
  next,
  initial,
}: {
  next: string | null;
  initial: StudentProfile;
}) {
  const { locale } = useLocale();
  const c = COPY[locale];
  const router = useLocalizedRouter();

  const [name, setName] = useState(initial.fullName ?? "");
  const [level, setLevel] = useState<string>(initial.level ?? "");
  const [subjects, setSubjects] = useState<string[]>(initial.subjects);
  /* Optional CONTACT number. Signup is by email now, so this is where a student's
     phone is collected — and it is what keeps the tutor's call button working. */
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Where they go once this screen is done — the booking they were mid-way through,
  // or their own home. Already sanitised by safeNext() in the server shell.
  const done = next ?? "/student";

  function toggleSubject(s: string) {
    setSubjects((cur) =>
      cur.includes(s) ? cur.filter((x) => x !== s) : cur.length >= MAX_SUBJECTS ? cur : [...cur, s],
    );
  }

  async function handleSave() {
    if (saving) return;
    if (name.trim().length < 2) { setError(c.errName); return; }
    setSaving(true);
    setError(null);
    let res: Awaited<ReturnType<typeof saveStudentProfile>>;
    try {
      res = await saveStudentProfile({ fullName: name, level: level || null, subjects, phone: phone || null });
    } catch {
      // Network hiccup on 3G — never leave the button stuck on "Enregistrement…".
      setSaving(false);
      setError(c.errGeneric);
      return;
    }
    setSaving(false);
    if (res.ok) { router.push(done); return; }
    if (res.error === "not-authenticated") setError(c.errAuth);
    else if (res.error === "invalid-phone") setError(c.errPhone);
    else setError(c.errGeneric);
  }

  /* Step 1 (the account) is done — they are signed in and reading this. Step 3 is
     the first booking, which lives on /explore. */
  const segs: ProgressSeg[] = c.steps.map((short, i) => ({
    key: String(i),
    short,
    tone: i === 0 ? "done" : i === 1 ? "active" : "todo",
  }));

  return (
    <SiteShell>
      <section className="web-section">
        <div className="container container-narrow flex justify-center">
          <div className="panel panel-pad rise w-full max-w-[520px] min-w-0">
            <ProgressSteps
              label={c.progressLabel}
              segs={segs}
              current={2}
              valueText={`${c.stepOf(2, segs.length)} — ${c.steps[1]}`}
            />

            <h1 className="font-display text-[clamp(22px,_4vw,_28px)] tracking-[-0.6px] mb-1.5 text-ink">
              {c.title}
            </h1>
            <p className="text-[13.5px] text-muted mb-6 leading-[1.55]">{c.lead}</p>

            <Field label={c.name} help={c.nameHelp}>
              <div className="inp" style={name ? { borderColor: "var(--blue)" } : undefined}>
                <User className="" />
                <input
                  type="text"
                  placeholder={c.namePh}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  maxLength={80}
                  className="min-w-0"
                />
              </div>
            </Field>

            <Field label={c.level}>
              <div className="inp" style={level ? { borderColor: "var(--blue)" } : undefined}>
                <Book className="" />
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  aria-label={c.level}
                  className="min-w-0 w-full border-0 bg-transparent font-[inherit]"
                  style={{ color: level ? "var(--ink)" : "var(--muted)" }}
                >
                  <option value="">{c.levelPh}</option>
                  {STUDENT_LEVELS.map((l) => (
                    <option key={l} value={l} className="text-ink">
                      {LEVEL_LABEL[l][locale]}
                    </option>
                  ))}
                </select>
              </div>
            </Field>

            <Field label={c.phone} help={c.phoneHelp}>
              <div className="inp" style={phone ? { borderColor: "var(--blue)" } : undefined}>
                <Phone className="" />
                <input
                  type="tel"
                  dir="ltr"
                  placeholder={c.phonePh}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  className="min-w-0"
                />
              </div>
            </Field>

            {/* Subjects — a real group, not a pile of buttons: screen readers get
                the label and the pressed state of each chip. */}
            <div className="field">
              <span className="field-label" id="sw-subjects-label">{c.subjects}</span>
              <div role="group" aria-labelledby="sw-subjects-label" className="flex flex-wrap gap-2 mt-1">
                {SUBJECTS.map((s) => {
                  const label = s[locale];
                  const on = subjects.includes(label);
                  const full = !on && subjects.length >= MAX_SUBJECTS;
                  return (
                    <button
                      key={s.fr}
                      type="button"
                      onClick={() => toggleSubject(label)}
                      aria-pressed={on}
                      disabled={full}
                      className={`min-h-[44px] px-3.5 rounded-[999px] text-[13.5px] font-semibold border transition-colors ${
                        on
                          ? "border-blue bg-blue50 text-blue"
                          : "border-line bg-paper text-ink2 hover:border-blue disabled:opacity-50 disabled:hover:border-line"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="help">{c.subjectsHelp}</div>
            </div>

            {error && (
              <p role="alert" className="text-rose text-[13px] font-semibold leading-[1.5] mb-3 text-start">
                {error}
              </p>
            )}

            {/* Live, not disabled: handleSave() explains what is missing. */}
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? c.saving : c.save}
            </Button>

            {/* The escape hatch. A booking must never be lost to an onboarding
                screen — `done` carries ?next= either way. */}
            <div className="text-center mt-3.5">
              <button
                type="button"
                onClick={() => router.push(done)}
                className="linklike bg-transparent border-0 text-[13px] min-h-[44px] min-w-[44px] font-[inherit]"
              >
                {c.skip}
              </button>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
