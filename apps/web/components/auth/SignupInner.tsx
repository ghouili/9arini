"use client";
/* The interactive body of BOTH signup screens: /signup/prof and /signup/eleve.

   WHY THE FUNNEL IS SPLIT. There used to be one /auth screen carrying a
   tutor/student toggle, and that toggle was a lie for anyone who already had an
   account: verifyOtp deliberately never overwrites an existing profile's role (it
   must not — otherwise re-authenticating as the other role would be a one-tap
   self-promotion), so a returning student who tapped "Je suis prof" was signed in
   as a student and pushed to /student with no explanation. Meanwhile the role
   actually got set somewhere else entirely, as a silent side effect of saving a
   name in createTutor().

   So: role is chosen by WHICH PAGE YOU ARE ON, and it is only ever applied to a
   brand-new account. /auth is sign-in and has no role picker at all, because there
   is nothing for it to pick — the account already knows. A number that already
   belongs to the other kind of account gets told so (roleMismatch), instead of
   being silently redirected somewhere that contradicts what it just tapped.

   Rendered by a SERVER page that reads ?next= and hands it down as a prop — the
   same arrangement app/[locale]/auth/page.tsx documents at length: reading the
   query string with the client hook forces the form into a Suspense boundary,
   which Next bails to client-only rendering, which ships a login page with no
   fields in the HTML. */
import { useState } from "react";
import { Link, useLocalizedRouter } from "@/components/Link";
import { Button, Field } from "@/components/ui";
import { useLocale } from "@/components/LocaleProvider";
import { Phone, Calendar, Check, Mail } from "@/components/icons";
import { requestOtp, verifyOtp } from "@/app/actions";
import { SiteShell } from "@/components/SiteShell";
import { postAuthDestination } from "@/lib/auth-destination";
import { useCountdown, formatCountdown } from "@/components/useCountdown";
// Pure module — the SAME validity check the server runs, so the form and the action
// can never disagree about what a valid address is.
import { isValidEmail } from "@tnajem/shared";
import type { OtpChannel } from "@/lib/auth";

export type SignupRole = "tutor" | "student";

/* Page-local copy. lib/i18n.ts is shared and read-only for these screens, and
   several of its strings are wrong here anyway — t.auth.title says "Connexion"
   (this is signup) and t.auth.pending describes our SMS-provider status. */
