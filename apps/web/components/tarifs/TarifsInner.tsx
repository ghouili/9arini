"use client";

import { Link } from "@/components/Link";
import { SiteShell } from "@/components/SiteShell";
import { useLocale } from "@/components/LocaleProvider";
import { Card, CardFooter, Chip } from "@/components/ui";
import { Check, Shield, Wallet, Star } from "@/components/icons";
import { bilingual } from "@/lib/i18n";

/* ═══════════════════════════════════════════════════════════════════════════
   /tarifs — the pricing page.

   HONESTY RULES (load-bearing — do not break):
   • Tnajem processes NO money today (lib/payments.ts, PAYMENTS_ENABLED unset).
     Every plan below is FREE right now. The banner and the per-card "pas encore
     facturé" chip are driven by the real `paymentsEnabled` flag handed down by
     the server shell — not by a hardcoded assumption — so this page cannot drift
     out of sync with the switch.
   • The prices are real and final, but they are FUTURE. Nothing here may read as
     a charge that is happening now.
   • Equally, nothing here promises 0 % forever. The 0 % is a property of the
     pilot and is labelled as such.
   • Competitor rates are quoted ONLY where the platform publishes them itself.
     GoStudent does not publish a tutor commission, so no number is given for it
     — an invented one would be exactly the kind of claim this page exists to
     avoid. Preply and Wyzant figures come from their own help centres.

   NO SCROLL-REVEAL HERE, deliberately. /pour-les-profs needs an inverted reveal
   to survive nojs.mjs; this page simply renders its final state, which is the
   same contract with less that can go wrong.
   ═══════════════════════════════════════════════════════════════════════════ */

