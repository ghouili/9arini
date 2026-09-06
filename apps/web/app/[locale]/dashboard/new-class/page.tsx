"use client";
import { useState, type FormEvent } from "react";
import { Link } from "@/components/Link";
import { Button, Field } from "@/components/ui";
import { useLocale } from "@/components/LocaleProvider";
import { Back, Video, Board, Quiz, Shield } from "@/components/icons";
import { createClass } from "@/app/actions";
import { useToast } from "@/components/useToast";
import { SiteShell } from "@/components/SiteShell";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { bilingual } from "@/lib/i18n";

/* A tutor must be verified before publishing (enforced server-side in createClass).
   Without a specific message this failure is opaque and unfixable-looking. */
const NOT_VERIFIED_MSG = {
  fr: "Ton profil doit d'abord être vérifié. Va dans « Vérification » pour envoyer tes documents.",
  ar: "لازم بروفايلك يتثبّت الأول. أمشي لـ « التثبّت » وابعث وثائقك.",
} as const;

/* Step 8. A class title and description are PUBLIC storefront copy, so contact
   details in them are refused rather than masked — the tutor is on the form and
   can fix it now. The message names the cause; a generic "ça n'a pas marché"
   would leave them re-submitting the same text. */
const CONTACT_INFO_MSG = {
  fr: "Enlève le numéro, l'email ou le lien : les coordonnées ne sont pas autorisées dans une séance. Tes élèves passent par Tnajem.",
  ar: "نحّي النمرة، الإيميل ولا الرابط: معلومات الاتصال موش مسموحة في الحصة. تلامذتك يعدّو عبر Tnajem.",
} as const;

/* Step 16. The plan limit refusal NAMES THE NUMBER, because the API sends it
   back. "Tu as atteint la limite de ton offre" with no figure is a dead end for
   the person who would happily move up an offer if they knew what they had hit —
   and the limit counts UPCOMING classes, which is not guessable from the word
   "limite". Nobody sees this during the pilot: every tutor is on `pilot`, which
   has no class limit. */
const PLAN_LIMIT_MSG = {
  fr: (n: number) =>
    `Ton offre te permet ${n === 1 ? "1 cours en ligne" : `${n} cours en ligne`} à la fois. Annule ou attends la fin d'un cours à venir, ou passe à une offre supérieure.`,
  ar: (n: number) =>
    `عرضك يسمحلك بـ ${n === 1 ? "درس واحد أونلاين" : `${n} دروس أونلاين`} في نفس الوقت. ألغي ولا استنّى درس جاي يكمّل، ولا اطلع لعرض أكبر.`,
} as const;

/* Page-local copy (lib/i18n.ts is shared/read-only). */
const copy = bilingual({
  fr: {
    lead: "Un titre, une date, ton prix. Ta classe apparaît sur ta page, et les élèves réservent en un clic.",
    priceHelp: "Tu fixes ton prix. Tu gardes 100 % — pendant le pilote l'élève te paie directement.",
    verifNote: "Ta classe se publie une fois ton compte vérifié.",
    verifCta: "Vérifier mon compte",
    descPh: "ex. Méthodes + annales. On fait 3 exercices types ensemble.",
  },
  ar: {
    lead: "عنوان، وقت، وثمنك. الحصة تبان في صفحتك، والتلامذة يحجزو بكليكة.",
    priceHelp: "إنتي تحدّد ثمنك. تحتفظ بـ 100 % — في فترة التجربة التلميذ يخلّصك مباشرة.",
    verifNote: "الحصة تتنشر كي يتثبّت حسابك.",
    verifCta: "ثبّت حسابي",
    descPh: "مثال: مناهج + امتحانات. نعملو 3 تمارين نموذجية مع بعضنا.",
  },
});

