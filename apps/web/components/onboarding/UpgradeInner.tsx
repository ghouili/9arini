"use client";
/* /onboarding/upgrade — the deliberate student → tutor conversion.

   THIS SCREEN IS THE FIX. Becoming a tutor used to be an invisible side effect:
   createTutor() wrote `role = 'tutor'` for whoever was signed in, so any student
   who reached /onboarding — a link the header offered them directly — came out the
   other side as a tutor without ever being asked. Nothing told them their account
   had changed, and nothing checked they were old enough to teach children.

   So the conversion now has a page of its own, and that page says what changes
   before it changes. becomeTutor() is the only writer of the role in the codebase,
   it refuses without `confirm`, and it refuses a minor. */
import { useState } from "react";
import { useLocalizedRouter, Link } from "@/components/Link";
import { Button, Field } from "@/components/ui";
import { useLocale } from "@/components/LocaleProvider";
import { Check, Shield, Calendar } from "@/components/icons";
import { becomeTutor } from "@/app/actions";
import { SiteShell } from "@/components/SiteShell";

const COPY = {
  fr: {
    title: "Passer en compte prof",
    lead: "Ton compte élève devient un compte prof. C'est le même numéro et la même connexion — mais l'espace change.",

    changesTitle: "Ce qui change",
    changes: [
      "Tu obtiens une page publique, des classes et un tableau de bord",
      "« Mes cours » laisse la place au tableau de bord prof",
      "Tu devras envoyer ta pièce d'identité pour être vérifié",
    ],
    keepsTitle: "Ce que tu gardes",
    keeps: [
      "Ton numéro, ta connexion et ton historique",
      "Tes séances déjà réservées restent réservées",
    ],

    byLabel: "Ton année de naissance",
    byPh: "Choisir…",
    byNote: "On la demande parce qu'un prof enseigne à des mineurs : il faut être majeur. Elle n'est jamais publique.",

    cta: "Oui, passer en compte prof",
    working: "Un instant…",
    back: "Non, rester élève",

    errMinor: "Il faut avoir 18 ans ou plus pour enseigner sur Tnajem. Tu peux continuer à réserver des cours comme élève.",
    errAge: "Choisis ton année de naissance pour continuer.",
    errRate: "Trop de tentatives. Réessaie dans une heure.",
    errAuth: "Ta session a expiré. Reconnecte-toi.",
    errGeneric: "Ça n'a pas marché. Réessaie.",
  },
  ar: {
    title: "ولّي حساب أستاذ",
    lead: "حسابك متاع تلميذ يولّي حساب أستاذ. نفس النمرة ونفس الدخول — أما الفضاء يتبدّل.",

    changesTitle: "شنوّة يتبدّل",
    changes: [
      "تاخذ صفحة عمومية، وحصص، ولوحة تحكّم",
      "«حصصي» تتبدّل بلوحة الأستاذ",
      "لازمك تبعث بطاقة تعريفك باش تتثبّت",
    ],
    keepsTitle: "شنوّة يبقى كيما هو",
    keeps: [
      "نمرتك، دخولك، وتاريخك",
      "الحصص اللي حجزتهم يبقاو محجوزين",
    ],

    byLabel: "سنة ولادتك",
    byPh: "اختر…",
    byNote: "نسألو عليها خاطر الأستاذ يقرّي قاصرين : لازمك تكون راشد. ما تظهر لحتّى حد.",

    cta: "إيه، نولّي أستاذ",
    working: "لحظة…",
    back: "لا، نبقى تلميذ",

    errMinor: "لازمك 18 سنة ولا أكثر باش تقرّي في تنجّم. تنجم تكمّل تحجز حصص كتلميذ.",
    errAge: "اختار سنة ولادتك باش تكمّل.",
    errRate: "محاولات برشة. عاود بعد ساعة.",
    errAuth: "الجلسة متاعك سالات. عاود ادخل.",
    errGeneric: "ما مشاتش. عاود حاول.",
  },
} as const;