const COPY = {
  fr: {
    tutorTitle: "Crée ton compte prof",
    tutorLead: "Ta page publique, tes classes, tes élèves. Entre ton email : on t'envoie un code. Pas de mot de passe.",
    tutorLeadSms: "Ta page publique, tes classes, tes élèves. Entre ton numéro : on t'envoie un code par SMS. Pas de mot de passe.",
    tutorPerks: [
      "Ta page prête en 2 minutes",
      "Tu fixes ton prix — 100 % pour toi pendant le pilote",
      "Vérification à la main par notre équipe",
    ],
    studentTitle: "Crée ton compte élève",
    studentLead: "Trouve un prof, réserve ta séance. Entre ton email : on t'envoie un code. Pas de mot de passe.",
    studentLeadSms: "Trouve un prof, réserve ta séance. Entre ton numéro : on t'envoie un code par SMS. Pas de mot de passe.",
    email: "Ton email",
    emailPh: "prenom@exemple.com",
    spam: "Le code arrive en moins d'une minute. Pense à regarder dans les spams.",
    changeEmail: "Changer d'email",
    errNeedEmail: "Entre ton adresse email.",
    errBadEmail: "Cette adresse email n'est pas valide.",
    errSend: "Envoi du code impossible. Réessaie.",
    errBadCode: "Code incorrect ou expiré. Vérifie les 6 chiffres, ou demande un nouveau code.",
    errTooManyAttempts: (secs: number) =>
      `Trop d'essais. Réessaie dans ${Math.max(1, Math.ceil(secs / 60))} minutes.`,
    alreadySent: "Un code t'a déjà été envoyé et il est encore valable — saisis-le ci-dessous.",
    haveCode: "J'ai déjà un code",
    studentPerks: [
      "La 1ʳᵉ séance est offerte",
      "Uniquement des profs vérifiés à la main",
      "Annulation gratuite jusqu'à 24h avant",
    ],

    byLabel: "Année de naissance de l'élève",
    byPh: "Choisir…",
    byNote: "Pour un élève de moins de 18 ans, l'accord d'un parent ou tuteur est demandé avant la 1ʳᵉ séance.",

    sentTo: (p: string) => `Code envoyé au ${p}`,
    changeNumber: "Changer de numéro",
    devCodeNote: "Code de test — aucun message n'est envoyé pour l'instant",
    codeHelp: "6 chiffres.",
    codeLabelEmail: "Code reçu par email",
    codeLabelSms: "Code reçu par SMS",
    resend: "Renvoyer le code",
    resendReady: "Tu peux redemander un code.",
    expiresIn: (t: string) => `Ce code expire dans ${t}.`,
    expired: "Ce code a expiré — demande-en un nouveau.",

    errNeedPhone: "Entre ton numéro de téléphone.",
    errNeedBirthYear: "Choisis l'année de naissance de l'élève.",
    haveAccount: "Tu as déjà un compte ?",
    signIn: "Se connecter",
    otherTutor: "Tu es prof ? Crée un compte prof",
    otherStudent: "Tu cherches un prof ? Crée un compte élève",

    mismatchTitle: "Ce compte existe déjà",
    mismatchTutor: "C'est déjà un compte prof. Tu es connecté — voici ton tableau de bord.",
    mismatchStudent: "C'est déjà un compte élève. Tu es connecté — voici tes cours.",
    mismatchNote: "Un compte par personne. Pour enseigner avec un compte élève, passe par « Devenir prof » depuis ton espace.",
    goDashboard: "Aller à mon tableau de bord",
    goStudent: "Voir mes cours",
  },
  ar: {
    tutorTitle: "اعمل حسابك متاع أستاذ",
    tutorLead: "صفحتك، حصصك، تلامذتك. حطّ الإيميل متاعك : نبعثولك كود. بلا كلمة سرّ.",
    tutorLeadSms: "صفحتك، حصصك، تلامذتك. حطّ نمرتك : نبعثولك كود بالـSMS. بلا كلمة سرّ.",
    tutorPerks: [
      "صفحتك حاضرة في دقيقتين",
      "إنتي تحدّد ثمنك — 100 % متاعك في فترة التجربة",
      "التثبّت يتعمل بيدينا",
    ],
    studentTitle: "اعمل حسابك متاع تلميذ",
    studentLead: "لقّي أستاذ واحجز حصتك. حطّ الإيميل متاعك : نبعثولك كود. بلا كلمة سرّ.",
    studentLeadSms: "لقّي أستاذ واحجز حصتك. حطّ نمرتك : نبعثولك كود بالـSMS. بلا كلمة سرّ.",
    email: "الإيميل متاعك",
    emailPh: "esm@exemple.com",
    spam: "الكود يوصل في أقل من دقيقة. شوف زادة في الـspam.",
    changeEmail: "بدّل الإيميل",
    errNeedEmail: "حطّ الإيميل متاعك.",
    errBadEmail: "هذا الإيميل موش صحيح.",
    errSend: "تعذّر إرسال الكود. عاود المحاولة.",
    errBadCode: "الكود موش صحيح ولا سالا. شوف الـ 6 أرقام، ولا اطلب كود جديد.",
    errTooManyAttempts: (secs: number) =>
      `برشا محاولات. عاود بعد ${Math.max(1, Math.ceil(secs / 60))} دقايق.`,
    alreadySent: "فما كود تبعثلك وما زال صالح — حطّو تحت.",
    haveCode: "عندي كود",
    studentPerks: [
      "الحصة الأولى فابور",
      "كان أساتذة متثبّت منهم بيدينا",
      "الإلغاء مجاني حتى 24 ساعة قبل",
    ],

    byLabel: "سنة ولادة التلميذ",
    byPh: "اختر…",
    byNote: "للتلميذ اللي عمرو أقلّ من 18 سنة، تتطلب موافقة الولي قبل الحصة الأولى.",

    sentTo: (p: string) => `الكود تبعث لـ ${p}`,
    changeNumber: "بدّل النمرة",
    devCodeNote: "كود للتجربة — توّا ما تتبعث حتى رسالة",
    codeHelp: "6 أرقام.",
    codeLabelEmail: "الكود اللي وصلك في الإيميل",
    codeLabelSms: "الكود اللي وصلك بالـ SMS",
    resend: "عاود ابعث الكود",
    resendReady: "تنجم تطلب كود جديد.",
    expiresIn: (t: string) => `هذا الكود يسالي في ${t}.`,
    expired: "هذا الكود سالا — اطلب واحد جديد.",

    errNeedPhone: "حطّ نمرة تليفونك.",
    errNeedBirthYear: "اختار سنة ولادة التلميذ.",
    haveAccount: "عندك حساب قبل ؟",
    signIn: "دخول",
    otherTutor: "إنتي أستاذ ؟ اعمل حساب أستاذ",
    otherStudent: "تلوّج على أستاذ ؟ اعمل حساب تلميذ",

    mismatchTitle: "هذا الحساب موجود",
    mismatchTutor: "هذا حساب أستاذ. إنتي داخل — هاذي لوحتك.",
    mismatchStudent: "هذا حساب تلميذ. إنتي داخل — هاذي حصصك.",
    mismatchNote: "حساب واحد للشخص. باش تقرّي بحساب تلميذ، عدّي من «ولّي أستاذ» من فضاءك.",
    goDashboard: "امشي للوحتي",
    goStudent: "شوف حصصي",
  },
} as const;

