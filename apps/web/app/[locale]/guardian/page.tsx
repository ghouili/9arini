"use client";
import { useCallback, useEffect, useState } from "react";
import { Link } from "@/components/Link";
import { useLocale } from "@/components/LocaleProvider";
import { Spinner } from "@/components/ui";
import { SiteShell } from "@/components/SiteShell";
import { Shield, Clock, Forward } from "@/components/icons";
import { UserText } from "@/components/UserText";
import { getMyChildren, getChildThreads, withdrawConsent, grantConsent } from "@/app/actions";
import { formatInTunis, monthLabel, type GuardianChild, type MessageThreadSummary } from "@tnajem/shared";
import { bilingual } from "@/lib/i18n";

/* THE PARENT'S VIEW (Step 14).

   READ-ONLY, and the page says so rather than leaving it to be discovered. There
   is no compose box, no cancel button and no booking flow anywhere here: a parent
   acting AS their child would put words or money in a minor's name from an
   account the child does not control, and the audit trail would say the child did
   it. Oversight is not impersonation.

   The empty state carries the real weight. A parent who signs a consent form and
   then lands on a blank page concludes the account does not work — so it names
   the one thing that actually causes it: the address on the consent has to be
   theirs. */

const copy = bilingual({
  fr: {
    eyebrow: "ESPACE PARENT",
    title: "Tes enfants",
    sub: "Ce qu'ils ont réservé, et avec qui ils échangent.",

    emptyTitle: "Aucun enfant lié à ce compte",
    emptyBody:
      "Un compte parent est lié par l'adresse e-mail indiquée sur l'autorisation parentale. Si tu ne vois rien ici, c'est probablement qu'une autre adresse a été saisie — ton enfant peut refaire l'autorisation depuis son compte.",

    readOnly:
      "Tu peux voir et lire, mais pas écrire à la place de ton enfant ni réserver pour lui. Une seule décision t'appartient : ton accord, que tu peux retirer ou redonner.",
    notContact:
      "Les coordonnées des profs ne sont jamais partagées, pas plus avec toi qu'avec ton enfant. Tout passe par la messagerie de Tnajem.",

    upcoming: "Séances à venir",
    noUpcoming: "Aucune séance à venir.",
    with: "avec",
    conversations: (n: number) =>
      n === 0 ? "Aucune conversation" : n === 1 ? "1 conversation" : `${n} conversations`,
    read: "Lire",
    hide: "Masquer",
    noThreads: "Aucune conversation pour l'instant.",
    loading: "Chargement…",
    minor: "Moins de 18 ans",

    consentTitle: "Ton accord",
    consentGiven: (d: string, v: string) => `Donné le ${d} (politique de confidentialité, version ${v}).`,
    consentWithdrawn: (d: string) => `Retiré le ${d}. Ton enfant ne peut plus réserver de séance.`,
    withdraw: "Retirer mon accord",
    withdrawConfirm:
      "Ton enfant ne pourra plus réserver, et ses séances à venir seront annulées sans frais (chaque prof est prévenu qu'une place s'est libérée). Tu pourras redonner ton accord ici.",
    withdrawYes: "Oui, retirer mon accord",
    keep: "Garder mon accord",
    withdrawn: (n: number) => (n > 0 ? `Accord retiré. ${n} séance(s) à venir annulée(s).` : "Accord retiré."),
    grant: "Redonner mon accord",
    granted: "Accord redonné. Ton enfant peut de nouveau réserver.",
    consentError: "Ça n'a pas marché. Réessaie.",
  },
  ar: {
    eyebrow: "فضاء الولي",
    title: "أولادك",
    sub: "شنوّة حجزو، ومع شكون يتحادثو.",

    emptyTitle: "ما فمّاش ولد مربوط بالحساب هذا",
    emptyBody:
      "حساب الولي يترابط بالإيميل اللي تكتب في موافقة الولي. كان ما تشوف شي هوني، غالبا تكتب إيميل آخر — ولدك ينجّم يعاود الموافقة من حسابو.",

    readOnly:
      "تنجّم تشوف وتقرا، أما ما تنجّمش تكتب في بلاصة ولدك ولا تحجزلو. قرار واحد متاعك: موافقتك، تنجّم تسحبها ولا ترجّعها.",
    notContact:
      "معلومات الاتصال متاع الأساتذة عمرها ما تتشارك، لا معاك لا مع ولدك. كل شي يعدّي من مراسلة Tnajem.",

    upcoming: "الحصص الجاية",
    noUpcoming: "ما فمّاش حصص جاية.",
    with: "مع",
    conversations: (n: number) => (n === 0 ? "ما فمّاش محادثات" : `${n} محادثة`),
    read: "اقرا",
    hide: "خبّي",
    noThreads: "ما فمّاش محادثات لتوّا.",
    loading: "قاعد يحمّل…",
    minor: "أقلّ من 18 سنة",

    consentTitle: "موافقتك",
    consentGiven: (d: string, v: string) => `تعطات نهار ${d} (سياسة الخصوصية، نسخة ${v}).`,
    consentWithdrawn: (d: string) => `تسحبت نهار ${d}. ولدك ما عادش ينجّم يحجز حصص.`,
    withdraw: "اسحب موافقتي",
    withdrawConfirm:
      "ولدك ما عادش باش ينجّم يحجز، والحصص الجاية متاعو تتلغى بلا مصاريف (كل أستاذ يتعلم اللي بلاصة تسرّحت). تنجّم ترجّع موافقتك من هوني.",
    withdrawYes: "إي، اسحب موافقتي",
    keep: "خلّي موافقتي",
    withdrawn: (n: number) => (n > 0 ? `الموافقة تسحبت. ${n} حصة جاية تلغات.` : "الموافقة تسحبت."),
    grant: "رجّع موافقتي",
    granted: "الموافقة رجعت. ولدك ينجّم يحجز من جديد.",
    consentError: "ما مشاتش. عاود.",
  },
});

