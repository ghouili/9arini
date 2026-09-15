"use client";
import { useCallback, useEffect, useState } from "react";
import { Link } from "@/components/Link";
import { Avatar, Button, Spinner } from "@/components/ui";
import { useLocale } from "@/components/LocaleProvider";
import { useToast } from "@/components/useToast";
import { SiteShell } from "@/components/SiteShell";
import { Shield } from "@/components/icons";
import { UserText } from "@/components/UserText";
import {
  findAccount, getAdminReports, resolveReport, getAdminTakedowns, resolveTakedown, getPendingAvatars, decideAvatar,
} from "@/app/actions";
import { formatInTunis, type AdminReport, type AdminTakedown, type PendingAvatar } from "@tnajem/shared";
import { bilingual } from "@/lib/i18n";

/* /admin/moderation — the three queues a person has to work (Stage 5).

   Reports (from anyone, signed in or not), copyright claims on materials, and
   profile photos waiting for review. Each existed in the API with no screen, so a
   report went into a table nobody opened, a rights-holder's claim was never
   answered, and no photo could ever be approved.

   Every decision is the API's and is audited there. This page shows what the
   decision is about BEFORE the click: the reported page, the claimant, the photo
   itself. A photo decision is bound to the exact file shown — if the tutor
   uploaded another meanwhile, the API refuses and the queue reloads. */

const copy = bilingual({
  fr: {
    eyebrow: "ADMIN",
    title: "Modération",
    lead: "Signalements, demandes de retrait et photos à valider.",
    toVerifications: "Vérifications",
    toAccounts: "Comptes",
    deniedTitle: "Accès réservé",
    deniedNote: "Cette page est réservée aux administrateurs.",
    signIn: "Se connecter",
    reports: "Signalements",
    takedowns: "Demandes de retrait (droits d'auteur)",
    photos: "Photos à valider",
    emptyReports: "Aucun signalement ouvert.",
    emptyTakedowns: "Aucune demande de retrait ouverte.",
    emptyPhotos: "Aucune photo en attente.",
    kind: { tutor: "Page prof", class: "Séance", review: "Avis", message: "Message", material: "Document", other: "Autre" },
    open: "Ouvrir",
    anonymous: "Signalement anonyme",
    from: "De",
    received: (d: string) => `Reçu le ${d}`,
    noteLabel: "Note (visible par les admins uniquement)",
    actioned: "Traité",
    dismissed: "Classé sans suite",
    resolved: "Signalement fermé.",
    claimant: "Demandeur",
    ofTutor: "Document de",
    uphold: "Retirer le document",
    upholdHint: "Le document est retiré tout de suite et un avertissement est enregistré sur le compte du prof.",
    reject: "Rejeter la demande",
    upheld: "Document retiré.",
    rejectedClaim: "Demande rejetée.",
    approve: "Approuver",
    rejectPhoto: "Refuser",
    approved: "Photo approuvée.",
    photoRejected: "Photo refusée.",
    changed: "Cette photo a changé depuis l'affichage. La file est rechargée : regarde la nouvelle.",
    already: "Déjà traité par quelqu'un d'autre. La file est rechargée.",
    error: "Une erreur s'est produite. Réessaie.",
  },
  ar: {
    eyebrow: "أدمين",
    title: "المراقبة",
    lead: "التبليغات، طلبات السحب والتصاور اللي تستنّى.",
    toVerifications: "التثبّت",
    toAccounts: "الحسابات",
    deniedTitle: "الدخول محجوز",
    deniedNote: "الصفحة هاذي محجوزة للأدمين برك.",
    signIn: "ادخل",
    reports: "التبليغات",
    takedowns: "طلبات سحب (حقوق المؤلف)",
    photos: "تصاور تستنّى",
    emptyReports: "ما فمّاش تبليغ مفتوح.",
    emptyTakedowns: "ما فمّاش طلب سحب مفتوح.",
    emptyPhotos: "ما فمّاش تصويرة تستنّى.",
    kind: { tutor: "صفحة أستاذ", class: "حصّة", review: "تقييم", message: "رسالة", material: "وثيقة", other: "حاجة أخرى" },
    open: "حلّ",
    anonymous: "تبليغ بلا إسم",
    from: "من",
    received: (d: string) => `وصل نهار ${d}`,
    noteLabel: "ملاحظة (يشوفوها الأدمين برك)",
    actioned: "تعالج",
    dismissed: "بلا متابعة",
    resolved: "التبليغ تسكّر.",
    claimant: "صاحب الطلب",
    ofTutor: "وثيقة متاع",
    uphold: "اسحب الوثيقة",
    upholdHint: "الوثيقة تتسحب توّا وينحسب إنذار على حساب الأستاذ.",
    reject: "ارفض الطلب",
    upheld: "الوثيقة تسحبت.",
    rejectedClaim: "الطلب ترفض.",
    approve: "اقبل",
    rejectPhoto: "ارفض",
    approved: "التصويرة تقبلت.",
    photoRejected: "التصويرة ترفضت.",
    changed: "التصويرة تبدّلت من وقت ما تعرضت. الليستة تعاودت: شوف الجديدة.",
    already: "تعالج قبل من حد آخر. الليستة تعاودت.",
    error: "صار مشكل. عاود.",
  },
});

