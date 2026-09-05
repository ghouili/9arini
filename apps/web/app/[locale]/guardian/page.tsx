"use client";
import { useCallback, useEffect, useState } from "react";
import { Link } from "@/components/Link";
import { useLocale } from "@/components/LocaleProvider";
import { Spinner } from "@/components/ui";
import { SiteShell } from "@/components/SiteShell";
import { Shield, Clock, Forward } from "@/components/icons";
import { getMyChildren, getChildThreads } from "@/app/actions";
import type { GuardianChild, MessageThreadSummary } from "@tnajem/shared";
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
      "Lecture seule. Tu peux voir et lire, mais pas écrire à la place de ton enfant ni annuler ses séances.",
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
  },
  ar: {
    eyebrow: "فضاء الولي",
    title: "أولادك",
    sub: "شنوّة حجزو، ومع شكون يتحادثو.",

    emptyTitle: "ما فمّاش ولد مربوط بالحساب هذا",
    emptyBody:
      "حساب الولي يترابط بالإيميل اللي تكتب في موافقة الولي. كان ما تشوف شي هوني، غالبا تكتب إيميل آخر — ولدك ينجّم يعاود الموافقة من حسابو.",

    readOnly:
      "قراية برك. تنجّم تشوف وتقرا، أما ما تنجّمش تكتب في بلاصة ولدك ولا تلغي حصصو.",
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
  },
});

function ChildCard({ child }: { child: GuardianChild }) {
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
        <h2 className="font-display text-[17px] font-bold">{child.name}</h2>
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
                <div className="text-[14px] font-semibold">{u.title}</div>
                <div className="text-[13px] text-muted mt-0.5">
                  {u.day} {u.month} · {u.time} · {c.with} {u.tutorName}
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
                    <div className="text-[14px] font-semibold truncate">{t.classTitle}</div>
                    <div className="text-[13px] text-muted mt-0.5">
                      {c.with} {t.withName}
                    </div>
                  </div>
                  <Forward className="w-4 h-4 flex-none" aria-hidden="true" />
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default function GuardianPage() {
  const { locale } = useLocale();
  const c = copy[locale];
  const [children, setChildren] = useState<GuardianChild[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyChildren()
      .then((k) => setChildren(k ?? []))
      .catch(() => setChildren([]))
      .finally(() => setLoading(false));
  }, []);

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
            children.map((k) => <ChildCard key={k.id} child={k} />)
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
