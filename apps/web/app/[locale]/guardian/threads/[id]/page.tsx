"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Link } from "@/components/Link";
import { useLocale } from "@/components/LocaleProvider";
import { Spinner } from "@/components/ui";
import { SiteShell } from "@/components/SiteShell";
import { Shield, Forward } from "@/components/icons";
import { getChildThread } from "@/app/actions";
import type { MessageThreadDetail } from "@tnajem/shared";
import { bilingual } from "@/lib/i18n";

/* A PARENT READING THEIR CHILD'S CONVERSATION (Step 14).

   ⚠ THERE IS NO COMPOSER ON THIS PAGE, and its absence is the feature. A parent
   who could type here would be writing AS their child, from an account the child
   does not control, and the tutor would have no way to tell who they were
   actually talking to. Rendering a disabled text box would be worse still — it
   advertises a capability that must not exist.

   Message bodies are rendered as TEXT NODES, same as the participant view: this
   is the product's only stored-XSS surface. Never dangerouslySetInnerHTML. */

const copy = bilingual({
  fr: {
    back: "Espace parent",
    loading: "Chargement…",
    gone: "Cette conversation n'existe pas, ou elle n'appartient pas à ton enfant.",
    backCta: "Retour",
    empty: "Aucun message dans cette conversation.",
    fromChild: "Ton enfant",
    masked: "Coordonnées retirées",
    readOnly:
      "Lecture seule. Tu ne peux pas répondre à la place de ton enfant — le prof doit savoir à qui il parle.",
    privacy: "Les coordonnées sont retirées automatiquement de tous les messages.",
    with: "avec",
  },
  ar: {
    back: "فضاء الولي",
    loading: "قاعد يحمّل…",
    gone: "المحادثة هاذي ما موجودةش، ولا ماهيش متاع ولدك.",
    backCta: "ارجع",
    empty: "ما فمّاش رسائل في المحادثة هاذي.",
    fromChild: "ولدك",
    masked: "معلومات الاتصال تنحّات",
    readOnly:
      "قراية برك. ما تنجّمش تجاوب في بلاصة ولدك — الأستاذ لازمو يعرف مع شكون يتكلّم.",
    privacy: "معلومات الاتصال تتنحّى آليًا من الرسائل الكل.",
    with: "مع",
  },
});

export default function GuardianThreadPage() {
  const params = useParams<{ id: string }>();
  const threadId = String(params?.id ?? "");
  const { locale } = useLocale();
  const c = copy[locale];

  const [thread, setThread] = useState<MessageThreadDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getChildThread(threadId)
      .then(setThread)
      .catch(() => setThread(null))
      .finally(() => setLoading(false));
  }, [threadId]);

  if (loading) {
    return (
      <SiteShell>
        <section className="web-section">
          <div className="container container-narrow max-w-[760px]">
            <div className="panel panel-pad grid place-items-center min-h-[200px]">
              <Spinner />
              <span className="sr-only">{c.loading}</span>
            </div>
          </div>
        </section>
      </SiteShell>
    );
  }

  if (!thread) {
    return (
      <SiteShell>
        <section className="web-section">
          <div className="container container-narrow max-w-[760px]">
            <div className="panel panel-pad text-center">
              <p className="text-[14px] mb-3.5">{c.gone}</p>
              <Link href="/guardian" className="btn btn-ink btn-sm">{c.backCta}</Link>
            </div>
          </div>
        </section>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <section className="web-section">
        <div className="container container-narrow max-w-[760px]">
          <Link href="/guardian" className="text-[13px] text-muted inline-flex items-center gap-1.5 mb-3">
            <Forward className="w-3 h-3 rotate-180" aria-hidden="true" />
            {c.back}
          </Link>

          <div className="mb-[clamp(14px,2vw,22px)]">
            <h1 className="web-h1 text-[22px]">{thread.classTitle}</h1>
            <p className="text-[14px] text-muted mt-1">
              {c.with} {thread.withName}
            </p>
          </div>

          <div className="panel panel-pad mb-3 flex items-start gap-2.5">
            <Shield className="w-4 h-4 flex-none mt-0.5" aria-hidden="true" />
            <div className="text-[13px] text-muted leading-[1.6]">
              <p>{c.readOnly}</p>
              <p className="mt-1.5">{c.privacy}</p>
            </div>
          </div>

          <div className="panel panel-pad">
            {thread.messages.length === 0 ? (
              <p className="text-[13px] text-muted text-center py-6">{c.empty}</p>
            ) : (
              <ul className="flex flex-col gap-2.5" role="list">
                {thread.messages.map((m) => (
                  <li
                    key={m.id}
                    className="max-w-[85%] rounded-[14px] px-3.5 py-2.5"
                    style={{
                      /* The CHILD's messages sit on the trailing side, the tutor's
                         on the leading one — the same spatial grammar the child
                         sees, so a parent reading both views is not re-learning
                         who is who. */
                      marginInlineStart: m.fromChild ? "auto" : 0,
                      background: m.fromChild ? "var(--blue50)" : "var(--cream)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <div className="text-[12px] font-bold text-muted mb-1">
                      {m.fromChild ? c.fromChild : thread.withName}
                    </div>
                    {/* TEXT NODE. Never dangerouslySetInnerHTML. */}
                    <p className="text-[14px] leading-[1.6] whitespace-pre-wrap break-words">{m.body}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      <span className="text-[12px] text-muted">
                        {new Date(m.at).toLocaleString(locale === "ar" ? "ar-TN" : "fr-FR", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                      {m.masked && (
                        <span className="text-[12px] font-bold" style={{ color: "var(--ochre-ink)" }}>
                          {c.masked}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