/* `channel` comes from the SERVER shell (otpChannel()), so flipping OTP_CHANNEL
   back to sms swaps this form to a phone field on the next restart — no rebuild, no
   code change. Everything below is written against a neutral "identifier". */
export function SignupInner({
  role,
  next,
  channel,
}: {
  role: SignupRole;
  next: string | null;
  channel: OtpChannel;
}) {
  const { t, locale } = useLocale();
  const c = COPY[locale];
  const router = useLocalizedRouter();
  const isStudent = role === "student";
  const isEmail = channel === "email";

  const [identifier, setIdentifier] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* Neutral guidance, not a failure — styled and announced as information. */
  const [notice, setNotice] = useState<string | null>(null);
  // Only true once a send actually reported a TTL — without it the "expired" state
  // would fire immediately, before any code has been requested.
  const [hadExpiry, setHadExpiry] = useState(false);

  /* Two countdowns, both driven by numbers the SERVER returns:
       cooldown — the 60s gap between sends (OTP_RESEND_COOLDOWN_SEC)
       expiry   — how long this code stays valid (OTP_TTL_SEC)
     Neither duration is hardcoded here; see the note on those constants. */
  const cooldown = useCountdown();
  const expiry = useCountdown();
  const expired = codeSent && hadExpiry && expiry.done;
  /* Resend is available once the cooldown ends — and unconditionally once the code
     has expired, because the 5-minute life always outlasts the 60s gap, so being
     blocked at that point could only ever be the UI lagging the server. */
  const canResend = cooldown.done || expired;
  /* Set when the phone already belongs to an account of the OTHER role. We stay on
     this page and explain, rather than redirecting somewhere that contradicts the
     page they deliberately opened. */
  const [existingRole, setExistingRole] = useState<string | null>(null);

  const ar = locale === "ar";

  /* One send path for the first code and every resend. `resend` only changes how
     the result is presented: a resend keeps the user on the code step, and a
     "too-soon" answer arms the countdown instead of showing a red error — the
     server is simply telling us a rule the UI had not drawn yet (which is exactly
     what happens after a page reload, when the client has no timer but the server
     still has the cooldown). */
  async function send(resend: boolean) {
    if (loading) return;
    const id = identifier.trim();
    if (!id) { setError(isEmail ? c.errNeedEmail : c.errNeedPhone); return; }
    // Same check the server runs, so a typo is caught before we spend a send.
    if (isEmail && !isValidEmail(id.toLowerCase())) { setError(c.errBadEmail); return; }
    setLoading(true);
    setError(null);
    setNotice(null);
    let res: Awaited<ReturnType<typeof requestOtp>>;
    try {
      // `id`, not `identifier`: only the display copy was trimmed before.
      res = await requestOtp({ identifier: id, locale });
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
      if (resend) setCode("");   // the previous code is dead — createOtp replaced it
      armTimers(res.resendAfter, res.expiresIn);
      return;
    }
    if (res.error === "too-soon") {
      // Arm from the server's own answer rather than scolding the user.
      if (res.retryAfter) cooldown.start(res.retryAfter);
      if (!resend) {
        /* A cooldown on a FIRST send means a live code was already sent to this
           address — almost always a mid-flow reload. Advance to the code step so
           the code sitting in their inbox is usable, instead of stranding them on
           the address step behind a red error. */
        setCodeSent(true);
        setError(null);
        setNotice(c.alreadySent);
      }
    } else if (res.error === "send-failed") {
      setError(c.errSend);
    } else if (res.error === "invalid-email") {
      setError(c.errBadEmail);
    } else if (res.error === "invalid-phone") {
      setError(ar ? "رقم الهاتف موش صحيح." : "Numéro de téléphone invalide.");
    } else {
      setError(t.extra.error);
    }
  }

  /* A missing duration means "no rule known" → leave the timer at zero so the
     button stays available, and let a "too-soon" answer arm it. Never invent a
     local default: a wrong guess would disable a button the server would allow. */
  function armTimers(resendAfter?: number, expiresIn?: number) {
    cooldown.start(resendAfter ?? 0);
    expiry.start(expiresIn ?? 0);
    setHadExpiry(Boolean(expiresIn));
  }

  /* Carry ?next= across every exit from this screen. Without it, a visitor bounced
     off /checkout who turns out to already have an account — or who taps through to
     the other audience — loses the booking they came for even though they end up
     signed in. Same helper AuthInner uses. */
  const withNext = (path: string) => (next ? `${path}?next=${encodeURIComponent(next)}` : path);

  const handleSendCode = () => send(false);
  const handleResend = () => send(true);

  /* Digits only, then submit on the sixth. See the twin in AuthInner: the code is
     passed explicitly because setCode has not landed yet when this fires. */
  function onCodeChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (digits.length === 6 && !loading) void verifyWith(digits);
  }

  const handleVerify = () => verifyWith(code);

  async function verifyWith(submitted: string) {
    if (loading) return;
    if (!submitted.trim()) { setError(c.codeHelp); return; }
    setLoading(true);
    setError(null);
    setNotice(null);
    let res: Awaited<ReturnType<typeof verifyOtp>>;
    try {
      res = await verifyOtp({
        identifier: identifier.trim(),
        code: submitted,
        role,
        locale,
        birthYear: birthYear ? Number(birthYear) : undefined,
      });
    } catch {
      setLoading(false);
      setError(t.extra.error);
      return;
    }
    setLoading(false);
    if (!res.ok) {
      /* This screen had NO branching at all: every failure, including a single
         mistyped digit, rendered "Une erreur s'est produite." Same split as
         AuthInner — throttling is distinct, wrong and expired stay merged because
         separating them would leak whether the account exists. */
      if (res.error === "too-many-attempts") {
        setError(c.errTooManyAttempts(res.retryAfter ?? 900));
        return;
      }
      if (res.error === "invalid-code") { setError(c.errBadCode); return; }
      setError(t.extra.error);
      return;
    }
    if (res.roleMismatch) {
      setExistingRole(res.role ?? null);
      return;
    }
    router.push(postAuthDestination(res, next));
  }

  // A ~5-year-old pupil down to a ~85-year-old learner. Inside vBirthYear's
  // accepted range; the server re-validates and fails safe either way.
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 81 }, (_, i) => currentYear - 5 - i);

  const title = isStudent ? c.studentTitle : c.tutorTitle;
  const lead = isStudent
    ? (isEmail ? c.studentLead : c.studentLeadSms)
    : (isEmail ? c.tutorLead : c.tutorLeadSms);
  const perks = isStudent ? c.studentPerks : c.tutorPerks;

  /* ── The number already has an account of the other kind ── */
  if (existingRole) {
    const asTutor = existingRole === "tutor";
    return (
      <SiteShell>
        <section className="web-section">
          <div className="container container-narrow flex justify-center">
            <div className="panel panel-pad rise w-full max-w-[460px] min-w-0">
              <h1 className="font-display text-[clamp(22px,_4vw,_28px)] tracking-[-0.6px] mb-1.5 text-ink">
                {c.mismatchTitle}
              </h1>
              <p className="text-[13.5px] text-ink2 mb-4 leading-[1.55]">
                {asTutor ? c.mismatchTutor : c.mismatchStudent}
              </p>
              <p className="text-[13px] text-muted mb-5 leading-[1.6]">{c.mismatchNote}</p>
              <Link href={withNext(asTutor ? "/dashboard" : "/student")} className="btn btn-primary">
                {asTutor ? c.goDashboard : c.goStudent}
              </Link>
            </div>
          </div>
        </section>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <section className="web-section">
        <div className="container container-narrow flex justify-center">
          <div className="panel panel-pad rise w-full max-w-[460px] min-w-0">
            <h1 className="font-display text-[clamp(22px,_4vw,_28px)] tracking-[-0.6px] mb-1.5 text-ink">
              {title}
            </h1>
            <p className="text-[13.5px] text-muted mb-5 leading-[1.55]">{lead}</p>

            {/* What this account actually gets you — three facts, role-specific.
                This is the whole reason the funnel is split: the two audiences want
                different things and a shared toggle could speak to neither. */}
            <ul className="list-none flex flex-col gap-2 mb-6">
              {perks.map((p) => (
                <li key={p} className="flex items-start gap-[9px] text-[13.5px] text-ink2 leading-[1.5]">
                  <Check className="w-4 h-4 text-green-ink flex-none mt-0.5" />
                  <span className="min-w-0">{p}</span>
                </li>
              ))}
            </ul>

            {/* A real <form> so Enter submits — this was loose divs with onClick. */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (codeSent) handleVerify();
                else handleSendCode();
              }}
              noValidate
            >
            <Field label={isEmail ? c.email : t.auth.phone}>
              <div className="inp">
                {isEmail ? <Mail className="" /> : <Phone className="" />}
                {!isEmail && (
                  <span className="pre whitespace-nowrap shrink-0" dir="ltr">+216</span>
                )}
                <input
                  /* dir="ltr" in both modes: an address and a phone number are both
                     left-to-right even on the Arabic (RTL) page. */
                  type={isEmail ? "email" : "tel"}
                  dir="ltr"
                  placeholder={isEmail ? c.emailPh : t.auth.phonePh}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  inputMode={isEmail ? "email" : "tel"}
                  autoComplete={isEmail ? "email" : "tel"}
                  autoCapitalize="off"
                  spellCheck={false}
                  disabled={codeSent}
                  className="min-w-0"
                />
              </div>
            </Field>

            {/* Birth year — students only. Drives the minor-consent gate. */}
            {isStudent && (
              <Field label={c.byLabel}>
                <div className="inp">
                  <Calendar className="" />
                  <select
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    disabled={codeSent}
                    required
                    aria-required="true"
                    aria-label={c.byLabel}
                    className="min-w-0 w-full border-0 bg-transparent font-[inherit] disabled:cursor-not-allowed"
                    style={{ color: birthYear ? "var(--ink)" : "var(--muted)" }}
                  >
                    <option value="" disabled>{c.byPh}</option>
                    {years.map((y) => (
                      <option key={y} value={y} className="text-ink">{y}</option>
                    ))}
                  </select>
                </div>
                <p className="text-[13px] text-muted mt-1.5 leading-[1.5]">{c.byNote}</p>
              </Field>
            )}

            {/* role="alert" so screen readers announce it on change */}
            {error && (
              <p role="alert" className="text-rose text-[13px] font-semibold leading-[1.5] mb-3 text-start">
                {error}
              </p>
            )}
            {notice && !error && (
              <p role="status" className="text-[13px] text-ink2 font-semibold leading-[1.5] mb-3 text-start">
                {notice}
              </p>
            )}

            {!codeSent ? (
              <>
                <Button type="submit" variant="primary" disabled={loading}>
                  {loading ? t.common.loading : t.auth.sendCode}
                </Button>
                {/* For someone who reloaded mid-flow: reach the code they already
                    have without spending a send or waiting out a cooldown. */}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => { setError(null); setNotice(null); setCodeSent(true); }}
                    className="linklike bg-transparent border-0 text-[13px] min-h-[44px] min-w-[44px] font-[inherit]"
                  >
                    {c.haveCode}
                  </button>
                </div>
              </>
            ) : (
              <div className="rise">
                <div className="flex items-center justify-between gap-2.5 flex-wrap mb-3.5">
                  <span className="text-[13px] text-ink2 min-w-0">{c.sentTo(identifier.trim())}</span>
                  <button
                    type="button"
                    className="linklike bg-transparent border-0 text-[13px] min-h-[44px] min-w-[44px] flex-none font-[inherit]"
                    onClick={() => {
                      setCodeSent(false); setCode(""); setDevCode(null); setError(null);
                      // The timers describe a code that is no longer on screen.
                      cooldown.start(0); expiry.start(0); setHadExpiry(false);
                    }}
                  >
                    {isEmail ? c.changeEmail : c.changeNumber}
                  </button>
                </div>

                {/* Local development only. requestOtp() returns the code ONLY when
                    NODE_ENV is not "production" AND no provider is configured; a
                    production deploy with no mail or SMS credentials now fails the
                    send outright rather than printing a stranger's code here. */}
                {devCode && (
                  <div className="bg-sand border-[1.4px] border-dashed border-ochre-btn rounded-brand py-2.5 px-3 mb-3.5 text-center text-[13px] text-ink2 leading-[1.5]">
                    <b className="font-display text-[18px] tracking-[3px] text-ink block" dir="ltr">
                      {devCode}
                    </b>
                    {c.devCodeNote}
                  </div>
                )}

                {/* Email's one genuinely new failure mode, and by far the most
                    common support question an OTP-by-mail flow produces. */}
                {isEmail && (
                  <p className="text-[13px] text-muted leading-[1.5] mb-3.5">{c.spam}</p>
                )}

                <Field label={isEmail ? c.codeLabelEmail : c.codeLabelSms} help={c.codeHelp}>
                  <div className="inp">
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="000000"
                      value={code}
                      onChange={(e) => onCodeChange(e.target.value)}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      autoFocus
                      className="min-w-0 tracking-[3px] font-display"
                    />
                  </div>
                </Field>

                <Button type="submit" variant="primary" disabled={loading}>
                  {loading ? t.common.loading : t.auth.verify}
                </Button>

                {/* ── Resend + the two countdowns ──
                    Before this there was no way to ask for another code at all: the
                    only control here reset the whole form. A code that lands in spam,
                    or arrives after the user has looked away, had no recovery.

                    Both durations come from the server (requestOtp returns them), so
                    the button can never re-enable while the server still refuses. ── */}
                <div className="mt-3.5 text-center">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={loading || !canResend}
                    className="linklike bg-transparent border-0 text-[13px] min-h-[44px] min-w-[44px] font-[inherit] disabled:opacity-60 disabled:cursor-default"
                  >
                    {c.resend}
                    {/* aria-hidden: a value that changes every second would be read
                       aloud every second. The button's disabled state carries the
                       meaning; the live region below announces the one transition
                       that matters. */}
                    {!canResend && (
                      <span aria-hidden="true"> ({formatCountdown(cooldown.left)})</span>
                    )}
                  </button>

                  {/* Ticking reassurance, decorative for the same reason. */}
                  {!expired && expiry.left > 0 && (
                    <p aria-hidden="true" className="text-[13px] text-muted leading-[1.5] mt-1">
                      {c.expiresIn(formatCountdown(expiry.left))}
                    </p>
                  )}

                  {/* The only live region: it changes at most twice (cooldown ends,
                     then the code expires), never once per second.

                     Rendered even while empty, deliberately — a live region has to be
                     in the DOM BEFORE its content changes or the change is not
                     announced at all. Do not "simplify" this to render only when
                     there is a message. */}
                  <p role="status" className="text-[13px] text-muted leading-[1.5] mt-1">
                    {expired ? c.expired : canResend ? c.resendReady : ""}
                  </p>
                </div>
              </div>
            )}
            </form>

            {/* The two exits: I already have an account, or I'm the other audience. */}
            <div className="mt-6 pt-5 border-t border-line flex flex-col gap-2 text-[13px] text-muted leading-[1.6]">
              <p>
                {c.haveAccount}{" "}
                <Link
                  href={withNext("/auth")}
                  className="linklike inline-flex items-center justify-center min-h-[44px] min-w-[44px]"
                >
                  {c.signIn}
                </Link>
              </p>
              <Link href={withNext(isStudent ? "/signup/prof" : "/signup/eleve")} className="linklike">
                {isStudent ? c.otherTutor : c.otherStudent}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