const copy = bilingual({
  fr: {
    eyebrow: "Tarifs",
    h1: "Nos tarifs, en clair.",
    lead: "Tnajem est gratuit pendant le pilote. Voici ce que ça coûtera quand les paiements en ligne s'ouvriront — pour que tu puisses décider en connaissance de cause, dès aujourd'hui.",
    ctaPrimary: "Crée ta page de prof",
    heroMicro: "Rien n'est facturé aujourd'hui.",

    // Banner — which one shows depends on the real PAYMENTS_ENABLED flag.
    pilotBanner:
      "Gratuit pendant le pilote — aucune de ces offres n'est encore facturée. Les paiements en ligne sont désactivés : Tnajem n'encaisse rien, ne prélève aucune commission et ne te facture aucun abonnement. On te préviendra avant que ça change.",
    liveBanner:
      "Les paiements en ligne sont actifs. Les formules ci-dessous sont facturées, et la commission de 10 % s'applique aux paiements traités par Tnajem.",

    plansTitle: "Les formules",
    plansLead: "Tnajem coûte deux choses au prof, et jamais l'une sans l'autre : un abonnement mensuel, plus 10 % sur chaque élève payant — uniquement sur les paiements que Tnajem traite. L'élève, lui, ne paie jamais Tnajem.",
    plusComm: "+ 10 % sur chaque élève payant",
    plusCommNote: "Uniquement sur les paiements traités par Tnajem. Rien sur ce qu'on te règle en main propre.",
    notBilled: "Pas encore facturé",
    recommended: "Recommandé",
    perMonth: "/ mois",
    planCta: "Commencer gratuitement",

    plans: [
      {
        id: "gratuit",
        name: "Gratuit",
        price: "0 TND",
        year: "0 TND / an",
        who: "1 à 14 élèves",
        billed: false,
        features: ["Ta page de prof et ton lien", "1 cours en ligne", "Réservations et avis", "Paiement en main propre"],
      },
      {
        id: "essentiel",
        name: "Essentiel",
        price: "29 TND",
        year: "290 TND / an — 2 mois offerts",
        who: "15 à 20 élèves",
        billed: true,
        features: ["Jusqu'à 5 cours", "Rappels SMS et WhatsApp", "Statistiques de base", "Tout ce qu'il y a dans Gratuit"],
      },
      {
        id: "pro",
        name: "Pro",
        price: "59 TND",
        year: "590 TND / an",
        who: "21 à 35 élèves",
        billed: true,
        features: ["Cours illimités", "Mis en avant dans Explorer", "Vends tes fiches et enregistrements", "Statistiques complètes"],
      },
      {
        id: "prestige",
        name: "Prestige",
        price: "99 TND",
        year: "990 TND / an",
        who: "36 élèves et plus",
        billed: true,
        features: ["Placement prioritaire", "Replays de tes séances", "Vérification prioritaire (48 h)", "Support prioritaire"],
      },
    ],

    commTitle: "La commission",
    commLine: "10 %, sur une seule chose : les paiements que Tnajem traite lui-même.",
    commPoints: [
      "Le même taux sur toutes les formules — 10 %, quel que soit ton volume.",
      "Ton élève te paie en main propre ? Tnajem ne prend rien et ne facture rien.",
      "La 1ʳᵉ séance est toujours offerte à l'élève — et sans commission.",
    ],
    commToday: "Aujourd'hui, Tnajem ne traitant aucun paiement, la commission perçue est de 0 TND.",

    cmpTitle: "Ce que prennent les autres",
    cmpLead: "Taux publiés par les plateformes elles-mêmes, relevés en août 2026. Les modèles diffèrent — à toi de juger.",
    cmpUs: "Tnajem",
    cmpUsBody: "10 %, uniquement sur les paiements traités par Tnajem. Rien sur ce que l'élève te règle en main propre.",
    cmpRows: [
      { name: "Preply", body: "18 à 33 % selon le nombre d'heures enseignées, et 100 % de chaque séance d'essai avec un nouvel élève." },
      { name: "Wyzant", body: "25 % de commission — le prof garde 75 % — plus 9 % de frais de service sur chaque séance." },
      { name: "GoStudent", body: "Formules par abonnement côté famille. La commission prof n'est pas publiée, donc on ne lui prête aucun chiffre." },
    ],
    cmpNote: "Sources : centres d'aide publics de Preply et Wyzant. On ne cite aucun chiffre qu'une plateforme n'a pas publié elle-même.",

    finalTitle: "Prêt à créer ta page ?",
    finalSub: "C'est gratuit, et ça prend 2 minutes.",
    finalMicro: "Gratuit pendant le pilote · sans engagement · supprimable à tout moment.",
    backToProfs: "Tout savoir sur Tnajem pour les profs",
  },

  ar: {
    eyebrow: "الأسعار",
    h1: "أسعارنا، واضحة.",
    lead: "Tnajem فابور في فترة التجربة. هاذي هي الأثمنة اللي باش تولّي كي يتحل الخلاص أونلاين — باش تعرف من توّا على شنوّة داخل.",
    ctaPrimary: "اعمل صفحتك متاع أستاذ",
    heroMicro: "اليوم ما فما حتى فاتورة.",

    pilotBanner:
      "فابور في فترة التجربة — ما زال ما نفوترو حتى خطة. الخلاص أونلاين مطفي : Tnajem ما تحصّل والو، ما تاخذ حتى عمولة، وما تفوترك حتى اشتراك. باش نعلموك قبل ما يتبدّل الحال.",
    liveBanner:
      "الخلاص أونلاين خدّام. الخطط اللي تحت ولّاو يتفوترو، والعمولة متاع 10 % تنطبق على الخلاص اللي يعدّي من Tnajem.",

    plansTitle: "الخطط",
    plansLead: "Tnajem تكلّف الأستاذ زوز حاجات، وعمرها وحدة بلا لأخرى : اشتراك شهري، زائد 10 % على كل تلميذ خلّص — كان على الخلاص اللي تعدّيه Tnajem. أمّا التلميذ، عمرو ما يخلّص Tnajem.",
    plusComm: "+ 10 % على كل تلميذ خلّص",
    plusCommNote: "كان على الخلاص اللي يعدّي من Tnajem. والو على اللي يخلّصك بيه في يدك.",
    notBilled: "ما زال ما يتفوترش",
    recommended: "ننصحو بيها",
    perMonth: "/ في الشهر",
    planCta: "ابدا فابور",

    plans: [
      {
        id: "gratuit",
        name: "فابور",
        price: "0 دينار",
        year: "0 دينار / في العام",
        who: "من 1 لـ 14 تلميذ",
        billed: false,
        features: ["صفحتك ولينكك", "درس واحد أونلاين", "الحجوزات والآراء", "الخلاص في يدك"],
      },
      {
        id: "essentiel",
        name: "الأساسي",
        price: "29 دينار",
        year: "290 دينار / في العام — شهرين فابور",
        who: "من 15 لـ 20 تلميذ",
        billed: true,
        features: ["حتى لـ 5 دروس", "تذكير بالـ SMS والواتساب", "إحصائيات أساسية", "كل اللي في فابور"],
      },
      {
        id: "pro",
        name: "برو",
        price: "59 دينار",
        year: "590 دينار / في العام",
        who: "من 21 لـ 35 تلميذ",
        billed: true,
        features: ["دروس بلا حدّ", "تبان في «اكتشف»", "بيع الفيشات والتسجيلات", "إحصائيات كاملة"],
      },
      {
        id: "prestige",
        name: "بريستيج",
        price: "99 دينار",
        year: "990 دينار / في العام",
        who: "36 تلميذ وأكثر",
        billed: true,
        features: ["مركز أول في العرض", "تسجيلات حصصك", "تثبّت بالأولوية (48 ساعة)", "دعم بالأولوية"],
      },
    ],

    commTitle: "العمولة",
    commLine: "10 %، على حاجة وحيدة : الخلاص اللي Tnajem تعدّيه هي بروحها.",
    commPoints: [
      "نفس النسبة في الخطط الكل — 10 %، مهما كان حجمك.",
      "التلميذ خلّصك في يدك ؟ Tnajem ما تاخذ والو وما تفوتر والو.",
      "أول حصة تبقى ديما فابور للتلميذ — وبلا عمولة.",
    ],
    commToday: "اليوم، وبما إلي Tnajem ما تعدّي حتى خلاص، العمولة اللي تتحصّل هي 0 دينار.",

    cmpTitle: "شنوّة ياخذو الآخرين",
    cmpLead: "نسب نشروها المنصّات بأنفسهم، مأخوذة في أوت 2026. النماذج تختلف — وإنتي احكم.",
    cmpUs: "Tnajem",
    cmpUsBody: "10 %، كان على الخلاص اللي يعدّي من Tnajem. والو على اللي يخلّصك بيه في يدك.",
    cmpRows: [
      { name: "Preply", body: "من 18 لـ 33 % حسب عدد الساعات اللي قرّيتها، و 100 % من كل حصة تجريبية مع تلميذ جديد." },
      { name: "Wyzant", body: "25 % عمولة — الأستاذ يحتفظ بـ 75 % — وزيد 9 % فريسي خدمة على كل حصة." },
      { name: "GoStudent", body: "اشتراكات شهرية على العائلة. عمولة الأستاذ ما هيش منشورة، وعلى هكّاكا ما نعطيوهاش رقم." },
    ],
    cmpNote: "المصادر : مراكز المساعدة العمومية متاع Preply و Wyzant. ما نذكرو حتى رقم ما نشرتوش المنصّة بروحها.",

    finalTitle: "حاضر باش تعمل صفحتك ؟",
    finalSub: "فابور، وتاخذ دقيقتين.",
    finalMicro: "فابور في فترة التجربة · بلا التزام · تنجم تمسحها وقتلي تحب.",
    backToProfs: "اعرف الكل على Tnajem للأساتذة",
  },
});