export function UpgradeInner({ needsBirthYear }: { needsBirthYear: boolean }) {
  const { locale } = useLocale();
  const c = COPY[locale];
  const router = useLocalizedRouter();

  const [birthYear, setBirthYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only offered when we have no age on file. A student who already told us their
  // birth year cannot restate it here — the server prefers the stored value, so a
  // minor could not claim to be older to get the role.
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 83 }, (_, i) => currentYear - 18 - i);

  async function handleConfirm() {
    if (busy) return;
    if (needsBirthYear && !birthYear) { setError(c.errAge); return; }
    setBusy(true);
    setError(null);
    let res: Awaited<ReturnType<typeof becomeTutor>>;
    try {
      res = await becomeTutor({ confirm: true, birthYear: birthYear ? Number(birthYear) : undefined });
    } catch {
      setBusy(false);
      setError(c.errGeneric);
      return;
    }
    setBusy(false);
    if (res.ok) {
      /* Hard navigation, not router.push: becomeTutor rewrote the role-hint cookie
         and <SiteHeader> reads it once, post-hydration. A client-side push would
         leave the header showing student navigation on the tutor's first screen. */
      window.location.href = `/${locale}/onboarding`;
      return;
    }
    if (res.error === "minor-cannot-teach") setError(c.errMinor);
    else if (res.error === "age-required") setError(c.errAge);
    else if (res.error === "too-many-requests") setError(c.errRate);
    else if (res.error === "not-authenticated") setError(c.errAuth);
    else setError(c.errGeneric);
  }

  const list = (title: string, items: readonly string[], tone: "blue" | "green") => (
    <div className="mb-5">
      <div className="text-[13px] font-bold uppercase tracking-[0.4px] text-muted mb-2">{title}</div>
      <ul className="list-none flex flex-col gap-2">
        {items.map((x) => (
          <li key={x} className="flex items-start gap-[9px] text-[13.5px] text-ink2 leading-[1.5]">
            <Check className={`w-4 h-4 flex-none mt-0.5 ${tone === "blue" ? "text-blue" : "text-green-ink"}`} />
            <span className="min-w-0">{x}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <SiteShell>
      <section className="web-section">
        <div className="container container-narrow flex justify-center">
          <div className="panel panel-pad rise w-full max-w-[520px] min-w-0">
            <div className="flex items-start gap-3 mb-4">
              <span className="text-blue inline-flex flex-none mt-0.5" aria-hidden="true">
                <Shield />
              </span>
              <div className="min-w-0">
                <h1 className="font-display text-[clamp(20px,_3.6vw,_26px)] tracking-[-0.5px] text-ink mb-1.5">
                  {c.title}
                </h1>
                <p className="text-[13.5px] text-muted leading-[1.55]">{c.lead}</p>
              </div>
            </div>

            {list(c.changesTitle, c.changes, "blue")}
            {list(c.keepsTitle, c.keeps, "green")}

            {needsBirthYear && (
              <Field label={c.byLabel}>
                <div className="inp" style={birthYear ? { borderColor: "var(--blue)" } : undefined}>
                  <Calendar className="" />
                  <select
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    required
                    aria-required="true"
                    aria-label={c.byLabel}
                    className="min-w-0 w-full border-0 bg-transparent font-[inherit]"
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

            {error && (
              <p role="alert" className="text-rose text-[13px] font-semibold leading-[1.5] mb-3 text-start">
                {error}
              </p>
            )}

            {/* Live, not disabled: handleConfirm() explains what is missing. */}
            <Button variant="primary" onClick={handleConfirm} disabled={busy}>
              {busy ? c.working : c.cta}
            </Button>

            <div className="text-center mt-3.5">
              <Link
                href="/student"
                className="linklike text-[13px] inline-flex items-center justify-center min-h-[44px] min-w-[44px]"
              >
                {c.back}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
