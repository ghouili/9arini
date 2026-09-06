"use client";
import { useEffect, useState } from "react";
import { Link } from "@/components/Link";
import { Button, Avatar, Spinner } from "@/components/ui";
import { useLocale } from "@/components/LocaleProvider";
import { useToast } from "@/components/useToast";
import { SiteShell } from "@/components/SiteShell";
import { Shield, Check, Eye, Users, Forward } from "@/components/icons";
import { getPendingVerifications, approveTutor, rejectTutor } from "@/app/actions";
import type { PendingTutor } from "@tnajem/shared";
import { bilingual } from "@/lib/i18n";

/* Self-contained bilingual copy (FR + Tunisian Derija). Does NOT touch lib/i18n.ts. */
const copy = bilingual({
  fr: {
    eyebrow: "ADMIN",
    title: "Vérifications en attente",
    count: (n: number) => (n === 1 ? "1 demande" : `${n} demandes`),
    loading: "Chargement des demandes…",
    deniedTitle: "Accès réservé",
    deniedNote:
      "Cette page est réservée aux administrateurs. Si tu penses que c'est une erreur, contacte l'équipe.",
    signIn: "Se connecter",
    empty: "Aucune demande en attente ✓",
    emptyNote: "Toutes les candidatures ont été traitées.",
    submitted: "Soumis le",
    noDate: "Date inconnue",
    experience: "Expérience",
    years: (n: number) => `${n} ${n === 1 ? "an" : "ans"}`,
    institution: "Établissement",
    languages: "Langues",
    pitch: "Présentation",
    notProvided: "Non renseigné",
    documents: "Documents",
    idRequired: "« Identité » est obligatoire.",
    links: "Liens",
    openDoc: "Ouvrir",
    approve: "Approuver",
    reject: "Refuser",
    notePlaceholder: "Motif du refus (optionnel)",
    approved: "Tuteur approuvé ✓",
    rejected: "Demande refusée",
    error: "Une erreur s'est produite. Réessaie.",
  },
  ar: {
    eyebrow: "أدمين",
    title: "الطلبات اللي تستنّى",
    count: (n: number) => (n === 1 ? "طلب واحد" : `${n} طلبات`),
    loading: "قاعدين نحمّلو الطلبات…",
    deniedTitle: "الدخول محجوز",
    deniedNote:
      "الصفحة هاذي محجوزة للأدمين برك. كان تحسب فمّا غلطة، اتصل بالفريق.",
    signIn: "ادخل",
    empty: "ما فمّاش طلبات تستنّى ✓",
    emptyNote: "الطلبات الكل تعالجو.",
    submitted: "تبعث في",
    noDate: "التاريخ موش معروف",
    experience: "الخبرة",
    years: (n: number) => `${n} ${n === 1 ? "عام" : "أعوام"}`,
    institution: "المؤسسة",
    languages: "اللغات",
    pitch: "التقديم",
    notProvided: "موش متعمّر",
    documents: "الوثائق",
    idRequired: "« الهوية » إجبارية.",
    links: "الروابط",
    openDoc: "حلّ",
    approve: "اقبل",
    reject: "ارفض",
    notePlaceholder: "سبب الرفض (اختياري)",
    approved: "المعلّم تقبل ✓",
    rejected: "الطلب تنرفض",
    error: "صار مشكل. عاود.",
  },
});

/* Friendly bilingual names for each document kind. */
const docNames: Record<string, { fr: string; ar: string }> = {
  id_front: { fr: "Identité (recto)", ar: "الهوية (وجه)" },
  id_back: { fr: "Identité (verso)", ar: "الهوية (ظهر)" },
  selfie: { fr: "Selfie + pièce", ar: "صورة + بطاقة" },
  diploma: { fr: "Diplôme", ar: "الشهادة" },
  certificate: { fr: "Certificat", ar: "شهادة" },
  role_proof: { fr: "Justificatif de rôle", ar: "إثبات الدور" },
};

