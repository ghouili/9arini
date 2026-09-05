"use client";
/* /onboarding — step 1 of the tutor funnel: create the public page.

   Three defects this file exists to have fixed, all of them found in the launch
   audit and all of them dead ends rather than rough edges:

   1. ARABIC-NAMED TUTORS COULD NOT FINISH. The old slugify() used /[^\w\s-]/ with
      no `u` flag, and JavaScript's \w is ASCII — so every Arabic character was
      stripped, the slug came out empty, the server rejected it as `invalid-slug`,
      and the page showed a generic "une erreur". On an Arabic-first product that
      is an entire language cohort locked out of signup, with no error message that
      would let them work out why. (\w also allows "_", which SLUG_RE forbids — so
      an underscore in a name produced the same silent dead end.)

   2. THE SLUG WAS NOT EDITABLE. It was derived from the name and shown read-only,
      so `slug-taken` — two tutors called Yassine Khelifi, which will happen on day
      one — had no recovery at all.

   3. EVERY SERVER ERROR BECAME t.extra.error. createTutor has always returned
      specific codes; the page threw them away.

   The slug is now a real field, pre-filled and overridable, validated live with the
   SAME validator the server uses (vSlug from lib/validation.ts — a plain module, so
   client and server cannot drift), and every error code maps to a sentence that
   tells the tutor what to do. */
import { useEffect, useRef, useState } from "react";
import { Link } from "@/components/Link";
import { Button, Field, Avatar } from "@/components/ui";
import { Eye, Check, Shield, Phone, Lock } from "@/components/icons";
import { useLocale } from "@/components/LocaleProvider";
import { SiteShell } from "@/components/SiteShell";
import { OnboardingProgress } from "@/components/OnboardingProgress";
import { createTutor } from "@/app/actions";
import { useToast } from "@/components/useToast";
import { vSlug } from "@tnajem/shared";
import type { OnboardingState } from "@tnajem/shared";
import { bilingual } from "@/lib/i18n";

/* Page-local copy (FR + Tunisian Derija). lib/i18n.ts is shared/read-only, and
   several of its strings cannot be used here:
     • t.onboarding.fine is truthful but generic; this step says the same thing
       in wording tuned to the onboarding flow. During the pilot Tnajem takes
       0 % and touches no money — any rewording must keep that true.
     • t.onboarding.done says "Ta page est en ligne 🎉". It is NOT online: the tutor
       is `draft` until a human approves their ID, and the panel rendered directly
       under that toast said so. The screen contradicted itself at the exact moment
       a tutor decides whether to trust us. */
