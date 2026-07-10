"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, Spinner } from "@/components/ui";
import { useLocale } from "@/components/LocaleProvider";
import { Shield, Check, Upload, User, Eye, Bulb } from "@/components/icons";
import { SiteShell } from "@/components/SiteShell";
import { getMyVerification, submitVerification } from "@/app/actions";
import type { TutorVerification, Locale } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Self-contained bilingual copy (FR + Tunisian Derija). Do NOT edit   */
/* shared i18n — this page owns all its strings.                       */
/* ------------------------------------------------------------------ */
const copy = {
  fr: {
    eyebrow: "VÉRIFICATION",
    h2: "Vérifie ton compte de prof",
    lead:
      "La pièce d'identité est obligatoire. Tes diplômes, ton expérience et tes liens sont optionnels — mais ils renforcent la confiance et débloquent des badges. Une fois approuvé, ta page devient publique et listée dans l'Explorer (en général sous 24–48h).",
    // sections
    s1Title: "Identité",
    s1Req: "obligatoire",
    s1Sub: "On vérifie que tu es bien toi.",
    s2Title: "Diplômes & expérience",
    s2Opt: "optionnel",
    s2Sub: "Plus tu en mets, plus tu inspires confiance.",
    s3Title: "Liens & réseaux",
    s3Sub: "Montre ton travail et ta présence en ligne.",
    // file fields
    idFront: "Pièce d'identité (CIN ou passeport) — recto",
    idBack: "CIN — verso",
    selfie: "Selfie en tenant ta pièce d'identité",
    selfieHelp: "Anti-usurpation : ton visage + ta pièce, bien lisibles.",
    diploma: "Diplôme / relevé de notes",
    certificate: "Certificat / attestation d'enseignement",
    roleProof: "Carte d'étudiant ou attestation d'emploi",
    // dropzone
    dzPick: "Choisir un fichier",
    dzHint: "Image ou PDF — max 8 Mo",
    dzChange: "Changer",
    dzRemove: "Retirer",
    // text fields
    experienceYears: "Années d'expérience",
    experiencePh: "ex. 5",
    institution: "Établissement / université actuelle",
    institutionPh: "ex. Faculté des Sciences de Tunis",
    languages: "Langues parlées",
    languagesPh: "ex. Arabe, Français, Anglais",
    pitch: "Ton approche / pourquoi toi",
    pitchPh: "En quelques mots : ta méthode, ce qui te rend différent…",
    // links
    linkedin: "LinkedIn",
    instagram: "Instagram",
    tiktok: "TikTok",
    youtube: "YouTube",
    facebook: "Facebook",
    website: "Site / portfolio",
    introVideo: "Vidéo d'intro",
    urlPh: "https://…",
    // reassurance
    inpdp:
      "Tes documents servent uniquement à la vérification — stockés en sécurité, jamais publiés.",
    // actions
    submit: "Envoyer pour vérification",
    submitting: "Envoi…",
    needId: "La pièce d'identité (recto) est obligatoire pour continuer.",
    demoNote: "Mode démo — rien n'est enregistré.",
    // errors
    errFileSize: "Fichier trop lourd — 8 Mo maximum par fichier.",
    errFileType: "Format non accepté — images (JPG, PNG, WEBP, HEIC) ou PDF uniquement.",
    errGeneric: "Une erreur est survenue. Réessaie.",
    errAuthLine: "Tu dois être connecté pour envoyer ta vérification.",
    errAuthLink: "Se connecter",
    errStoreLine: "Crée d'abord ta page de prof.",
    errStoreLink: "Créer ma page",
    // pending state
    pendingTitle: "Vérification envoyée",
    pendingBody:
      "Merci ! Ton dossier est en cours d'examen. Tu recevras une réponse en général sous 24–48h. Une fois approuvé, ta page sera publiée et listée dans l'Explorer.",
    pendingNote: "Tu peux fermer cette page — on te tiendra au courant.",
    // verified state
    verifiedTitle: "Déjà vérifié",
    verifiedBody: "Ton compte est vérifié. Ta page est publique et listée dans l'Explorer.",
    // rejected state
    rejectedTitle: "Dossier à compléter",
    rejectedNote: "Note de l'équipe :",
    rejectedBody: "Corrige les points ci-dessus et renvoie ton dossier.",
    resubmitIntro: "Tu peux modifier et renvoyer ton dossier ci-dessous.",
    // links back
    backDash: "Retour au tableau de bord",
  },
  ar: {
    eyebrow: "تأكيد الحساب",
    h2: "أكّد حسابك كمعلّم",
    lead:
      "بطاقة التعريف ضرورية. الشهائد، الخبرة و الروابط متاع وسائل التواصل اختيارية — أما يزيدوك ثقة و يفتحولك شارات. كي يتقبل ملفك، صفحتك تولّي ظاهرة و موجودة في Explorer (عادةً في 24–48 ساعة).",
    s1Title: "الهوية",
    s1Req: "ضروري",
    s1Sub: "نتأكدو بلّي راك إنت.",
    s2Title: "الشهائد و الخبرة",
    s2Opt: "اختياري",
    s2Sub: "كل ما تزيد، كل ما تزيد الثقة فيك.",
    s3Title: "الروابط و وسائل التواصل",
    s3Sub: "ورّي خدمتك و حضورك على الأنترنت.",
    idFront: "بطاقة التعريف (CIN ولا جواز سفر) — الوجه",
    idBack: "بطاقة التعريف — الخلف",
    selfie: "صورة سيلفي و إنت ماسك بطاقة التعريف",
    selfieHelp: "باش ما حدّش يتصنّع بهويتك: وجهك + البطاقة، يتقراو مليح.",
    diploma: "الشهادة / كشف الأعداد",
    certificate: "شهادة / إفادة تدريس",
    roleProof: "بطاقة طالب ولا إفادة شغل",
    dzPick: "اختار ملف",
    dzHint: "صورة ولا PDF — أقصى حد 8 ميغا",
    dzChange: "بدّل",
    dzRemove: "نحّي",
    experienceYears: "سنوات الخبرة",
    experiencePh: "مثال: 5",
    institution: "المؤسسة / الجامعة الحالية",
    institutionPh: "مثال: كلية العلوم بتونس",
    languages: "اللغات اللي تحكيهم",
    languagesPh: "مثال: عربي، فرنساوي، إنڨليزي",
    pitch: "طريقتك / علاش إنت",
    pitchPh: "في كلمات قليلة: منهجك، شنوّة يميّزك…",
    linkedin: "LinkedIn",
    instagram: "Instagram",
    tiktok: "TikTok",
    youtube: "YouTube",
    facebook: "Facebook",
    website: "موقع / portfolio",
    introVideo: "فيديو تعريفي",
    urlPh: "https://…",
    inpdp:
      "وثائقك يخدمو كان للتأكيد — محفوظين في الأمان، عمرهم ما يتنشرو.",
    submit: "ابعث للتأكيد",
    submitting: "قاعد يتبعث…",
    needId: "بطاقة التعريف (الوجه) ضرورية باش تكمّل.",
    demoNote: "وضع التجربة — ما يتسجّل حتى شيء.",
    errFileSize: "الملف ثقيل برشة — أقصى حد 8 ميغا للملف.",
    errFileType: "الصيغة موش مقبولة — كان صور (JPG, PNG, WEBP, HEIC) ولا PDF.",
    errGeneric: "صار مشكل. عاود من جديد.",
    errAuthLine: "لازمك تكون متصل باش تبعث التأكيد.",
    errAuthLink: "اتصل بحسابك",
    errStoreLine: "أعمل صفحتك كمعلّم الأول.",
    errStoreLink: "أعمل صفحتي",
    pendingTitle: "التأكيد اتبعث",
    pendingBody:
      "يعيشك! ملفك تحت الدراسة. باش توصلك إجابة عادةً في 24–48 ساعة. كي يتقبل، صفحتك باش تتنشر و تولّي في Explorer.",
    pendingNote: "تنجم تسكّر الصفحة هاذي — باش نعلموك.",
    verifiedTitle: "متأكّد من قبل",
    verifiedBody: "حسابك متأكّد. صفحتك ظاهرة و موجودة في Explorer.",
    rejectedTitle: "الملف يلزمو تكملة",
    rejectedNote: "ملاحظة الفريق:",
    rejectedBody: "صلّح النقاط اللي فوق و عاود ابعث ملفك.",
    resubmitIntro: "تنجم تبدّل و تعاود تبعث ملفك تحت.",
    backDash: "ارجع للوحة",
    rise: "",
  },
} as const;

