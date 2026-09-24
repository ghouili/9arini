"use client";
import { useId, useState, type FormEvent } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { reportContent, requestTakedown } from "@/app/actions";
import { bilingual } from "@/lib/i18n";

/* REPORT A PROBLEM — no account needed (production readiness Stage 5).

   The person most likely to need this is a parent who landed on a storefront from
   a WhatsApp link and has no login, or a student already driven off the platform
   by what they are reporting. So it asks for no account and no contact details
   (the e-mail is optional), and it says plainly what happens next: a person reads
   it, and nothing is taken down automatically.

   On a MATERIAL it also offers the copyright route Terms §8 promises: a
   rights-holder can ask for a document to be removed. That claim needs a name and
   an e-mail (a human answers it) and goes to the takedown queue instead.

   A disclosure, not a modal: nothing traps focus, and the form sits where the
   button was. */

type Kind = "tutor" | "class" | "review" | "material";

const copy = bilingual({
  fr: {
    open: "Signaler un problème",
    openShort: "Signaler",
    close: "Fermer",
    kindAbuse: "Contenu inapproprié, danger ou comportement",
    kindCopyright: "Je suis l'auteur de ce document (droits d'auteur)",
    reason: "Qu'est-ce qui ne va pas ?",
    reasonHint: "10 caractères minimum. Tu peux coller un message ou un numéro : c'est une preuve, on le garde.",
    name: "Ton nom",
    email: "Ton e-mail (facultatif, si tu veux une réponse)",
    emailRequired: "Ton e-mail (pour qu'on te réponde)",
    promise: "Pas besoin de compte. Rien n'est retiré automatiquement : une personne de l'équipe lit chaque signalement.",
    send: "Envoyer",
    sending: "Envoi…",
    done: "Merci, c'est reçu. Une personne de l'équipe va le lire.",
    errReason: "Explique en quelques mots (10 caractères minimum).",
    errName: "Indique ton nom.",
    errEmail: "Cet e-mail n'est pas valide.",
    errRate: "Trop de signalements depuis cette connexion. Réessaie dans une heure.",
    errGone: "Ce contenu n'existe plus.",
    errGeneric: "L'envoi a échoué. Réessaie.",
  },
  ar: {
    open: "بلّغ على مشكل",
    openShort: "بلّغ",
    close: "سكّر",
    kindAbuse: "محتوى موش لايق، خطر ولا تصرّف",
    kindCopyright: "أنا صاحب الوثيقة هاذي (حقوق المؤلف)",
    reason: "شنوّة المشكل ؟",
    reasonHint: "10 حروف على الأقل. تنجّم تلصق رسالة ولا نومرو: هو دليل، نحتفظو بيه.",
    name: "إسمك",
    email: "الإيميل متاعك (اختياري، كان تحب جواب)",
    emailRequired: "الإيميل متاعك (باش نجاوبوك)",
    promise: "ما يلزمكش حساب. حتى حاجة ما تتنحّى آليًا: واحد من الفريق يقرا كل تبليغ.",
    send: "ابعث",
    sending: "قاعد يبعث…",
    done: "يعيشك، وصل. واحد من الفريق باش يقراه.",
    errReason: "اشرح في كلمتين (10 حروف على الأقل).",
    errName: "اكتب إسمك.",
    errEmail: "الإيميل هذا موش صحيح.",
    errRate: "برشا تبليغات من نفس الكونكسيون. عاود بعد ساعة.",
    errGone: "المحتوى هذا ما عادش موجود.",
    errGeneric: "ما وصلش. عاود.",
  },
});

export function ReportButton({ subjectKind, subjectId, compact = false }: { subjectKind: Kind; subjectId: string; compact?: boolean }) {
  const { locale } = useLocale();
  const c = copy[locale];
  const id = useId();
  const [open, setOpen] = useState(false);
  const [copyright, setCopyright] = useState(false);
  const [reason, setReason] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (reason.trim().length < 10) return setError(c.errReason);
    if (copyright && name.trim().length < 2) return setError(c.errName);
    setBusy(true);
    try {
      const res = copyright
        ? await requestTakedown({ materialId: subjectId, claimantName: name.trim(), claimantEmail: email.trim(), reason: reason.trim() })
        : await reportContent({ subjectKind, subjectId, reason: reason.trim(), reporterEmail: email.trim() || undefined });
      if (res.ok) {
        setDone(true);
        return;
      }
      const err = res.error ?? "";
      setError(
        err === "invalid-email" ? c.errEmail
          : err === "too-many-requests" ? c.errRate
          : err === "not-found" ? c.errGone
          : err.includes("reason") ? c.errReason
          : err.includes("name") ? c.errName
          : c.errGeneric,
      );
    } catch {
      setError(c.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <p role="status" className="text-[13px] text-green font-semibold" data-e2e="report-done">{c.done}</p>;
  }

  return (
    <div className="text-[13px]">
      <button
        type="button"
        className="linklike text-muted min-h-11 inline-flex items-center"
        aria-expanded={open}
        aria-controls={`${id}-form`}
        onClick={() => setOpen((v) => !v)}
        data-e2e="report-open"
      >
        {open ? c.close : compact ? c.openShort : c.open}
      </button>

      {open && (
        <form id={`${id}-form`} onSubmit={onSubmit} noValidate className="panel panel-pad mt-2 flex flex-col gap-3 text-start">
          {subjectKind === "material" && (
            <fieldset className="flex flex-col gap-1.5 border-0 p-0 m-0">
              <label className="flex gap-2 items-center min-h-11">
                <input type="radio" name={`${id}-kind`} checked={!copyright} onChange={() => setCopyright(false)} className="w-5 h-5 flex-none" />
                <span>{c.kindAbuse}</span>
              </label>
              <label className="flex gap-2 items-center min-h-11">
                <input type="radio" name={`${id}-kind`} checked={copyright} onChange={() => setCopyright(true)} className="w-5 h-5 flex-none" />
                <span>{c.kindCopyright}</span>
              </label>
            </fieldset>
          )}

          <label>
            <span className="field-label block mb-1.5">{c.reason}</span>
            <span className="inp block">
              <textarea
                rows={3}
                maxLength={2000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                aria-describedby={`${id}-hint`}
                aria-invalid={error === c.errReason || undefined}
                data-e2e="report-reason"
              />
            </span>
            <span id={`${id}-hint`} className="block text-[12px] text-muted mt-1 leading-[1.5]">{c.reasonHint}</span>
          </label>

          {copyright && (
            <label>
              <span className="field-label block mb-1.5">{c.name}</span>
              <span className="inp block">
                <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} />
              </span>
            </label>
          )}

          <label>
            <span className="field-label block mb-1.5">{copyright ? c.emailRequired : c.email}</span>
            <span className="inp block">
              <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={200} />
            </span>
          </label>

          <p className="text-[12px] text-muted leading-[1.6] m-0">{c.promise}</p>

          {error && <p role="alert" className="text-[13px] text-rose font-semibold m-0">{error}</p>}

          <div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy} data-e2e="report-send">
              {busy ? c.sending : c.send}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
