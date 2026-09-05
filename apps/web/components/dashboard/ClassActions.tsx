"use client";
import { useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { cancelClass, rescheduleClass } from "@/app/actions";
import { bilingual } from "@/lib/i18n";

/* CANCEL OR MOVE A CLASS (Step 11), from the tutor's own dashboard.

   TWO CONFIRMATIONS, and they say different things, because the consequences are
   different. Cancelling ends the class for everyone who booked it and cannot be
   undone; moving it keeps every seat and only changes the time. A single generic
   "are you sure?" would make the destructive one feel like the safe one.

   Both spell out what happens to the STUDENTS, since that is the part a tutor
   cannot see from here and the part they are actually deciding about. */

const copy = bilingual({
  fr: {
    cancel: "Annuler la séance",
    reschedule: "Déplacer",
    keep: "Garder la séance",
    back: "Retour",

    confirmCancel: "Annuler cette séance ?",
    cancelBody:
      "Toutes les places réservées sont libérées et chaque élève est prévenu. Rien n'est retenu : c'est toi qui annules, ils ne doivent rien. C'est définitif.",
    confirmCancelCta: "Oui, annuler",
    cancelling: "Annulation…",

    confirmMove: "Nouvelle date et heure",
    moveBody:
      "Personne n'est désinscrit : les élèves sont prévenus du nouvel horaire. Ceux qui avaient déjà réservé pourront annuler sans frais, même à moins de 48h — ils n'avaient pas choisi ce créneau.",
    confirmMoveCta: "Déplacer la séance",
    moving: "Déplacement…",

    okCancelled: (n: number) =>
      n === 1 ? "Séance annulée. 1 élève prévenu." : `Séance annulée. ${n} élèves prévenus.`,
    okMoved: (n: number) =>
      n === 1 ? "Séance déplacée. 1 élève prévenu." : `Séance déplacée. ${n} élèves prévenus.`,
    errStarted: "Cette séance a déjà commencé.",
    errDate: "Choisis une date à venir.",
    errGeneric: "Ça n'a pas marché. Réessaie.",
  },
  ar: {
    cancel: "ألغي الحصة",
    reschedule: "بدّل الوقت",
    keep: "خلّي الحصة",
    back: "ارجع",

    confirmCancel: "تلغي الحصة هاذي ؟",
    cancelBody:
      "البلايص المحجوزة الكل تتسرّح وكل تلميذ يتعلم. ما يتحبس والو: إنت اللي لغيت، وما عليهم والو. القرار نهائي.",
    confirmCancelCta: "إي، ألغي",
    cancelling: "قاعد يلغي…",

    confirmMove: "التاريخ والوقت الجداد",
    moveBody:
      "حتّى حد ما يتشطب: التلامذة يتعلمو بالوقت الجديد. واللي كانو حاجزين ينجّمو يلغيو بلا مصاريف، حتى كان أقلّ من 48 ساعة — ما اختاروش الوقت هذا.",
    confirmMoveCta: "بدّل الوقت",
    moving: "قاعد يبدّل…",

    okCancelled: (n: number) => `الحصة تلغات. ${n} تلميذ تعلمو.`,
    okMoved: (n: number) => `الحصة تبدّلت. ${n} تلميذ تعلمو.`,
    errStarted: "الحصة هاذي بدات قبل.",
    errDate: "اختار تاريخ جاي.",
    errGeneric: "ما مشاتش. عاود حاول.",
  },
});

type Mode = "idle" | "confirm-cancel" | "confirm-move";

export function ClassActions({ classId, onChanged }: { classId: string; onChanged: () => void }) {
  const { locale } = useLocale();
  const c = copy[locale];
  const [mode, setMode] = useState<Mode>("idle");
  const [busy, setBusy] = useState(false);
  const [when, setWhen] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function messageFor(code: string | undefined): string {
    switch (code) {
      case "already-started": return c.errStarted;
      case "invalid-date":
      case "date-in-past": return c.errDate;
      default: return c.errGeneric;
    }
  }

  async function doCancel() {
    if (busy) return;
    setBusy(true);
    const res = await cancelClass({ classId }).catch(() => null);
    setBusy(false);
    setMode("idle");
    if (!res?.ok) { setMsg({ kind: "err", text: messageFor(res?.error) }); return; }
    setMsg({ kind: "ok", text: c.okCancelled(res.cancelled ?? 0) });
    onChanged();
  }

  async function doMove() {
    if (busy || !when) return;
    setBusy(true);
    const res = await rescheduleClass({ classId, scheduledAt: new Date(when).toISOString() })
      .catch(() => null);
    setBusy(false);
    if (!res?.ok) { setMsg({ kind: "err", text: messageFor(res?.error) }); return; }
    setMode("idle");
    setWhen("");
    setMsg({ kind: "ok", text: c.okMoved(res.notified ?? 0) });
    onChanged();
  }

  return (
    <div className="mt-2">
      {mode === "idle" && (
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => setMode("confirm-move")} className="btn btn-ghost btn-sm">
            {c.reschedule}
          </button>
          <button type="button" onClick={() => setMode("confirm-cancel")} className="btn btn-ghost btn-sm">
            {c.cancel}
          </button>
        </div>
      )}

      {mode === "confirm-cancel" && (
        <div className="rounded-[14px] p-3" style={{ background: "var(--cream)", border: "1px solid var(--line)" }}>
          <div className="text-[13px] font-bold mb-1">{c.confirmCancel}</div>
          <p className="text-[13px] text-muted leading-[1.6] mb-2.5">{c.cancelBody}</p>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={doCancel}
              disabled={busy}
              className="border-0 bg-rose text-white font-bold text-[13px] py-3 px-4 rounded-[999px] cursor-pointer min-h-11"
            >
              {busy ? c.cancelling : c.confirmCancelCta}
            </button>
            <button type="button" onClick={() => setMode("idle")} className="btn btn-ghost btn-sm">
              {c.keep}
            </button>
          </div>
        </div>
      )}

      {mode === "confirm-move" && (
        <div className="rounded-[14px] p-3" style={{ background: "var(--cream)", border: "1px solid var(--line)" }}>
          <label htmlFor={`when-${classId}`} className="block text-[13px] font-bold mb-1">
            {c.confirmMove}
          </label>
          <p className="text-[13px] text-muted leading-[1.6] mb-2.5">{c.moveBody}</p>
          <input
            id={`when-${classId}`}
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="w-full text-[14px] rounded-[12px] p-3 mb-2.5"
            style={{ border: "1px solid var(--line)", background: "var(--paper)" }}
          />
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={doMove} disabled={busy || !when} className="btn btn-ink btn-sm">
              {busy ? c.moving : c.confirmMoveCta}
            </button>
            <button type="button" onClick={() => setMode("idle")} className="btn btn-ghost btn-sm">
              {c.back}
            </button>
          </div>
        </div>
      )}

      {msg && (
        <p
          role={msg.kind === "err" ? "alert" : "status"}
          className="text-[13px] mt-2 leading-[1.6]"
          style={{ color: msg.kind === "err" ? "var(--rose)" : "var(--ink2)" }}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