type Copy = (typeof copy)[keyof typeof copy];

/* Page-scoped CSS. Prefixed `tf-`, injected with dangerouslySetInnerHTML — an
   inline <style>{`…`}</style> in a client component triggers hydration errors.
   Unlayered on purpose, so it beats globals.css's @layer components without
   needing !important. Logical properties only (guardrails.mjs check #1). */
const CSS = `
.tf-price{font-family:var(--fd);font-size:clamp(30px,4vw,38px);line-height:1.05;letter-spacing:-1px;color:var(--ink)}
html[dir="rtl"] .tf-price{font-family:var(--fa);letter-spacing:normal}
.tf-per{font-size:14px;font-weight:700;color:var(--muted)}
.tf-year{font-size:13px;color:var(--muted);line-height:1.5}
.tf-who{font-size:13px;font-weight:700;color:var(--blue)}
/* The "+ 10 %" block. Sits directly under the price so the two costs are read
   as one number, not as a price with a footnote. */
.tf-plus{margin-block-start:10px;padding:9px 11px;border-radius:var(--r-s);
  background:var(--ochre-tint);display:flex;flex-direction:column;gap:2px}
.tf-plus b{font-size:13px;font-weight:700;color:var(--ochre-ink)}
.tf-plus span{font-size:13px;line-height:1.5;color:var(--ink2)}
.tf-feats{list-style:none;display:flex;flex-direction:column;gap:9px;margin-block-start:16px}
.tf-feats li{display:flex;gap:9px;align-items:flex-start;font-size:13.5px;line-height:1.5;color:var(--ink2);min-width:0}
.tf-feats .ic{width:17px;height:17px;flex:none;color:var(--green-ink);margin-block-start:2px}
/* The recommended plan. A ring rather than a scale transform: at 320px the cards
   are already full-bleed, and a transform would clip against the container. */
.tf-hi{border-color:var(--blue);box-shadow:0 0 0 2px var(--blue100),var(--sh-s)}
.tf-cmp{display:flex;flex-direction:column;gap:10px}
.tf-cmp-row{display:grid;grid-template-columns:1fr;gap:4px 14px;padding:14px 16px;border:1px solid var(--line);border-radius:var(--r-s);background:var(--paper);min-width:0}
@media (min-width:620px){.tf-cmp-row{grid-template-columns:150px 1fr;align-items:baseline}}
.tf-cmp-row.is-us{border-color:var(--blue);background:var(--blue50)}
.tf-cmp-name{font-family:var(--fd);font-weight:700;font-size:15px;color:var(--ink);min-width:0}
html[dir="rtl"] .tf-cmp-name{font-family:var(--fa)}
.tf-cmp-body{font-size:13.5px;line-height:1.6;color:var(--ink2);min-width:0;overflow-wrap:anywhere}
.tf-note{font-size:13px;line-height:1.6;color:var(--muted);margin-block-start:12px}
.tf-comm{list-style:none;display:flex;flex-direction:column;gap:11px;margin-block-start:16px}
.tf-comm li{display:flex;gap:10px;align-items:flex-start;font-size:14px;line-height:1.55;color:var(--ink2);min-width:0}
.tf-comm .ic{width:19px;height:19px;flex:none;color:var(--blue);margin-block-start:1px}
`;