function ConsentBlock({ child, onChanged }: { child: GuardianChild; onChanged: () => Promise<void> }) {
  const { locale } = useLocale();
  const c = copy[locale];
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!child.consent) return null;
  const date = (iso: string) => formatInTunis(iso, locale, { day: "numeric", month: "long", year: "numeric" });

  async function act(kind: "withdraw" | "grant") {
    setBusy(true);
    setMessage(null);
    try {
      if (kind === "withdraw") {
        const res = await withdrawConsent(child.id);
        setMessage(res.ok ? c.withdrawn(res.releasedBookings ?? 0) : c.consentError);
      } else {
        const res = await grantConsent(child.id);
        setMessage(res.ok ? c.granted : c.consentError);
      }
      setConfirming(false);
      await onChanged();
    } catch {
      setMessage(c.consentError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-line" data-e2e="consent-block">
      <h3 className="text-[13px] font-semibold mb-1">{c.consentTitle}</h3>
      <p className="text-[13px] text-muted leading-[1.6] mb-2">
        {child.consent.withdrawnAt
          ? c.consentWithdrawn(date(child.consent.withdrawnAt))
          : c.consentGiven(date(child.consent.signedAt), child.consent.policyVersion)}
      </p>
      {message && <p role="status" className="text-[13px] font-semibold mb-2">{message}</p>}
      {child.consent.withdrawnAt ? (
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act("grant")}>{c.grant}</button>
      ) : confirming ? (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] leading-[1.6] m-0">{c.withdrawConfirm}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ink btn-sm" disabled={busy} onClick={() => act("withdraw")}>{c.withdrawYes}</button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setConfirming(false)}>{c.keep}</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(true)}>{c.withdraw}</button>
      )}
    </div>
  );
}