type CopyT = (typeof copy)[Locale];

/* file field keys → label key (exact FormData keys) */
const FILE_FIELDS = [
  { key: "idFront", labelKey: "idFront", required: true },
  { key: "idBack", labelKey: "idBack", required: false },
  { key: "selfie", labelKey: "selfie", required: false, helpKey: "selfieHelp" },
  { key: "diploma", labelKey: "diploma", required: false },
  { key: "certificate", labelKey: "certificate", required: false },
  { key: "roleProof", labelKey: "roleProof", required: false },
] as const;

const ACCEPT = "image/*,application/pdf";

/* ------------------------------------------------------------------ */

export default function VerifyPage() {
  const { locale } = useLocale();
  const c: CopyT = copy[locale];

  const [loading, setLoading] = useState(true);
  const [verif, setVerif] = useState<TutorVerification | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState<null | "id" | "size" | "type" | "auth" | "store" | "generic">(null);

  // chosen file names, keyed by FormData field
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  // prefill (rejected → resubmit)
  const pre = verif && verif.status === "rejected" ? verif : null;

  useEffect(() => {
    let alive = true;
    getMyVerification()
      .then((v) => { if (alive) setVerif(v); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  function pickFile(key: string, f: File | null) {
    setFiles((prev) => ({ ...prev, [key]: f }));
    if (error === "id" && key === "idFront" && f) setError(null);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    // client-side guard: idFront required
    if (!files.idFront) {
      setError("id");
      fileInputs.current.idFront?.focus();
      return;
    }
    setError(null);
    setSubmitting(true);

    const form = e.currentTarget;
    const fd = new FormData();

    // text / number / url fields (append as strings; FormData picks current values)
    const textKeys = [
      "experienceYears", "institution", "languages", "pitch",
      "linkedinUrl", "instagramUrl", "tiktokUrl", "youtubeUrl",
      "facebookUrl", "websiteUrl", "introVideoUrl",
    ];
    for (const k of textKeys) {
      const el = form.elements.namedItem(k) as HTMLInputElement | HTMLTextAreaElement | null;
      if (el && el.value.trim()) fd.append(k, el.value.trim());
    }

    // files — append only if chosen
    for (const f of FILE_FIELDS) {
      const file = files[f.key];
      if (file) fd.append(f.key, file);
    }

    try {
      const res = await submitVerification(fd);
      if (res.ok) {
        if (res.demo) setDemo(true);
        setDone(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        switch (res.error) {
          case "id-required": setError("id"); break;
          case "file-too-large": setError("size"); break;
          case "bad-file-type": setError("type"); break;
          case "not-authenticated": setError("auth"); break;
          case "no-storefront": setError("store"); break;
          default: setError("generic");
        }
      }
    } catch {
      setError("generic");
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------- loading ---------- */
  if (loading) {
    return (
      <Shell>
        <Spinner />
      </Shell>
    );
  }

  /* ---------- status: pending ---------- */
  if (!done && verif && verif.status === "pending") {
    return (
      <Shell>
        <StatusPanel
          tone="blue"
          icon={<Shield style={{ width: 30, height: 30 }} />}
          title={c.pendingTitle}
          body={c.pendingBody}
          note={c.pendingNote}
          backLabel={c.backDash}
        />
      </Shell>
    );
  }

  /* ---------- status: verified ---------- */
  if (!done && verif && verif.status === "verified") {
    return (
      <Shell>
        <StatusPanel
          tone="green"
          icon={<Check style={{ width: 30, height: 30 }} />}
          title={`${c.verifiedTitle} ✓`}
          body={c.verifiedBody}
          backLabel={c.backDash}
        />
      </Shell>
    );
  }

  /* ---------- success (just submitted) ---------- */
  if (done) {
    return (
      <Shell>
        <StatusPanel
          tone="blue"
          icon={<Shield style={{ width: 30, height: 30 }} />}
          title={c.pendingTitle}
          body={c.pendingBody}
          note={demo ? c.demoNote : c.pendingNote}
          backLabel={c.backDash}
        />
      </Shell>
    );
  }

  /* ---------- form (draft / null / rejected) ---------- */
  const rejected = verif && verif.status === "rejected";

  return (
    <Shell>
      {/* heading */}
      <div className="rise" style={{ marginBottom: "clamp(20px,3vw,30px)" }}>
        <div className="web-eyebrow" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Shield style={{ width: 16, height: 16 }} />
          {c.eyebrow}
        </div>
        <h1 className="web-h2" style={{ marginTop: 8 }}>{c.h2}</h1>
        <p className="web-lead" style={{ marginTop: 12, maxWidth: 620 }}>{c.lead}</p>
      </div>

      {/* rejected note */}
      {rejected && (
        <div
          className="rise"
          style={{
            display: "flex", gap: 12, alignItems: "flex-start",
            padding: "14px 16px", marginBottom: 20,
            background: "var(--rose50)", borderRadius: "var(--r)",
          }}
        >
          <Bulb style={{ width: 22, height: 22, color: "var(--rose)", flex: "none", marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--rose)" }}>
              {c.rejectedTitle}
            </div>
            {verif?.reviewNote && (
              <p style={{ fontSize: 13, color: "var(--ink2)", marginTop: 4, lineHeight: 1.55 }}>
                <b>{c.rejectedNote} </b>{verif.reviewNote}
              </p>
            )}
            <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 6, lineHeight: 1.55 }}>
              {c.resubmitIntro}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* ============ SECTION 1 — IDENTITY ============ */}
        <SectionPanel
          icon={<User style={{ width: 20, height: 20 }} />}
          title={c.s1Title}
          chip={c.s1Req}
          chipKind="rose"
          sub={c.s1Sub}
        >
          {FILE_FIELDS.slice(0, 3).map((f) => (
            <FileDrop
              key={f.key}
              c={c}
              fieldKey={f.key}
              label={c[f.labelKey as keyof CopyT] as string}
              required={f.required}
              help={"helpKey" in f && f.helpKey ? (c[f.helpKey as keyof CopyT] as string) : undefined}
              file={files[f.key] ?? null}
              onPick={(file) => pickFile(f.key, file)}
              inputRef={(el) => { fileInputs.current[f.key] = el; }}
              invalid={error === "id" && f.key === "idFront"}
            />
          ))}

          {/* INPDP reassurance */}
          <div className="trust" style={{ marginTop: 4 }}>
            <Lock />
            <p>{c.inpdp}</p>
          </div>

          {error === "id" && (
            <p role="alert" style={errStyle}>{c.needId}</p>
          )}
        </SectionPanel>

        {/* ============ SECTION 2 — DIPLOMAS & EXPERIENCE ============ */}
        <SectionPanel
          icon={<Bulb style={{ width: 20, height: 20 }} />}
          title={c.s2Title}
          chip={c.s2Opt}
          chipKind="soft"
          sub={c.s2Sub}
        >
          {FILE_FIELDS.slice(3).map((f) => (
            <FileDrop
              key={f.key}
              c={c}
              fieldKey={f.key}
              label={c[f.labelKey as keyof CopyT] as string}
              required={false}
              file={files[f.key] ?? null}
              onPick={(file) => pickFile(f.key, file)}
              inputRef={(el) => { fileInputs.current[f.key] = el; }}
            />
          ))}

          <TextField id="experienceYears" label={c.experienceYears}>
            <div className="inp">
              <input
                id="experienceYears" name="experienceYears" type="number"
                min={0} max={60} step={1} placeholder={c.experiencePh}
                defaultValue={pre?.experienceYears ?? undefined}
                inputMode="numeric"
              />
            </div>
          </TextField>

          <TextField id="institution" label={c.institution}>
            <div className="inp">
              <input
                id="institution" name="institution" type="text"
                placeholder={c.institutionPh} maxLength={120}
                defaultValue={pre?.institution ?? undefined}
              />
            </div>
          </TextField>

          <TextField id="languages" label={c.languages}>
            <div className="inp">
              <input
                id="languages" name="languages" type="text"
                placeholder={c.languagesPh} maxLength={120}
                defaultValue={pre?.languages ?? undefined}
              />
            </div>
          </TextField>

          <TextField id="pitch" label={c.pitch}>
            <div className="inp">
              <textarea
                id="pitch" name="pitch" rows={4}
                placeholder={c.pitchPh} maxLength={600}
                defaultValue={pre?.pitch ?? undefined}
                style={{ resize: "vertical", minHeight: 86 }}
              />
            </div>
          </TextField>
        </SectionPanel>

        {/* ============ SECTION 3 — LINKS & SOCIALS ============ */}
        <SectionPanel
          icon={<Eye style={{ width: 20, height: 20 }} />}
          title={c.s3Title}
          chip={c.s2Opt}
          chipKind="soft"
          sub={c.s3Sub}
        >
          <div className="vlinks">
            <UrlField id="linkedinUrl" label={c.linkedin} ph={c.urlPh} def={pre?.links.linkedin} />
            <UrlField id="instagramUrl" label={c.instagram} ph={c.urlPh} def={pre?.links.instagram} />
            <UrlField id="tiktokUrl" label={c.tiktok} ph={c.urlPh} def={pre?.links.tiktok} />
            <UrlField id="youtubeUrl" label={c.youtube} ph={c.urlPh} def={pre?.links.youtube} />
            <UrlField id="facebookUrl" label={c.facebook} ph={c.urlPh} def={pre?.links.facebook} />
            <UrlField id="websiteUrl" label={c.website} ph={c.urlPh} def={pre?.links.website} />
            <UrlField id="introVideoUrl" label={c.introVideo} ph={c.urlPh} def={pre?.links.introVideo} />
          </div>
        </SectionPanel>

        {/* ============ ERRORS (non-id) ============ */}
        {error && error !== "id" && (
          <div role="alert" className="rise" style={{
            padding: "13px 16px", marginBottom: 16,
            background: "var(--rose50)", borderRadius: "var(--r)",
            color: "var(--rose)", fontSize: 13.5, fontWeight: 600, lineHeight: 1.55,
          }}>
            {error === "size" && c.errFileSize}
            {error === "type" && c.errFileType}
            {error === "generic" && c.errGeneric}
            {error === "auth" && (
              <>
                {c.errAuthLine}{" "}
                <Link href="/auth" className="linklike">{c.errAuthLink}</Link>
              </>
            )}
            {error === "store" && (
              <>
                {c.errStoreLine}{" "}
                <Link href="/onboarding" className="linklike">{c.errStoreLink}</Link>
              </>
            )}
          </div>
        )}

        {/* ============ SUBMIT ============ */}
        <div style={{ maxWidth: 360 }}>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting
              ? <><Spinner />{c.submitting}</>
              : <><Shield style={{ width: 18, height: 18 }} />{c.submit}</>}
          </Button>
        </div>
      </form>
    </Shell>
  );
}

/* ================================================================== */
/* Sub-components                                                      */
/* ================================================================== */

/* Stable module-level shell (defining it inside the page component would
   remount the whole subtree on every state change, resetting the form). */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SiteShell>
      <style dangerouslySetInnerHTML={{ __html: scoped }} />
      <section className="web-section">
        <div className="container container-narrow">{children}</div>
      </section>
    </SiteShell>
  );
}

function SectionPanel({
  icon, title, chip, chipKind, sub, children,
}: {
  icon: React.ReactNode;
  title: string;
  chip: string;
  chipKind: "rose" | "soft";
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel panel-pad rise" style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 4 }}>
        <div style={{
          width: 40, height: 40, minWidth: 40, borderRadius: 12,
          background: "var(--blue50)", color: "var(--blue)",
          display: "grid", placeItems: "center",
        }}>
          {icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h2 style={{ fontFamily: "var(--fd)", fontSize: "clamp(17px,2vw,20px)", letterSpacing: "-0.4px" }}>
              {title}
            </h2>
            <span className={`chip chip-${chipKind}`}>{chip}</span>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{sub}</p>
        </div>
      </div>
      <div className="divider" style={{ margin: "12px 0 16px" }} />
      {children}
    </div>
  );
}

function FileDrop({
  c, fieldKey, label, required, help, file, onPick, inputRef, invalid,
}: {
  c: CopyT;
  fieldKey: string;
  label: string;
  required: boolean;
  help?: string;
  file: File | null;
  onPick: (f: File | null) => void;
  inputRef: (el: HTMLInputElement | null) => void;
  invalid?: boolean;
}) {
  const inputId = `file-${fieldKey}`;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, flexWrap: "wrap" }}>
        <label htmlFor={inputId} style={{ fontSize: 12, fontWeight: 700 }}>{label}</label>
        <span className={`chip ${required ? "chip-rose" : "chip-sand"}`}>
          {required ? c.s1Req : c.s2Opt}
        </span>
      </div>

      <label
        htmlFor={inputId}
        className="dz"
        data-filled={file ? "true" : "false"}
        style={invalid ? { borderColor: "var(--rose)" } : undefined}
      >
        <input
          id={inputId}
          name={fieldKey}
          type="file"
          accept={ACCEPT}
          ref={inputRef}
          aria-required={required || undefined}
          aria-invalid={invalid || undefined}
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          style={{
            position: "absolute", width: 1, height: 1, padding: 0, margin: -1,
            overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0,
          }}
        />
        <span className="dz-ic">
          {file ? <Check style={{ width: 20, height: 20 }} /> : <Upload style={{ width: 20, height: 20 }} />}
        </span>
        <span className="dz-txt">
          {file ? (
            <b style={{ wordBreak: "break-word" }}>{file.name}</b>
          ) : (
            <>
              <b>{c.dzPick}</b>
              <span className="dz-hint">{c.dzHint}</span>
            </>
          )}
        </span>
        <span className="dz-act">{file ? c.dzChange : ""}</span>
      </label>

      {file && (
        <button
          type="button"
          className="dz-remove"
          onClick={(ev) => {
            ev.preventDefault();
            onPick(null);
            const el = document.getElementById(inputId) as HTMLInputElement | null;
            if (el) el.value = "";
          }}
        >
          {c.dzRemove}
        </button>
      )}

      {help && <div className="help">{help}</div>}
    </div>
  );
}

function TextField({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

function UrlField({ id, label, ph, def }: { id: string; label: string; ph: string; def?: string | null }) {
  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="inp">
        <input id={id} name={id} type="url" inputMode="url" placeholder={ph} defaultValue={def ?? undefined} />
      </div>
    </div>
  );
}

function StatusPanel({
  tone, icon, title, body, note, backLabel,
}: {
  tone: "blue" | "green";
  icon: React.ReactNode;
  title: string;
  body: string;
  note?: string;
  backLabel: string;
}) {
  const bg = tone === "green" ? "var(--green)" : "var(--blue)";
  return (
    <div className="panel panel-pad rise" style={{ textAlign: "center", maxWidth: 520, marginInline: "auto" }}>
      <div style={{
        width: 64, height: 64, borderRadius: 20, marginInline: "auto", marginBottom: 16,
        background: bg, color: "#fff", display: "grid", placeItems: "center",
        boxShadow: "var(--sh)",
      }}>
        {icon}
      </div>
      <h1 style={{ fontFamily: "var(--fd)", fontSize: "clamp(22px,3vw,30px)", letterSpacing: "-0.8px" }}>
        {title}
      </h1>
      <p className="web-lead" style={{ marginTop: 12 }}>{body}</p>
      {note && (
        <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 10, lineHeight: 1.55 }}>{note}</p>
      )}
      <div style={{ marginTop: 22, display: "flex", justifyContent: "center" }}>
        <Link href="/dashboard">
          <span className="btn btn-ink" style={{ width: "auto", padding: "13px 22px" }}>{backLabel}</span>
        </Link>
      </div>
    </div>
  );
}

/* small inline Lock matches the .trust icon convention (icons.tsx has Lock,
   but it is imported here to keep .trust styling) */
function Lock() {
  return (
    <svg viewBox="0 0 24 24" className="ic" aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.4" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </svg>
  );
}

const errStyle: React.CSSProperties = {
  color: "var(--rose)", fontSize: 13, fontWeight: 600, marginTop: 8, lineHeight: 1.5,
};

/* page-scoped CSS (dropzone visuals + url grid) */
const scoped = `
.dz{position:relative;display:flex;align-items:center;gap:12px;width:100%;
  background:var(--paper);border:1.8px dashed var(--line);border-radius:14px;
  padding:13px 14px;cursor:pointer;transition:.15s;text-align:start}
.dz:hover{border-color:var(--blue);background:var(--blue50)}
.dz[data-filled="true"]{border-style:solid;border-color:var(--green);background:var(--green50)}
.dz .dz-ic{width:38px;height:38px;min-width:38px;border-radius:11px;display:grid;place-items:center;
  background:var(--sand);color:var(--ink2)}
.dz[data-filled="true"] .dz-ic{background:var(--green);color:#fff}
.dz .dz-txt{display:flex;flex-direction:column;gap:2px;font-size:13.5px;min-width:0;flex:1}
.dz .dz-txt b{font-weight:700;font-size:13.5px}
.dz .dz-hint{font-size:11.5px;color:var(--muted);font-weight:500}
.dz .dz-act{font-size:12px;font-weight:700;color:var(--blue);margin-inline-start:auto;white-space:nowrap}
.dz-remove{margin-top:6px;background:0;border:0;cursor:pointer;color:var(--rose);
  font-family:var(--fb);font-size:11.5px;font-weight:700;padding:2px 0}
html[dir="rtl"] .dz-remove{font-family:var(--fa)}
.vlinks{display:grid;gap:14px;grid-template-columns:1fr}
@media (min-width:620px){.vlinks{grid-template-columns:1fr 1fr}}
`;
