"use client";
import { useState, type FormEvent } from "react";
import { Link } from "@/components/Link";
import { Button, Field } from "@/components/ui";
import { useLocale } from "@/components/LocaleProvider";
import { Back, Box, Bulb, Shield } from "@/components/icons";
import { useToast } from "@/components/useToast";
import { SiteShell } from "@/components/SiteShell";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { createPack } from "@/app/actions";
import { bilingual } from "@/lib/i18n";

/* Page-local copy (never edit lib/i18n.ts from here). FR + Derija, RTL-safe. */
const copy = bilingual({
  fr: {
    hintTitle: "Fiches, PDFs, vidéos",
    hintBody: "Décris ton pack, fixe ton prix. Tes élèves le voient sur ta vitrine.",
    deliveryTitle: "La livraison des fichiers arrive bientôt",
    deliveryBody:
      "Pour l'instant, l'upload n'est pas encore branché : publie la description et le prix, et envoie le fichier à tes élèves toi-même (WhatsApp, mail). On te préviendra dès que la livraison automatique est prête.",
    metaHelp: "ex. 42 pages · 6 vidéos · 3 exercices corrigés",
    // Publishing requires a verified profile (enforced server-side in createPack).
    notVerified: "Ton profil doit d'abord être vérifié. Va dans « Vérification » pour envoyer tes documents.",
    titlePh: "ex. Pack révision : Dérivées & Limites",
    metaPh: "42 pages · 6 vidéos",
    verifNote: "Ton pack se publie une fois ton compte vérifié.",
    verifCta: "Vérifier mon compte",
  },
  ar: {
    hintTitle: "فيشات، PDF، فيديوهات",
    hintBody: "وصّف الپاك متاعك، وحطّ السوم. تلاميذك يشوفوه في واجهتك.",
    deliveryTitle: "توصيل الملفّات يوصل قريب",
    deliveryBody:
      "توّا الرفع ما زال ما تربطش: انشر الوصف والسوم، وابعث الملف لتلاميذك بيدك (واتساب، إيميل). نعيّطولك أوّل ما التوصيل الأوتوماتيكي يكون جاهز.",
    metaHelp: "مثال: 42 صفحة · 6 فيديوهات · 3 تمارين مصحّحة",
    notVerified: "لازم بروفايلك يتثبّت الأول. أمشي لـ « التثبّت » وابعث وثائقك.",
    titlePh: "مثال: پاك مراجعة : المشتقات والنهايات",
    metaPh: "42 صفحة · 6 فيديوهات",
    verifNote: "الپاك يتنشر كي يتثبّت حسابك.",
    verifCta: "ثبّت حسابي",
  },
});

export default function NewPackPage() {
  const { t, locale } = useLocale();
  const c = copy[locale];

  const [title, setTitle] = useState("");
  const [meta, setMeta] = useState("");
  const [price, setPrice] = useState("");
  const [submitted, setSubmitted] = useState(false);
  // Only ever true when the server action itself reports demo mode (no DB).
  const [demo, setDemo] = useState(false);

  const { toast, showToast } = useToast();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    const res = await createPack({ title, meta, priceTnd: Number(price) || 0 });
    if (res.ok) {
      setDemo(Boolean(res.demo));
      showToast(res.demo ? `${t.extra.packPublished} · ${t.common.demoMode}` : t.extra.packPublished);
    } else {
      // Server-side validation (empty title, negative price…) — let them fix it.
      showToast(res.error === "not-verified" ? c.notVerified : t.extra.error);
      setSubmitted(false);
    }
  }

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
                  {t.createPack.title}
                </h1>
              </div>

              {/* Form card */}
              <div className="panel panel-pad max-w-[620px] w-full">

                {/* Illustration / hint card */}
                <div className="flex gap-[13px] items-center py-3.5 px-4 mb-[22px] bg-blue50 rounded-brand">
                  <div aria-hidden="true" className="w-[46px] h-[46px] min-w-[46px] rounded-[13px] bg-blue text-white grid place-items-center flex-none">
                    <Box className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-bold text-blue">
                      {c.hintTitle}
                    </div>
                    <div className="text-[13px] text-blue700 mt-[3px] leading-[1.5]">
                      {c.hintBody}
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmit}>
                  {/* Title */}
                  <Field label={t.createPack.name}>
                    <div className="inp">
                      <input
                        type="text"
                        placeholder={c.titlePh}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        maxLength={80}
                      />
                    </div>
                  </Field>

                  {/* Meta */}
                  <Field
                    label={t.createPack.meta}
                    help={c.metaHelp}
                  >
                    <div className="inp">
                      <input
                        type="text"
                        placeholder={c.metaPh}
                        value={meta}
                        onChange={(e) => setMeta(e.target.value)}
                        maxLength={80}
                      />
                    </div>
                  </Field>

                  {/* Price */}
                  <Field label={t.createPack.price}>
                    <div className="inp">
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        placeholder="8"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        required
                      />
                      <span className="pre">{t.common.tnd}</span>
                    </div>
                  </Field>

                  {/* Honest note — no fake dropzone. File delivery isn't built yet, so we
                      don't ship a control that pretends to upload. */}
                  <div style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    padding: "14px 16px",
                    borderRadius: 14,
                    background: "var(--cream)",
                    border: "1px solid var(--line)",
                    marginBottom: 20,
                  }}>
                    <span className="text-ochre inline-flex shrink-0 mt-[1px]">
                      <Bulb className="w-[18px] h-[18px]" />
                    </span>
                    <div>
                      <div className="text-[13px] font-bold mb-[3px]">
                        {c.deliveryTitle}
                      </div>
                      <div className="text-[13px] text-muted leading-[1.6]">
                        {c.deliveryBody}
                      </div>
                    </div>
                  </div>

                  {/* Submit */}
                  <Button type="submit" variant="primary" disabled={submitted}>
                    {t.createPack.create}
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