function ChildCard({ child, onChanged }: { child: GuardianChild; onChanged: () => Promise<void> }) {
  const { locale } = useLocale();
  const c = copy[locale];
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<MessageThreadSummary[] | null>(null);

  const load = useCallback(async () => {
    const t = await getChildThreads(child.id).catch(() => null);
    setThreads(t ?? []);
  }, [child.id]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    // Fetched only when asked for: a parent with four children should not pull
    // four conversation lists to look at one booking.
    if (next && threads === null) await load();
  }

  return (
    <div className="panel panel-pad mb-[clamp(14px,2vw,22px)]">
      <div className="flex items-baseline justify-between gap-2.5 flex-wrap mb-2">
        <UserText as="h2" className="font-display text-[17px] font-bold">{child.name}</UserText>
        {child.isMinor && (
          <span className="text-[12px] font-bold text-muted uppercase tracking-[.5px]">{c.minor}</span>
        )}
      </div>

      <h3 className="text-[13px] font-semibold mb-1.5">{c.upcoming}</h3>
      {child.upcoming.length === 0 ? (
        <p className="text-[13px] text-muted mb-3">{c.noUpcoming}</p>
      ) : (
        <ul className="flex flex-col mb-3" role="list">
          {child.upcoming.map((u) => (
            <li key={u.classId} className="flex items-start gap-2.5 py-2 border-b border-line last:border-b-0">
              <Clock className="w-4 h-4 flex-none mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <UserText as="div" className="text-[14px] font-semibold">{u.title}</UserText>
                <div className="text-[13px] text-muted mt-0.5">
                  <time dateTime={u.starts_at}>{u.day} {monthLabel(u.month, locale)} · {u.time}</time> · {c.with} <UserText>{u.tutorName}</UserText>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-[13px] text-muted">{c.conversations(child.threadCount)}</span>
        {child.threadCount > 0 && (
          <button type="button" onClick={toggle} className="btn btn-ghost btn-sm" aria-expanded={open}>
            {open ? c.hide : c.read}
          </button>
        )}
      </div>

      {open && (
        <ul className="mt-2.5 flex flex-col" role="list">
          {threads === null ? (
            <li className="py-3 grid place-items-center">
              <Spinner />
              <span className="sr-only">{c.loading}</span>
            </li>
          ) : threads.length === 0 ? (
            <li className="text-[13px] text-muted py-2">{c.noThreads}</li>
          ) : (
            threads.map((t) => (
              <li key={t.id} className="py-2 border-b border-line last:border-b-0">
                <Link
                  href={`/guardian/threads/${t.id}`}
                  className="flex items-center gap-2.5"
                  style={{ color: "inherit" }}
                >
                  <div className="min-w-0 flex-1">
                    <UserText as="div" className="text-[14px] font-semibold truncate">{t.classTitle}</UserText>
                    <div className="text-[13px] text-muted mt-0.5">
                      {c.with} <UserText>{t.withName}</UserText>
                    </div>
                  </div>
                  <Forward className="w-4 h-4 flex-none" aria-hidden="true" />
                </Link>
              </li>
            ))
          )}
        </ul>
      )}

      <ConsentBlock child={child} onChanged={onChanged} />
    </div>
  );
}

export default function GuardianPage() {
  const { locale } = useLocale();
  const c = copy[locale];
  const [children, setChildren] = useState<GuardianChild[] | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const k = await getMyChildren().catch(() => null);
    setChildren(k ?? []);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  return (
    <SiteShell>
      <section className="web-section">
        <div className="container container-narrow max-w-[760px]">
          <div className="mb-[clamp(20px,3vw,36px)]">
            <div className="text-[13px] font-bold text-muted uppercase tracking-[.5px] mb-1.5">
              {c.eyebrow}
            </div>
            <h1 className="web-h1">{c.title}</h1>
            <p className="text-[14px] text-muted mt-1.5">{c.sub}</p>
          </div>

          <div className="panel panel-pad mb-[clamp(14px,2vw,22px)] flex items-start gap-2.5">
            <Shield className="w-4 h-4 flex-none mt-0.5" aria-hidden="true" />
            <div className="text-[13px] text-muted leading-[1.6]">
              <p>{c.readOnly}</p>
              <p className="mt-1.5">{c.notContact}</p>
            </div>
          </div>

          {loading ? (
            <div className="panel panel-pad grid place-items-center min-h-[160px]">
              <Spinner />
              <span className="sr-only">{c.loading}</span>
            </div>
          ) : children && children.length > 0 ? (
            children.map((k) => <ChildCard key={k.id} child={k} onChanged={refresh} />)
          ) : (
            <div className="panel panel-pad text-center">
              <h2 className="font-display text-[16px] font-bold mb-1.5">{c.emptyTitle}</h2>
              <p className="text-[13px] text-muted leading-[1.6]">{c.emptyBody}</p>
            </div>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