export default function AdminModerationPage() {
  const { locale } = useLocale();
  const c = copy[locale];
  const { toast, showToast } = useToast();

  const [checking, setChecking] = useState(true);
  const [admin, setAdmin] = useState(false);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [takedowns, setTakedowns] = useState<AdminTakedown[]>([]);
  const [photos, setPhotos] = useState<PendingAvatar[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const when = (iso: string) => formatInTunis(iso, locale, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

  const reload = useCallback(async () => {
    const [r, t, p] = await Promise.all([getAdminReports(), getAdminTakedowns(), getPendingAvatars()]);
    setReports(r);
    setTakedowns(t);
    setPhotos(p);
  }, []);

  /* Who may see this page is the API's decision, asked the same way /admin/accounts
     asks it: an empty lookup answers "forbidden" off the allowlist. */
  useEffect(() => {
    let alive = true;
    findAccount("")
      .then(async (res) => {
        const ok = res.error !== "forbidden";
        if (!alive) return;
        setAdmin(ok);
        if (ok) await reload();
      })
      .catch(() => { if (alive) setAdmin(false); })
      .finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, [reload]);

  async function run(key: string, action: () => Promise<{ ok: boolean; error?: string; already?: boolean }>, success: string) {
    if (busy) return;
    setBusy(key);
    try {
      const res = await action();
      if (res.ok) showToast(res.already ? c.already : success);
      else showToast(res.error === "changed-since-review" ? c.changed : res.error === "not-pending" ? c.already : c.error);
      await reload();
    } catch {
      showToast(c.error);
    } finally {
      setBusy(null);
    }
  }

  return (
    <SiteShell>
      <section className="web-section tight">
        <div className="container container-narrow">
          <div className="mb-6">
            <span className="web-eyebrow inline-flex items-center gap-1.5 mb-2">
              <Shield className="w-4 h-4" />
              {c.eyebrow}
            </span>
            <h1 className="web-h2">{c.title}</h1>
            {!checking && admin && (
              <p className="muted mt-2 leading-[1.6]">
                {c.lead}{" "}
                <Link href="/admin/verifications" className="linklike">{c.toVerifications}</Link>
                {" · "}
                <Link href="/admin/accounts" className="linklike">{c.toAccounts}</Link>
              </p>
            )}
          </div>

          {checking && (
            <div className="panel panel-pad grid place-items-center gap-3 text-center">
              <Spinner />
            </div>
          )}

          {!checking && !admin && (
            <div className="panel panel-pad grid place-items-center gap-3 text-center">
              <h2 className="font-display text-[22px]">{c.deniedTitle}</h2>
              <p className="muted leading-[1.6]">{c.deniedNote}</p>
              <Link href="/auth" className="w-auto">
                <Button variant="ink" sm>{c.signIn}</Button>
              </Link>
            </div>
          )}

          {!checking && admin && (
            <div className="flex flex-col gap-8">
              {/* ── Reports ── */}
              <section aria-labelledby="mod-reports">
                <h2 id="mod-reports" className="font-display text-[20px] mb-3">{c.reports} ({reports.length})</h2>
                {reports.length === 0 && <p className="panel panel-pad muted">{c.emptyReports}</p>}
                <div className="flex flex-col gap-3">
                  {reports.map((r) => (
                    <article key={r.id} className="panel panel-pad flex flex-col gap-3" data-e2e="report-item">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="chip">{c.kind[r.subjectKind]}</span>
                        {r.subject && <UserText className="font-bold">{r.subject.label}</UserText>}
                        {r.subject?.href && <Link href={r.subject.href} className="linklike">{c.open}</Link>}
                      </div>
                      <UserText as="p" className="leading-[1.6] whitespace-pre-wrap m-0">{r.reason}</UserText>
                      <p className="muted text-[13px] m-0">
                        {r.reporterEmail ? <>{c.from} <span dir="ltr">{r.reporterEmail}</span></> : c.anonymous} · {c.received(when(r.createdAt))}
                      </p>
                      <label>
                        <span className="field-label block mb-1.5">{c.noteLabel}</span>
                        <span className="inp block">
                          <textarea
                            rows={2}
                            maxLength={1000}
                            value={notes[r.id] ?? ""}
                            onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                          />
                        </span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="ink" sm disabled={busy !== null} onClick={() => run(`r:${r.id}`, () => resolveReport({ id: r.id, action: "actioned", note: notes[r.id] }), c.resolved)}>
                          {c.actioned}
                        </Button>
                        <Button variant="ghost" sm disabled={busy !== null} onClick={() => run(`r:${r.id}`, () => resolveReport({ id: r.id, action: "dismissed", note: notes[r.id] }), c.resolved)}>
                          {c.dismissed}
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              {/* ── Copyright claims ── */}
              <section aria-labelledby="mod-takedowns">
                <h2 id="mod-takedowns" className="font-display text-[20px] mb-3">{c.takedowns} ({takedowns.length})</h2>
                {takedowns.length === 0 && <p className="panel panel-pad muted">{c.emptyTakedowns}</p>}
                <div className="flex flex-col gap-3">
                  {takedowns.map((t) => (
                    <article key={t.id} className="panel panel-pad flex flex-col gap-3" data-e2e="takedown-item">
                      <div>
                        <UserText as="div" className="font-bold">{t.materialTitle}</UserText>
                        <div className="muted text-[13px] mt-1">
                          {c.ofTutor} <UserText>{t.tutorName}</UserText> · <Link href={`/${t.tutorSlug}`} className="linklike">{c.open}</Link>
                        </div>
                      </div>
                      <UserText as="p" className="leading-[1.6] whitespace-pre-wrap m-0">{t.reason}</UserText>
                      <p className="muted text-[13px] m-0">
                        {c.claimant} : <UserText>{t.claimantName}</UserText> · <span dir="ltr">{t.claimantEmail}</span> · {c.received(when(t.createdAt))}
                      </p>
                      <p className="text-[13px] leading-[1.6] m-0">{c.upholdHint}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="ink" sm disabled={busy !== null} onClick={() => run(`t:${t.id}`, () => resolveTakedown({ id: t.id, uphold: true }), c.upheld)}>
                          {c.uphold}
                        </Button>
                        <Button variant="ghost" sm disabled={busy !== null} onClick={() => run(`t:${t.id}`, () => resolveTakedown({ id: t.id, uphold: false }), c.rejectedClaim)}>
                          {c.reject}
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              {/* ── Photos ── */}
              <section aria-labelledby="mod-photos">
                <h2 id="mod-photos" className="font-display text-[20px] mb-3">{c.photos} ({photos.length})</h2>
                {photos.length === 0 && <p className="panel panel-pad muted">{c.emptyPhotos}</p>}
                <div className="flex flex-col gap-3">
                  {photos.map((p) => (
                    <article key={p.tutorId} className="panel panel-pad flex flex-wrap items-center gap-4" data-e2e="photo-item">
                      <Avatar
                        initials="?"
                        size={96}
                        square
                        src={`/api/admin/avatar/${p.tutorId}/md?v=${encodeURIComponent(p.version ?? "")}`}
                        alt={p.fullName}
                      />
                      <div className="flex-[1_1_180px] min-w-0">
                        <UserText as="div" className="font-bold">{p.fullName}</UserText>
                        <div className="muted text-[13px] mt-1" dir="ltr">/{p.slug}</div>
                        {p.updatedAt && <div className="muted text-[13px] mt-1">{c.received(when(p.updatedAt))}</div>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="ink" sm disabled={busy !== null || !p.version} onClick={() => run(`p:${p.tutorId}`, () => decideAvatar({ tutorId: p.tutorId, approve: true, version: p.version ?? "" }), c.approved)}>
                          {c.approve}
                        </Button>
                        <Button variant="ghost" sm disabled={busy !== null || !p.version} onClick={() => run(`p:${p.tutorId}`, () => decideAvatar({ tutorId: p.tutorId, approve: false, version: p.version ?? "" }), c.photoRejected)}>
                          {c.rejectPhoto}
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </section>
      {toast}
    </SiteShell>
  );
}