function PlanCard({ plan, c, paymentsEnabled }: { plan: Copy["plans"][number]; c: Copy; paymentsEnabled: boolean }) {
  const highlighted = plan.id === "pro";
  return (
    <Card className={highlighted ? "tf-hi" : ""}>
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="font-display font-bold text-[17px] text-ink">{plan.name}</span>
        {/* "Recommandé", never "le plus populaire": no tutor is on any plan yet,
            so a popularity claim would be fabricated social proof. */}
        {highlighted && <Chip kind="soft">{c.recommended}</Chip>}
      </div>

      <div className="tf-who mb-3">{plan.who}</div>

      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className="tf-price">{plan.price}</span>
        <span className="tf-per">{c.perMonth}</span>
      </div>
      <div className="tf-year mt-1">{plan.year}</div>

      {/* §2.2: a price is never shown without the commission that comes with it.
          A tutor who reads only the card and meets the 10 % later has been misled
          by the layout, even though both numbers exist elsewhere on the page.
          EVERY card, Gratuit included — the 10 % is charged per paying student on
          all plans, so a free plan showing "0 TND" alone would be the same lie in
          its most tempting form. */}
      <div className="tf-plus">
        <b>{c.plusComm}</b>
        <span>{c.plusCommNote}</span>
      </div>

      {/* Only on plans that would actually cost something — "pas encore facturé"
          on the 0 TND plan would be noise. */}
      {plan.billed && !paymentsEnabled && (
        <div className="mt-2.5">
          <Chip kind="sand">{c.notBilled}</Chip>
        </div>
      )}

      <ul className="tf-feats">
        {plan.features.map((f) => (
          <li key={f}>
            <Check />
            <span className="min-w-0">{f}</span>
          </li>
        ))}
      </ul>

      <CardFooter className="pt-4">
        <Link href="/signup/prof" className="btn btn-ghost w-full">
          {c.planCta}
        </Link>
      </CardFooter>
    </Card>
  );
}

