"use client";
import { useEffect, useState } from "react";
import { Link } from "@/components/Link";
import { useLocale } from "@/components/LocaleProvider";
import { Spinner } from "@/components/ui";
import { SiteShell } from "@/components/SiteShell";
import { Forward, Shield } from "@/components/icons";
import { getThreads } from "@/app/actions";
import type { MessageThreadSummary } from "@tnajem/shared";
import { bilingual } from "@/lib/i18n";

/* THE INBOX. Step 8b — the channel that replaces the contact details Step 8
   closed.

   There is no "new message" button anywhere, and that is the design, not an
   omission: a thread exists only where a booking does. The empty state says so,
   because a user who cannot find a compose button will otherwise assume the page
   is broken. */

const copy = bilingual({
  fr: {
    eyebrow: "MESSAGES",
    title: "Tes conversations",
    sub: "Une conversation par séance réservée.",
    loading: "Chargement…",
    emptyTitle: "Pas encore de conversation",
    emptyBody:
      "Une conversation s'ouvre dès qu'une place est réservée — côté élève comme côté prof. Il n'y a pas de messagerie ouverte : on ne peut écrire qu'à quelqu'un avec qui on a une séance.",
    exploreCta: "Trouver un prof",
    dashboardCta: "Voir mes séances",
    noMessagesYet: "Aucun message pour l'instant",
    minor: "Élève mineur",
    withTutor: "avec ton prof",
    withStudent: "avec ton élève",
    privacy: "Les coordonnées (numéro, email, lien) sont retirées automatiquement des messages.",
  },
  ar: {
    eyebrow: "الرسائل",
    title: "محادثاتك",
    sub: "محادثة وحدة لكل حصة محجوزة.",
    loading: "قاعد يحمّل…",
    emptyTitle: "ما فمّاش محادثات لتوّا",
    emptyBody:
      "المحادثة تتحلّ كي تتحجز بلاصة — من جهة التلميذ ومن جهة الأستاذ. ما فمّاش مراسلة مفتوحة: تنجّم تكتب برك لواحد عندك معاه حصة.",
    exploreCta: "لقّي أستاذ",
    dashboardCta: "شوف حصصي",
    noMessagesYet: "ما فمّاش رسائل لتوّا",
    minor: "تلميذ قاصر",
    withTutor: "مع أستاذك",
    withStudent: "مع تلميذك",
    privacy: "معلومات الاتصال (النمرة، الإيميل، الرابط) تتنحّى آليًا من الرسائل.",
  },
});

function whenLabel(iso: string | null, locale: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(locale === "ar" ? "ar-TN" : "fr-FR", {
    day: "2-digit",
    month: "short",
  });
}

export default function MessagesPage() {
  const { locale } = useLocale();
  const c = copy[locale];
  const [threads, setThreads] = useState<MessageThreadSummary[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getThreads()
      .then((t) => setThreads(t ?? []))
      .catch(() => setThreads([]))
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
            <Shield className="w-4 h-4 flex-none mt-0.5" />
            <p className="text-[13px] text-muted leading-[1.6]">{c.privacy}</p>
          </div>

          {loading ? (
            <div className="panel panel-pad grid place-items-center min-h-[160px]">
              <Spinner />
              <span className="sr-only">{c.loading}</span>
            </div>
          ) : threads && threads.length > 0 ? (
            <div className="panel panel-pad">
              {threads.map((t) => (
                <Link
                  key={t.id}
                  href={`/messages/${t.id}`}
                  className="flex items-center gap-3 py-3.5 border-b border-line last:border-b-0"
                  style={{ color: "inherit" }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold truncate">{t.classTitle}</div>
                    <div className="text-[13px] text-muted mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>
                        {t.withName ?? (t.iAm === "tutor" ? c.withStudent : c.withTutor)}
                      </span>
                      {t.studentIsMinor && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-bold">{c.minor}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>{t.lastMessageAt ? whenLabel(t.lastMessageAt, locale) : c.noMessagesYet}</span>
                    </div>
                  </div>
                  <Forward className="w-4 h-4 flex-none" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="panel panel-pad text-center">
              <h2 className="font-display text-[16px] font-bold mb-1.5">{c.emptyTitle}</h2>
              <p className="text-[13px] text-muted leading-[1.6] mb-3.5">{c.emptyBody}</p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Link href="/explore" className="btn btn-ink btn-sm">{c.exploreCta}</Link>
                <Link href="/student" className="btn btn-ghost btn-sm">{c.dashboardCta}</Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
