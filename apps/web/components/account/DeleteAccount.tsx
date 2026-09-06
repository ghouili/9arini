"use client";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { Spinner } from "@/components/ui";
import {
  getDeletionState,
  requestAccountDeletion,
  cancelAccountDeletion,
  type DeletionState,
} from "@/app/actions";
import { bilingual } from "@/lib/i18n";

/* CLOSING YOUR ACCOUNT (Step 15).

   THE COPY IS THE FEATURE HERE. Three things are true and none of them are
   guessable from a button labelled "delete", so each is said before the person
   commits rather than discovered afterwards:

     1. IT IS REVERSIBLE FOR 30 DAYS. The commonest reason to close an account is
        a bad day; the commonest regret is having done it irreversibly.
     2. REVIEWS STAY, WITHOUT THE NAME. Someone expecting their words to vanish
        deserves to know they will not — a tutor's public rating is not theirs to
        retract by leaving, and finding that out later feels like a betrayal.
     3. IT IS BLOCKED WHILE BOOKED, and the message says which side is blocking.
        "Something went wrong" on a deletion request reads as the product
        refusing to let you go.

   A two-step confirm, not a modal: the destructive control is never the one
   under the cursor when the section first renders. */

const copy = bilingual({
  fr: {
    title: "Supprimer mon compte",
    body:
      "Tu peux fermer ton compte quand tu veux. On te laisse 30 jours pour changer d'avis — pendant ce délai, tu peux tout annuler en revenant ici.",
    whatGoes:
      "Ensuite, ton compte, tes réservations, tes messages et tes informations sont supprimés définitivement.",
    whatStays:
      "Ce qui reste : les avis que tu as écrits, sans ton nom. La note d'un prof ne doit pas changer parce qu'un élève est parti — ton avis devient anonyme, il n'est pas effacé.",

    ask: "Supprimer mon compte",
    confirmTitle: "Confirmer la suppression ?",
    confirmBody: "Ton compte sera supprimé dans 30 jours. Tu peux annuler à tout moment d'ici là.",
    confirmCta: "Oui, lancer la suppression",
    keep: "Garder mon compte",
    working: "…",

    pendingTitle: "Suppression programmée",
    pendingBody: (d: string) => `Ton compte sera supprimé le ${d}. Tu peux encore tout annuler.`,
    undo: "Annuler la suppression",

    errBookings:
      "Tu as encore une séance à venir. Annule-la d'abord — ton prof doit savoir que tu ne viendras pas.",
    errClasses:
      "Tu as encore une séance programmée. Annule-la d'abord — tes élèves doivent être prévenus.",
    errGeneric: "Ça n'a pas marché. Réessaie.",
    loading: "Chargement…",
  },
  ar: {
    title: "امسح حسابي",
    body:
      "تنجّم تسكّر حسابك وقت ما تحب. نخلّيولك 30 يوم باش تبدّل رايك — في المدّة هاذي تنجّم تلغي كل شي كي ترجع لهوني.",
    whatGoes:
      "من بعد، حسابك، حجوزاتك، رسائلك ومعلوماتك يتمسحو نهائيًا.",
    whatStays:
      "اللي يبقى: التقييمات اللي كتبتهم، بلا إسمك. نقطة الأستاذ ما لازمش تتبدّل خاطر تلميذ مشى — تقييمك يولّي مجهول، ما يتمسحش.",

    ask: "امسح حسابي",
    confirmTitle: "تأكّد المسح ؟",
    confirmBody: "حسابك يتمسح بعد 30 يوم. تنجّم تلغي وقت ما تحب قبل.",
    confirmCta: "إي، ابدا المسح",
    keep: "خلّي حسابي",
    working: "…",

    pendingTitle: "المسح مبرمج",
    pendingBody: (d: string) => `حسابك يتمسح نهار ${d}. ما زال تنجّم تلغي.`,
    undo: "ألغي المسح",

    errBookings:
      "ما زال عندك حصة جاية. ألغيها الأول — أستاذك لازمو يعرف إلّي ما باش تجي.",
    errClasses:
      "ما زال عندك حصة مبرمجة. ألغيها الأول — تلامذتك لازمهم يتعلمو.",
    errGeneric: "ما مشاتش. عاود حاول.",
    loading: "قاعد يحمّل…",
  },
});