const copy = bilingual({
  fr: {
    yourName: "Ton nom…",
    fine: "Gratuit pendant le pilote : l'élève te paie en main propre et Tnajem ne prend rien. Plus tard, 10 % sur chaque élève payant via Tnajem, plus un abonnement à partir de 29 TND/mois.",
    perks: [
      "Ta page prête en 2 minutes",
      "Tu fixes ton prix — 100 % pour toi pendant le pilote",
      "Vérification à la main par notre équipe",
    ],
    previewNote: "Voilà ce que tes élèves verront.",
    notPublic: "Pas encore publique",
    publishedToast: "Ta page est créée — encore une étape",
    publishedTitle: "Ta page est créée",
    publishedBody: "Dernière étape : envoie ta pièce d'identité. On vérifie à la main, puis ta page passe en ligne et apparaît dans Explorer.",

    phone: "Ton numéro (optionnel)",
    phonePh: "+216 …",
    phoneHelp: "Pour qu'on te prévienne d'une réservation. Il n'apparaît jamais sur ta page publique.",
    errPhone: "Ce numéro n'est pas valide.",

    linkHelp: "Tu peux le changer maintenant. Lettres sans accents, chiffres et tirets.",
    linkLocked: "Ce lien est définitif — c'est celui que tu as déjà partagé. Le changer casserait les liens envoyés à tes élèves.",
    linkDone: "OK",

    errSlugEmpty: "Choisis ton lien.",
    errSlugFormat: "3 à 40 caractères : lettres sans accents, chiffres et tirets.",
    errSlugReserved: "Ce lien est réservé à Tnajem. Choisis-en un autre.",
    errSlugTaken: "Ce lien est déjà pris. Choisis-en un autre.",
    errName: "Écris ton nom (2 caractères minimum).",
    errSubject: "Écris ta matière.",
    errTooLong: "C'est trop long — raccourcis un peu.",
    errNotTutor: "Ton compte n'est pas un compte prof.",
    errAuth: "Ta session a expiré. Reconnecte-toi.",
    errGeneric: "Ça n'a pas marché. Réessaie.",
    errContactInfo:
      "Enlève le numéro, l'email ou le lien : les coordonnées ne sont pas autorisées sur ta page. Les élèves te contactent via Tnajem.",
  },
  ar: {
    yourName: "اسمك…",
    fine: "فابور في فترة التجربة : التلميذ يخلّصك في يدك وTnajem ما تاخذ والو. من بعد، 10 % على كل تلميذ يخلّص من Tnajem، زائد اشتراك من 29 دينار في الشهر.",
    perks: [
      "صفحتك حاضرة في دقيقتين",
      "إنتي تحدّد ثمنك — 100 % متاعك في فترة التجربة",
      "التثبّت يتعمل بيدينا",
    ],
    previewNote: "هكّا باش يشوفوك تلامذتك.",
    notPublic: "ما زالت مش ظاهرة",
    publishedToast: "صفحتك تعملت — باقية مرحلة",
    publishedTitle: "صفحتك تعملت",
    publishedBody: "آخر مرحلة : ابعث بطاقة تعريفك. نتثبّتو بيدينا، ومن بعد صفحتك تولّي أونلاين وتبان في «اكتشف».",

    phone: "نمرتك (اختياري)",
    phonePh: "+216 …",
    phoneHelp: "باش نعلموك كي يحجز تلميذ. ما تظهرش في صفحتك العمومية.",
    errPhone: "هذي النمرة موش صحيحة.",

    linkHelp: "تنجم تبدّلو توّا. حروف لاتينية، أرقام وشرطات.",
    linkLocked: "هذا اللينك ثابت — هو اللي شاركتو قبل. كان تبدّلو، اللينكات اللي بعثتهم لتلامذتك يتفسدو.",
    linkDone: "تمام",

    errSlugEmpty: "اختار الرابط متاعك.",
    errSlugFormat: "من 3 لـ 40 حرف : حروف لاتينية، أرقام وشرطات.",
    errSlugReserved: "هذا الرابط محجوز لتنجّم. اختار واحد آخر.",
    errSlugTaken: "هذا الرابط ماخوذ. اختار واحد آخر.",
    errName: "اكتب اسمك (حرفين على الأقل).",
    errSubject: "اكتب مادتك.",
    errTooLong: "طويل برشة — نقّصو شوية.",
    errNotTutor: "حسابك موش حساب أستاذ.",
    errAuth: "الجلسة متاعك سالات. عاود ادخل.",
    errGeneric: "ما مشاتش. عاود حاول.",
    errContactInfo:
      "نحّي النمرة، الإيميل ولا الرابط: معلومات الاتصال موش مسموحة في صفحتك. التلامذة يوصلولك عبر Tnajem.",
  },
});

/* Derive a URL slug from a display name.

   Unlike the version this replaces it is explicit about its alphabet instead of
   leaning on \w: strip combining marks (so "Amélie" → "amelie" and Arabic harakat
   fall away), then keep ONLY the characters SLUG_RE actually accepts —
   [a-z0-9-]. That last part matters in both directions: it drops Arabic and CJK
   letters, which cannot appear in a slug, and it also drops "_", which \w allowed
   through and SLUG_RE then rejected.

   Returns "" for a name with no Latin characters at all. That is not a failure —
   see FALLBACK_PREFIX below. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40)
    .replace(/^-+|-+$/g, "");
}

/* A name written entirely in Arabic yields an empty slug, and an empty slug is a
   dead end — so we hand the tutor a valid, editable one instead of an error they
   cannot act on. Generated once per mount, in an effect, because Math.random()
   during render would not match between server and client. */