export function TarifsInner({ paymentsEnabled }: { paymentsEnabled: boolean }) {
  const { locale } = useLocale();
  const c: Copy = copy[locale];

  return (
    <SiteShell>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="web-section pb-0">
        <div className="container">
          <div className="max-w-[760px]">
            <div className="web-eyebrow mb-3">{c.eyebrow}</div>
            <h1 className="web-h1 mb-4">{c.h1}</h1>
            <p className="web-lead mb-6">{c.lead}</p>
            <div className="cluster">
              <Link href="/signup/prof" className="btn btn-primary w-auto px-6 py-[15px] text-[15px] max-w-full">
                {c.ctaPrimary}
              </Link>
            </div>
            <p className="text-[13px] text-muted flex items-center gap-[7px] mt-4">
              <Check className="w-[15px] h-[15px] text-green flex-none" />
              {c.heroMicro}
            </p>
          </div>
        </div>
      </section>

      {/* ── THE HONEST BANNER — driven by the real payments switch ───────── */}
      <section className="web-section tight">
        <div className="container">
          <div className="trust">
            <Shield />
            <p>{paymentsEnabled ? c.liveBanner : c.pilotBanner}</p>
          </div>
        </div>
      </section>

      {/* ── PLANS ───────────────────────────────────────────────────────── */}
      <section className="web-section tight">
        <div className="container">
          <h2 className="web-h2 mb-3">{c.plansTitle}</h2>
          <p className="web-lead mb-6 max-w-[680px]">{c.plansLead}</p>
          <div className="grid-auto">
            {c.plans.map((p) => (
              <PlanCard key={p.id} plan={p} c={c} paymentsEnabled={paymentsEnabled} />
            ))}
          </div>
        </div>
      </section>

      {/* ── COMMISSION ──────────────────────────────────────────────────── */}
      <section className="web-section tight">
        <div className="container">
          <div className="max-w-[760px]">
            <h2 className="web-h2 mb-3">{c.commTitle}</h2>
            <p className="web-lead">{c.commLine}</p>
            <ul className="tf-comm">
              {c.commPoints.map((p) => (
                <li key={p}>
                  <Wallet />
                  <span className="min-w-0">{p}</span>
                </li>
              ))}
            </ul>
            {!paymentsEnabled && <p className="tf-note">{c.commToday}</p>}
          </div>
        </div>
      </section>

      {/* ── COMPARISON — published rates only ───────────────────────────── */}
      <section className="web-section tight">
        <div className="container">
          <h2 className="web-h2 mb-3">{c.cmpTitle}</h2>
          <p className="web-lead mb-6 max-w-[720px]">{c.cmpLead}</p>

          {/* Rows, not a <table>: at 320px a 2-column table either overflows the
              page (shots.mjs exits 1) or crushes the text. This collapses to a
              single column instead. */}
          <div className="tf-cmp">
            <div className="tf-cmp-row is-us">
              <div className="tf-cmp-name">{c.cmpUs}</div>
              <div className="tf-cmp-body">{c.cmpUsBody}</div>
            </div>
            {c.cmpRows.map((r) => (
              <div key={r.name} className="tf-cmp-row">
                <div className="tf-cmp-name">{r.name}</div>
                <div className="tf-cmp-body">{r.body}</div>
              </div>
            ))}
          </div>
          <p className="tf-note">{c.cmpNote}</p>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────────────── */}
      <section className="web-section">
        <div className="container">
          <Card className="text-center">
            <div className="flex justify-center mb-3">
              <Star className="w-6 h-6 text-ochre-ink" />
            </div>
            <h2 className="web-h2 mb-2">{c.finalTitle}</h2>
            <p className="web-lead mb-5">{c.finalSub}</p>
            <div className="cluster justify-center">
              <Link href="/signup/prof" className="btn btn-primary w-auto px-6 py-[15px] text-[15px] max-w-full">
                {c.ctaPrimary}
              </Link>
            </div>
            <p className="text-[13px] text-muted mt-4">{c.finalMicro}</p>
            <p className="mt-3">
              <Link href="/pour-les-profs" className="linklike linklike-inline">
                {c.backToProfs}
              </Link>
            </p>
          </Card>
        </div>
      </section>
    </SiteShell>
  );
}
