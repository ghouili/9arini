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

/* Page-local copy (never edit lib/i18n.ts from here). FR + Derija, RTL-safe. */
const copy = {
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
} as const;

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
            <DashboardSidebar />

            {/* Main content column */}
            <div style={{ minWidth: 0 }}>
              {/* Page header */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: "clamp(18px,3vw,28px)",
              }}>
                <Link href="/dashboard" className="iconbtn" aria-label={t.common.back} style={{ flex: "none" }}>
                  <Back />
                </Link>
                <h1 style={{
                  fontFamily: "var(--fd)",
                  fontSize: "clamp(20px,2.6vw,28px)",
                  letterSpacing: "-0.6px",
                  color: "var(--ink)",
                  minWidth: 0,
                }}>
                  {t.createPack.title}
                </h1>
              </div>

              {/* Form card */}
              <div className="panel panel-pad" style={{ maxWidth: 620, width: "100%" }}>

                {/* Illustration / hint card */}
                <div style={{
                  display: "flex",
                  gap: 13,
                  alignItems: "center",
                  padding: "14px 16px",
                  marginBottom: 22,
                  background: "var(--blue50)",
                  borderRadius: "var(--r)",
                }}>
                  <div aria-hidden="true" style={{
                    width: 46,
                    height: 46,
                    minWidth: 46,
                    borderRadius: 13,
                    background: "var(--blue)",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    flex: "none",
                  }}>
                    <Box style={{ width: 24, height: 24 }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--blue)" }}>
                      {c.hintTitle}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--blue700)", marginTop: 3, lineHeight: 1.5 }}>
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
                    <span style={{ color: "var(--ochre)", display: "inline-flex", flexShrink: 0, marginTop: 1 }}>
                      <Bulb style={{ width: 18, height: 18 }} />
                    </span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>
                        {c.deliveryTitle}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
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
                  <p style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    flexWrap: "wrap", fontSize: 13, color: "var(--muted)", marginTop: 12, lineHeight: 1.5,
                  }}>
                    <Shield style={{ width: 14, height: 14, flex: "none" }} />
                    {c.verifNote}
                    <Link href="/onboarding/verify" className="linklike" style={{ fontSize: 13 }}>
                      {c.verifCta}
                    </Link>
                  </p>

                  {/* Shown ONLY when the server action reports demo mode (no DB connected). */}
                  {demo && (
                    <p style={{
                      textAlign: "center",
                      fontSize: 13,
                      color: "var(--muted)",
                      marginTop: 12,
                      lineHeight: 1.5,
                    }}>
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
