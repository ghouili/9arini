"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, Field } from "@/components/ui";
import { useLocale } from "@/components/LocaleProvider";
import { Back, Box, Upload } from "@/components/icons";
import { useToast } from "@/components/useToast";
import { SiteShell } from "@/components/SiteShell";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { createPack } from "@/app/actions";

export default function NewPackPage() {
  const { t } = useLocale();

  const [title, setTitle] = useState("");
  const [meta, setMeta] = useState("");
  const [price, setPrice] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { toast, showToast } = useToast();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    const res = await createPack({ title, meta, priceTnd: Number(price) || 0 });
    if (res.ok) {
      showToast(res.demo ? `${t.extra.packPublished} · ${t.common.demoMode}` : t.extra.packPublished);
    } else {
      showToast(t.extra.error);
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
                <Link href="/dashboard">
                  <button className="iconbtn" aria-label={t.common.back}>
                    <Back />
                  </button>
                </Link>
                <h1 style={{
                  fontFamily: "var(--fd)",
                  fontSize: "clamp(20px,2.6vw,28px)",
                  letterSpacing: "-0.6px",
                  color: "var(--ink)",
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
                  <div style={{
                    width: 46,
                    height: 46,
                    minWidth: 46,
                    borderRadius: 13,
                    background: "var(--blue)",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}>
                    <Box style={{ width: 24, height: 24 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--blue)" }}>
                      Fiches, PDFs, vidéos
                    </div>
                    <div style={{ fontSize: 12, color: "var(--blue700)", marginTop: 3, lineHeight: 1.5 }}>
                      Vends tes supports une fois, encaisse pour chaque vente.
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmit}>
                  {/* Title */}
                  <Field label={t.createPack.name}>
                    <div className="inp">
                      <input
                        type="text"
                        placeholder="ex. Pack révision : Dérivées & Limites"
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
                    help="ex. 42 pages · 6 vidéos · 3 exercices corrigés"
                  >
                    <div className="inp">
                      <input
                        type="text"
                        placeholder="42 pages · 6 vidéos"
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

                  {/* Upload placeholder */}
                  <div style={{
                    border: "2px dashed var(--line)",
                    borderRadius: 14,
                    padding: "22px 16px",
                    textAlign: "center",
                    marginBottom: 20,
                    color: "var(--muted)",
                  }}>
                    <div style={{
                      marginBottom: 6,
                      display: "flex",
                      justifyContent: "center",
                      color: "var(--muted)",
                    }}>
                      <Upload style={{ width: 26, height: 26 }} />
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>
                      Ajouter des fichiers
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                      PDF, MP4, ZIP — jusqu'à 500 Mo
                      <br />
                      <span style={{ color: "var(--blue)", fontWeight: 700 }}>
                        {/* TODO file upload — Supabase Storage */}
                        (bientôt disponible)
                      </span>
                    </div>
                  </div>

                  {/* Submit */}
                  <Button type="submit" variant="primary" disabled={submitted}>
                    {t.createPack.create}
                  </Button>

                  <p style={{
                    textAlign: "center",
                    fontSize: 11.5,
                    color: "var(--muted)",
                    marginTop: 12,
                    lineHeight: 1.5,
                  }}>
                    {t.common.demoMode}
                  </p>
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