const linkLabels: Record<string, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
  website: "Site web",
  introVideo: "Vidéo",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(iso: string | null, locale: "fr" | "ar"): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-TN" : "fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export default function AdminVerificationsPage() {
  const { locale } = useLocale();
  const c = copy[locale];
  const { toast, showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState(false);
  const [items, setItems] = useState<PendingTutor[]>([]);
  /* tutorId currently being processed → "approve" | "reject" (disables that card's buttons) */
  const [busy, setBusy] = useState<Record<string, "approve" | "reject">>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getPendingVerifications();
        if (!alive) return;
        setAdmin(res.ok && res.admin);
        setItems(res.items ?? []);
      } catch {
        if (alive) setAdmin(false);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function handleApprove(tutorId: string) {
    setBusy((b) => ({ ...b, [tutorId]: "approve" }));
    const res = await approveTutor({ tutorId });
    if (res.ok) {
      setItems((list) => list.filter((t) => t.tutorId !== tutorId));
      showToast(c.approved);
    } else {
      showToast(c.error);
      setBusy((b) => {
        const next = { ...b };
        delete next[tutorId];
        return next;
      });
    }
  }

  async function handleReject(tutorId: string) {
    setBusy((b) => ({ ...b, [tutorId]: "reject" }));
    const res = await rejectTutor({ tutorId, note: notes[tutorId]?.trim() || undefined });
    if (res.ok) {
      setItems((list) => list.filter((t) => t.tutorId !== tutorId));
      showToast(c.rejected);
    } else {
      showToast(c.error);
      setBusy((b) => {
        const next = { ...b };
        delete next[tutorId];
        return next;
      });
    }
  }

  return (
    <SiteShell>
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      <section className="web-section tight">
        <div className="container container-narrow">
          {/* Header */}
          <div className="av-head">
            <span className="web-eyebrow av-eyebrow">
              <Shield className="w-4 h-4" />
              {c.eyebrow}
            </span>
            <h1 className="web-h2">{c.title}</h1>
            {!loading && admin && (
              <div className="av-count">
                <Users className="w-[15px] h-[15px]" />
                {c.count(items.length)}
              </div>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <div className="panel panel-pad av-center">
              <Spinner />
              <p className="muted mt-1">{c.loading}</p>
            </div>
          )}

          {/* Access denied (not admin / signed out / demo) */}
          {!loading && !admin && (
            <div className="panel panel-pad av-center rise">
              <div className="av-deny-icon">
                <Shield className="w-[30px] h-[30px]" />
              </div>
              <h2 className="font-display text-[22px] tracking-[-0.5px]">
                {c.deniedTitle}
              </h2>
              <p className="muted max-w-[420px] leading-[1.6]">
                {c.deniedNote}
              </p>
              <Link href="/auth" className="w-auto">
                <Button variant="ink" sm>{c.signIn}</Button>
              </Link>
            </div>
          )}

          {/* Empty state */}
          {!loading && admin && items.length === 0 && (
            <div className="panel panel-pad av-center rise">
              <div className="av-empty-icon">
                <Check className="w-[30px] h-[30px]" />
              </div>
              <h2 className="font-display text-[20px] tracking-[-0.5px]">
                {c.empty}
              </h2>
              <p className="muted">{c.emptyNote}</p>
            </div>
          )}

          {/* Application list */}
          {!loading && admin && items.length > 0 && (
            <div className="av-list">
              {items.map((t) => {
                const state = busy[t.tutorId];
                const disabled = !!state;
                const dateStr = formatDate(t.submittedAt, locale);
                const presentKinds = new Set(t.docs.map((d) => d.kind));
                const hasId = presentKinds.has("id_front") || presentKinds.has("id_back");
                const activeLinks = Object.entries(t.links).filter(
                  ([, v]) => typeof v === "string" && v.trim().length > 0
                ) as [string, string][];

                return (
                  <article key={t.tutorId} className="panel panel-pad av-card rise">
                    {/* Card header */}
                    <header className="av-card-head">
                      <Avatar initials={initials(t.name)} size={56} square />
                      <div className="min-w-0">
                        {/* h2, not h3. The two h2s above belong to the EMPTY and
                            DENIED states, which never render at the same time as
                            this list — so in the DOM a screen reader actually
                            walks, this jumped h1 -> h3 and every applicant name
                            was announced at a level with no parent. */}
                        <h2 className="av-name">{t.name}</h2>
                        <div className="av-sub">
                          <span className="chip chip-soft">{t.subject}</span>
                          <span className="av-slug">tnajem.tn/{t.slug}</span>
                        </div>
                      </div>
                      <div className="av-date">
                        {c.submitted}{" "}
                        <b>{dateStr ?? c.noDate}</b>
                      </div>
                    </header>

                    {/* Details grid */}
                    <div className="av-grid">
                      <div className="av-field">
                        <span className="av-label">{c.experience}</span>
                        <span className="av-value">
                          {t.experienceYears != null ? c.years(t.experienceYears) : c.notProvided}
                        </span>
                      </div>
                      <div className="av-field">
                        <span className="av-label">{c.institution}</span>
                        <span className="av-value">{t.institution || c.notProvided}</span>
                      </div>
                      <div className="av-field">
                        <span className="av-label">{c.languages}</span>
                        <span className="av-value">{t.languages || c.notProvided}</span>
                      </div>
                    </div>

                    {/* Pitch */}
                    {t.pitch && (
                      <blockquote className="av-pitch">
                        <span className="av-label">{c.pitch}</span>
                        <p>{t.pitch}</p>
                      </blockquote>
                    )}

                    {/* Documents */}
                    <div className="av-block">
                      <div className="av-block-head">
                        <span className="av-label">{c.documents}</span>
                        {!hasId && <span className="chip chip-rose">{c.idRequired}</span>}
                      </div>
                      {t.docs.length > 0 ? (
                        <div className="av-docs">
                          {t.docs.map((d) => {
                            const nm = docNames[d.kind];
                            const label = nm ? nm[locale] : d.kind;
                            const required = d.kind === "id_front" || d.kind === "id_back";
                            return (
                              <a
                                key={d.id}
                                href={`/api/admin/doc/${d.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={d.fileName}
                                className={`av-doc${required ? " av-doc-req" : ""}`}
                              >
                                <Eye className="w-[15px] h-[15px]" />
                                {label}
                                <Forward className="w-[13px] h-[13px] opacity-[0.6]" />
                              </a>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="muted text-[13px]">{c.notProvided}</p>
                      )}
                    </div>

                    {/* Links */}
                    {activeLinks.length > 0 && (
                      <div className="av-block">
                        <span className="av-label">{c.links}</span>
                        <div className="av-links">
                          {activeLinks.map(([key, url]) => (
                            <a
                              key={key}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="av-link"
                            >
                              {linkLabels[key] ?? key}
                              <Forward className="w-3 h-3 opacity-[0.6]" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="av-actions">
                      <div className="av-approve">
                        <Button
                          variant="green"
                          onClick={() => handleApprove(t.tutorId)}
                          disabled={disabled}
                        >
                          {state === "approve" ? (
                            <span className="av-btn-spin" aria-hidden="true" />
                          ) : (
                            <Check className="w-[18px] h-[18px]" />
                          )}
                          {c.approve}
                        </Button>
                      </div>
                      <div className="av-reject">
                        <label className="inp av-note">
                          <input
                            type="text"
                            value={notes[t.tutorId] ?? ""}
                            onChange={(e) =>
                              setNotes((n) => ({ ...n, [t.tutorId]: e.target.value }))
                            }
                            placeholder={c.notePlaceholder}
                            aria-label={c.notePlaceholder}
                            disabled={disabled}
                          />
                        </label>
                        <Button
                          variant="ghost"
                          onClick={() => handleReject(t.tutorId)}
                          disabled={disabled}
                        >
                          {state === "reject" ? (
                            <span className="av-btn-spin dark" aria-hidden="true" />
                          ) : null}
                          {c.reject}
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
      {toast}
    </SiteShell>
  );
}

const PAGE_CSS = `
.av-head{margin-bottom:clamp(20px,3vw,30px)}
.av-eyebrow{display:inline-flex;align-items:center;gap:6px;margin-bottom:8px}
.av-count{display:inline-flex;align-items:center;gap:6px;margin-top:10px;font-size:13.5px;font-weight:700;color:var(--ink2);background:var(--blue50);color:var(--blue);padding:5px 12px;border-radius:999px}
.av-center{display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;padding-block:clamp(28px,5vw,44px)}
.av-deny-icon{width:64px;height:64px;border-radius:18px;display:grid;place-items:center;background:var(--blue50);color:var(--blue)}
.av-empty-icon{width:64px;height:64px;border-radius:18px;display:grid;place-items:center;background:var(--green50);color:var(--green)}
.av-list{display:flex;flex-direction:column;gap:clamp(16px,2.4vw,22px)}
.av-card{display:flex;flex-direction:column;gap:16px}
.av-card-head{display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap}
.av-name{font-family:var(--fd);font-size:18px;letter-spacing:-0.4px;line-height:1.2}
.av-sub{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:6px}
.av-slug{font-family:var(--fd);font-size:13px;color:var(--muted)}
.av-date{font-size:13px;color:var(--muted);margin-inline-start:auto;text-align:end;line-height:1.5}
.av-date b{display:block;color:var(--ink2);font-weight:700}
.av-grid{display:grid;grid-template-columns:1fr;gap:12px;padding:14px 0;border-block:1px solid var(--line)}
@media (min-width:540px){.av-grid{grid-template-columns:repeat(3,1fr)}}
.av-field{display:flex;flex-direction:column;gap:3px;min-width:0}
.av-label{font-size:13px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--muted)}
.av-value{font-size:14px;font-weight:600;color:var(--ink);overflow-wrap:anywhere}
.av-pitch{background:var(--cream);border-inline-start:3px solid var(--ochre);border-radius:0 var(--r-s) var(--r-s) 0;padding:12px 14px;display:flex;flex-direction:column;gap:6px}
html[dir="rtl"] .av-pitch{border-radius:var(--r-s) 0 0 var(--r-s)}
.av-pitch p{font-size:14px;line-height:1.6;color:var(--ink2);font-style:italic}
.av-block{display:flex;flex-direction:column;gap:8px}
.av-block-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.av-docs{display:flex;flex-wrap:wrap;gap:8px}
/* min-height 44px: 8px of padding around 13px text gave a 34px target, and this
     is the control that opens somebody's ID document — the one thing on this page
     an admin must not mis-tap. */
  .av-doc{display:inline-flex;align-items:center;gap:7px;min-height:44px;font-size:13px;font-weight:700;padding:8px 12px;border-radius:11px;background:var(--blue50);color:var(--blue);border:1px solid transparent;transition:.15s}
.av-doc:hover{border-color:var(--blue)}
.av-doc-req{background:var(--sand);color:var(--ink2)}
.av-links{display:flex;flex-wrap:wrap;gap:8px}
.av-link{display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:700;padding:6px 11px;border-radius:999px;border:1.5px solid var(--line);color:var(--ink2);transition:.15s}
.av-link:hover{border-color:var(--blue);color:var(--blue)}
.av-actions{display:grid;grid-template-columns:1fr;gap:12px;padding-top:4px;border-top:1px solid var(--line);margin-top:2px;padding-block-start:16px}
@media (min-width:680px){.av-actions{grid-template-columns:auto 1fr;align-items:start}}
.av-approve .btn{width:100%}
@media (min-width:680px){.av-approve .btn{width:auto}}
.av-reject{display:flex;gap:10px;align-items:stretch;flex-wrap:wrap}
.av-note{flex:1;min-width:160px;margin:0;padding:11px 13px}
.av-reject .btn{width:auto;flex:none}
.av-btn-spin{width:16px;height:16px;border:2.5px solid rgba(255,255,255,.45);border-top-color:#fff;border-radius:50%;animation:spin 1s linear infinite}
.av-btn-spin.dark{border-color:rgba(16,31,51,.25);border-top-color:var(--ink)}
`;