const FALLBACK_PREFIX = "prof-";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function OnboardingInner({ state }: { state: OnboardingState | null }) {
  const { t, locale } = useLocale();
  const c = copy[locale];
  const { toast, showToast } = useToast();

  const draft = state?.draft ?? null;
  const [name, setName] = useState(draft?.fullName ?? "");
  const [subject, setSubject] = useState(draft?.subject ?? "");
  const [bio, setBio] = useState(draft?.bio ?? "");
  /* Optional CONTACT number. Signup is by email now, so this is where a tutor's
     phone is collected — it is what lets notify() text them about a new booking.
     It is NOT published: the storefront never renders it. */
  const [phone, setPhone] = useState(draft?.phone ?? "");
  const [slug, setSlug] = useState(draft?.slug ?? "");
  /* Once the tutor edits the link themselves, typing in the name field must stop
     overwriting it. A storefront that already has a slug counts as touched — we
     never silently rename a live URL because someone fixed a typo in their name. */
  const [slugTouched, setSlugTouched] = useState(Boolean(draft?.slug));

  /* The link is WRITE-ONCE. createTutor ignores any slug submitted for a storefront
     that already exists, because renaming one silently 404s every link the tutor has
     already shared. The field has to say so: leaving it editable while the server
     discards the value would make a deliberate edit a silent no-op, which is worse
     than not offering it at all. */
  const slugLocked = Boolean(state?.hasStorefront && draft?.slug);

  const [published, setPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Random suffix for names with no Latin characters. Effect, not render — see above.
  const fallback = useRef("");
  useEffect(() => {
    fallback.current = FALLBACK_PREFIX + Math.random().toString(36).slice(2, 8);
  }, []);

  function handleName(v: string) {
    setName(v);
    if (slugTouched) return;
    const derived = slugify(v);
    // Under 3 chars can never pass SLUG_RE — offer the fallback rather than a
    // value we already know the server will reject.
    setSlug(derived.length >= 3 ? derived : v.trim() ? fallback.current : "");
  }

  /* Live slug validation, using the SERVER's validator so the two cannot drift. */
  const slugCheck = vSlug(slug);
  const slugError = !slug
    ? c.errSlugEmpty
    : slugCheck.ok
    ? null
    : slugCheck.error === "slug-reserved"
    ? c.errSlugReserved
    : c.errSlugFormat;



  function messageFor(code: string | undefined): string {
    switch (code) {
      case "slug-taken": return c.errSlugTaken;
      case "slug-reserved": return c.errSlugReserved;
      case "invalid-slug": return c.errSlugFormat;
      case "invalid-name": return c.errName;
      case "invalid-subject": return c.errSubject;
      case "name-too-long":
      case "subject-too-long":
      case "bio-too-long": return c.errTooLong;
      case "invalid-phone": return c.errPhone;
      case "not-a-tutor": return c.errNotTutor;
      case "not-authenticated": return c.errAuth;
      default: return c.errGeneric;
    }
  }

  async function handlePublish() {
    if (publishing) return;
    /* Validate on CLICK. The button used to be disabled until every field was
       valid, which meant the primary CTA of the tutor funnel rendered grey and
       inert until hydration — and never explained which field was the problem. */
    if (name.trim().length < 2) { setError(c.errName); return; }
    if (!subject.trim()) { setError(c.errSubject); return; }
    if (slugError) { setError(slugError); return; }
    setPublishing(true);
    setError(null);
    let res: Awaited<ReturnType<typeof createTutor>>;
    try {
      res = await createTutor({ name, subject, bio, slug, phone: phone || null });
    } catch {
      setPublishing(false);
      setError(c.errGeneric);
      return;
    }
    setPublishing(false);
    if (res.ok) {
      showToast(res.demo ? `${c.publishedToast} · ${t.common.demoMode}` : c.publishedToast);
      setPublished(true);
      return;
    }
    setError(messageFor(res.error));
  }

  /* The bar reflects reality, so publishing advances it. Everything else about the
     tutor's position comes from the server (getOnboardingState). */
  const progress = {
    hasStorefront: published || Boolean(state?.hasStorefront),
    status: state?.status ?? ("draft" as const),
    hasClass: Boolean(state?.hasClass),
    hasSlug: published || Boolean(state?.hasSlug),
  };

  const inits = name ? initials(name) : "??";

  return (
    <SiteShell>
      <section className="web-section">
        <div className="container">
          <div className="web-hero">
            {/* ── Form column ── */}
            <div className="min-w-0">
              <OnboardingProgress progress={progress} />

              <h1 className="web-h2 mb-2">{t.onboarding.title}</h1>
              <p className="web-lead mb-[18px] max-w-[520px]">{t.onboarding.lead}</p>

              {/* What they actually get — three facts, no promise we cannot keep */}
              <ul className="list-none flex flex-col gap-2 mb-[26px] max-w-[520px]">
                {c.perks.map((p) => (
                  <li key={p} className="flex items-start gap-[9px] text-[13.5px] text-ink2 leading-[1.5]">
                    <Check className="w-4 h-4 text-green-ink flex-none mt-0.5" />
                    <span className="min-w-0">{p}</span>
                  </li>
                ))}
              </ul>

              <div className="max-w-[520px]">
                <Field label={t.onboarding.name}>
                  <div className="inp" style={name ? { borderColor: "var(--blue)" } : undefined}>
                    <input
                      type="text"
                      placeholder={t.onboarding.namePh}
                      value={name}
                      onChange={(e) => handleName(e.target.value)}
                      maxLength={80}
                      className="min-w-0"
                    />
                  </div>
                </Field>

                <Field label={t.onboarding.subject}>
                  <div className="inp" style={subject ? { borderColor: "var(--blue)" } : undefined}>
                    <input
                      type="text"
                      placeholder={t.onboarding.subjectPh}
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      maxLength={80}
                      className="min-w-0"
                    />
                  </div>
                </Field>

                <Field label={t.onboarding.bio}>
                  <div className="inp" style={bio ? { borderColor: "var(--blue)" } : undefined}>
                    <textarea
                      rows={2}
                      placeholder={t.onboarding.bioPh}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      maxLength={1000}
                      className="resize-none min-w-0"
                    />
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

                {/* ── The link. An EDITABLE field, not a read-only preview: it is
                    the one value a tutor can collide on, and the one the old screen
                    gave them no way to change. ── */}
                {/* The input is ALWAYS rendered, rather than swapped in behind an
                    "edit" button. The old display state put a <button> inside the
                    <label> and left that label with no form control to point at, so
                    the field had no accessible name until you activated it — and
                    onBlur collapsed it again, which meant a keyboard user tabbing
                    forward lost the input they had just been given. */}
                <Field
                  label={t.onboarding.link}
                  help={slugLocked ? c.linkLocked : c.linkHelp}
                  error={slugError && (name || slugTouched) ? slugError : undefined}
                >
                  <div
                    className={`inp ${slugError ? "border-rose" : slug ? "border-blue" : ""}`}
                    dir="ltr"
                  >
                    <span className="pre whitespace-nowrap shrink-0">tnajem.tn/</span>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()); }}
                      aria-invalid={Boolean(slugError)}
                      maxLength={40}
                      /* Locked once the page exists — see slugLocked. readOnly rather
                         than disabled so the value stays selectable and copyable:
                         this is the link they are meant to go and share. */
                      readOnly={slugLocked}
                      className={`min-w-0 font-semibold ${slugLocked ? "text-muted" : ""}`}
                    />
                    {slugLocked && <Lock className="w-4 h-4 flex-none text-muted" />}
                  </div>
                </Field>

                {published ? (
                  /* Created is not live: the page only goes public after review. */
                  <div className="panel panel-pad mt-2 bg-green50 border border-green">
                    <div className="flex gap-2.5 items-start">
                      <span className="text-green-ink inline-flex flex-none mt-[1px]" aria-hidden="true">
                        <Check />
                      </span>
                      <div className="min-w-0">
                        <div className="font-display font-bold text-[15px] mb-1">{c.publishedTitle}</div>
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
                    {error && (
                      <p role="alert" className="text-rose text-[13px] font-semibold leading-[1.5] mb-2.5">
                        {error}
                      </p>
                    )}
                    <Button variant="primary" onClick={handlePublish} disabled={publishing}>
                      {publishing ? t.common.loading : t.onboarding.cta}
                    </Button>
                    <p className="text-center text-[13px] text-muted mt-[11px] leading-[1.5]">{c.fine}</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Live preview column (sticky on desktop) ── */}
            <div className="min-w-0">
              <div className="panel panel-pad sticky top-[84px] bg-sand border border-line">
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className="text-[13px] font-bold uppercase tracking-[0.6px] text-muted inline-flex items-center gap-[7px]">
                    <Eye className="w-3.5 h-3.5" /> {t.onboarding.preview}
                  </span>
                  {/* No fake "Vérifié" badge here: the account is not verified yet. */}
                  <span className="chip chip-sand ms-auto flex-none">{c.notPublic}</span>
                </div>

                <div className="flex gap-3 items-center bg-paper rounded-[13px] p-3.5">
                  <Avatar initials={inits} size={52} square />
                  <div className="min-w-0">
                    <div className="font-display text-[16px] mb-[3px] truncate">
                      {name || <span className="text-muted">{c.yourName}</span>}
                    </div>
                    <div className="text-[13px] text-muted truncate">
                      {subject || t.onboarding.subjectPh}
                    </div>
                  </div>
                </div>

                {bio && <p className="text-[13px] text-ink2 leading-[1.6] mt-3.5">{bio}</p>}
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