export function DeleteAccount() {
  const { locale } = useLocale();
  const c = copy[locale];
  const [state, setState] = useState<DeletionState | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const s = await getDeletionState().catch(() => null);
    setState(s ?? { requested: false, graceDays: 30 });
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function doRequest() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    const res = await requestAccountDeletion().catch(() => null);
    setBusy(false);
    setConfirming(false);
    if (!res?.ok) {
      /* Name WHICH side is blocking. A generic failure on a deletion request
         reads as the product refusing to let you leave. */
      setErr(
        res?.error === "has-upcoming-bookings" ? c.errBookings
          : res?.error === "has-upcoming-classes" ? c.errClasses
          : c.errGeneric,
      );
      return;
    }
    await load();
  }

  async function doCancel() {
    setBusy(true);
    const res = await cancelAccountDeletion().catch(() => null);
    setBusy(false);
    if (!res?.ok) { setErr(c.errGeneric); return; }
    setErr(null);
    await load();
  }

  if (!state) {
    return (
      <div className="panel panel-pad grid place-items-center min-h-[120px]">
        <Spinner />
        <span className="sr-only">{c.loading}</span>
      </div>
    );
  }

  if (state.requested && state.purgeAt) {
    const when = new Date(state.purgeAt).toLocaleDateString(locale === "ar" ? "ar-TN" : "fr-FR", {
      day: "2-digit", month: "long", year: "numeric",
    });
    return (
      <div className="panel panel-pad">
        <h2 className="font-display text-[16px] font-bold mb-1.5">{c.pendingTitle}</h2>
        <p className="text-[13px] text-muted leading-[1.6] mb-3">{c.pendingBody(when)}</p>
        <button type="button" onClick={doCancel} disabled={busy} className="btn btn-ink btn-sm">
          {busy ? c.working : c.undo}
        </button>
        {err && (
          <p role="alert" className="text-[13px] mt-2" style={{ color: "var(--rose)" }}>{err}</p>
        )}
      </div>
    );
  }

  return (
    <div className="panel panel-pad">
      <h2 className="font-display text-[16px] font-bold mb-1.5">{c.title}</h2>
      <p className="text-[13px] text-muted leading-[1.6] mb-2">{c.body}</p>
      <p className="text-[13px] text-muted leading-[1.6] mb-2">{c.whatGoes}</p>
      <p className="text-[13px] text-muted leading-[1.6] mb-3.5">{c.whatStays}</p>

      {!confirming ? (
        <button type="button" onClick={() => setConfirming(true)} className="btn btn-ghost btn-sm">
          {c.ask}
        </button>
      ) : (
        <div className="rounded-[14px] p-3" style={{ background: "var(--cream)", border: "1px solid var(--line)" }}>
          <div className="text-[13px] font-bold mb-1">{c.confirmTitle}</div>
          <p className="text-[13px] text-muted leading-[1.6] mb-2.5">{c.confirmBody}</p>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={doRequest}
              disabled={busy}
              className="border-0 bg-rose text-white font-bold text-[13px] py-3 px-4 rounded-[999px] cursor-pointer min-h-11"
            >
              {busy ? c.working : c.confirmCta}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="btn btn-ghost btn-sm">
              {c.keep}
            </button>
          </div>
        </div>
      )}

      {err && (
        <p role="alert" className="text-[13px] mt-2.5 leading-[1.6]" style={{ color: "var(--rose)" }}>
          {err}
        </p>
      )}
    </div>
  );
}