export default function NewClassPage() {
  const { t, locale } = useLocale();
  const c = copy[locale];

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [datetime, setDatetime] = useState("");
  const [duration, setDuration] = useState("90");
  const [price, setPrice] = useState("");
  const [seats, setSeats] = useState("20");
  const [videoUrl, setVideoUrl] = useState("");
  const [whiteboardUrl, setWhiteboardUrl] = useState("");
  const [quizUrl, setQuizUrl] = useState("");
  const [freeFirst, setFreeFirst] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // Only ever true when the server action itself reports demo mode (no DB).
  const [demo, setDemo] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    const res = await createClass({
      title, description: desc, scheduledAt: datetime,
      durationMin: Number(duration), priceTnd: Number(price), seats: Number(seats),
      isFreeFirst: freeFirst, meetUrl: videoUrl, whiteboardUrl, quizUrl,
    });
    if (res.ok) {
      setDemo(Boolean(res.demo));
      showToast(res.demo ? `${t.extra.classPublished} · ${t.common.demoMode}` : t.extra.classPublished);
    } else {
      // Server-side validation (past date, negative price, bad URL…) — let them fix it.
      setSubmitted(false);
      showToast(
        res.error === "not-verified" ? NOT_VERIFIED_MSG[locale]
          : res.error === "contact-info-not-allowed" ? CONTACT_INFO_MSG[locale]
          : res.error === "plan-limit-classes" && typeof res.limit === "number"
            ? PLAN_LIMIT_MSG[locale](res.limit)
          : t.extra.error,
      );
    }
  }
  const { toast, showToast } = useToast();

  return (
    <SiteShell>
      <section className="web-section tight">
        <div className="container">
          <div className="app-layout">
            {/* This page does not fetch getDashboard(), so the flag is not in scope.
                Hardcoded false is correct while payments are off; when PAYMENTS_ENABLED
                ships, thread the real flag here (grep: DashboardSidebar paymentsEnabled={false}). */}
            <DashboardSidebar paymentsEnabled={false} />

            {/* Main content column */}
            <div className="min-w-0">
              {/* Page header */}
              <div className="flex items-center gap-3 mb-[clamp(18px,3vw,28px)]">
                <Link href="/dashboard" className="iconbtn flex-none" aria-label={t.common.back}>
                  <Back />
                </Link>
                <h1 className="font-display text-[clamp(20px,2.6vw,28px)] tracking-[-0.6px] text-ink min-w-0">
                  {t.createClass.title}
                </h1>
              </div>

              {/* Form card — max-width centers comfortably at 1280px */}
              <div className="panel panel-pad max-w-[620px] w-full">
                <p className="text-[13.5px] text-ink2 leading-[1.6] mb-4">
                  {c.lead}
                </p>
                <form onSubmit={handleSubmit}>

                  {/* Title */}
                  <Field label={t.createClass.name}>
                    <div className="inp">
                      <input
                        type="text"
                        placeholder={t.createClass.namePh}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        maxLength={80}
                      />
                    </div>
                  </Field>

                  {/* Description */}
                  <Field label={t.createClass.desc}>
                    <div className="inp items-start">
                      <textarea
                        rows={3}
                        placeholder={c.descPh}
                        value={desc}
                        onChange={(e) => setDesc(e.target.value)}
                        style={{ resize: "vertical", minHeight: 80 }}
                      />
                    </div>
                  </Field>

                  {/* Date & time */}
                  <Field label={t.createClass.date}>
                    <div className="inp">
                      <input
                        type="datetime-local"
                        value={datetime}
                        onChange={(e) => setDatetime(e.target.value)}
                        required
                        style={{ colorScheme: "light" }}
                      />
                    </div>
                  </Field>

                  {/* Duration + Price — stack on mobile, side-by-side ≥480px */}
                  <div className="flex flex-wrap gap-2.5">
                    <div className="flex-[1_1_140px] min-w-0">
                      <Field label={t.createClass.duration}>
                        <div className="inp">
                          <input
                            type="number"
                            min={15}
                            max={240}
                            step={15}
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            required
                          />
                          <span className="pre">{t.common.min}</span>
                        </div>
                      </Field>
                    </div>
                    <div className="flex-[1_1_140px] min-w-0">
                      <Field label={t.createClass.price} help={c.priceHelp}>
                        <div className="inp">
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            placeholder="15"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            required
                          />
                          <span className="pre">{t.common.tnd}</span>
                        </div>
                      </Field>
                    </div>
                  </div>

                  {/* Seats */}
                  <Field label={t.createClass.seats}>
                    <div className="inp">
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={seats}
                        onChange={(e) => setSeats(e.target.value)}
                        required
                      />
                    </div>
                  </Field>

                  {/* Teaching tools section */}
                  <div style={{
                    borderTop: "1px solid var(--line)",
                    marginTop: 6,
                    marginBottom: 18,
                    paddingTop: 18,
                  }}>
                    <div className="flex items-center gap-2 mb-3.5 text-ink2 font-bold text-[13px] uppercase tracking-[0.5px]">
                      <Video className="w-4 h-4 text-blue" />
                      {t.tools.setLinks}
                    </div>

                    <Field label={t.tools.videoUrl}>
                      <div className="inp">
                        <Video className="w-4 h-4 text-muted shrink-0" />
                        <input
                          type="url"
                          inputMode="url"
                          placeholder="https://meet.jit.si/…"
                          value={videoUrl}
                          onChange={(e) => setVideoUrl(e.target.value)}
                        />
                      </div>
                    </Field>

                    <Field label={t.tools.whiteboardUrl}>
                      <div className="inp">
                        <Board className="w-4 h-4 text-muted shrink-0" />
                        <input
                          type="url"
                          inputMode="url"
                          placeholder="https://bitpaper.io/…"
                          value={whiteboardUrl}
                          onChange={(e) => setWhiteboardUrl(e.target.value)}
                        />
                      </div>
                    </Field>

                    <Field label={t.tools.quizUrl} help={t.tools.hint}>
                      <div className="inp">
                        <Quiz className="w-4 h-4 text-muted shrink-0" />
                        <input
                          type="url"
                          inputMode="url"
                          placeholder="https://wooclap.com/…"
                          value={quizUrl}
                          onChange={(e) => setQuizUrl(e.target.value)}
                        />
                      </div>
                    </Field>
                  </div>

                  {/* Free-first checkbox */}
                  <div
                    className="card"
                    role="checkbox"
                    aria-checked={freeFirst}
                    aria-label={t.createClass.freeFirst}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        setFreeFirst((v) => !v);
                      }
                    }}
                    onClick={() => setFreeFirst((v) => !v)}
                    style={{
                      padding: "14px 16px",
                      marginBottom: 20,
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      cursor: "pointer",
                      border: freeFirst ? "2px solid var(--green)" : "1px solid var(--line)",
                      background: freeFirst ? "var(--green50)" : "var(--paper)",
                      transition: ".15s",
                    }}
                  >
                    {/* Custom checkbox tick */}
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        minWidth: 22,
                        borderRadius: 7,
                        border: freeFirst ? "none" : "2px solid var(--line)",
                        background: freeFirst ? "var(--green)" : "transparent",
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                        transition: ".15s",
                      }}
                    >
                      {freeFirst && (
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="5 13 10 18 19 7" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold">{t.createClass.freeFirst}</div>
                      <div className="text-[13px] text-muted mt-0.5">
                        {t.common.free1st}
                      </div>
                    </div>
                  </div>

                  {/* Submit */}
                  <Button type="submit" variant="primary" disabled={submitted}>
                    {t.createClass.create}
                  </Button>

                  {/* Publishing needs a verified profile (server-side rule) — say it
                      BEFORE they submit instead of only failing afterwards. */}
                  <p className="flex items-center justify-center gap-1.5 flex-wrap text-[13px] text-muted mt-3 leading-[1.5]">
                    <Shield className="w-3.5 h-3.5 flex-none" />
                    {c.verifNote}
                    <Link href="/onboarding/verify" className="linklike text-[13px]">
                      {c.verifCta}
                    </Link>
                  </p>

                  {/* Shown ONLY when the server action reports demo mode (no DB connected). */}
                  {demo && (
                    <p className="text-center text-[13px] text-muted mt-3 leading-[1.5]">
                      {t.common.demoMode}
                    </p>
                  )}
                </form>
              </div>
            </div>
            {/* end main column */}
          </div>
        </div>
      </section>
      {toast}
    </SiteShell>
  );
}
