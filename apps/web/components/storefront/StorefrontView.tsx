/* SERVER component. This is the URL a tutor pastes into WhatsApp, so it is the
   most-loaded page in the product and the one that has to paint on a 3G Android
   before anything else. It used to be 750 lines of "use client": both locale
   dictionaries, the price/seats branching and the whole review list were
   serialised into the client bundle purely to render markup that never changes
   after paint.

   The only interactive element on the page — the native share sheet — now lives
   in <ShareButton>, a client island. Everything else is HTML.

   The locale arrives as a PROP rather than from useLocale(), because a hook is
   what forced the client boundary in the first place; app/[locale]/[slug]/page.tsx
   already knows the locale from the URL segment. */
import { Link } from "@/components/Link";
import { ShareButton } from "./ShareButton";
import { dict, bilingual } from "@/lib/i18n";
import type { AppLocale } from "@/lib/locale";
import { Avatar, Verified } from "@/components/ui";
import {
  Star,
  Clock,
  Users,
  Shield,
  Play,
  Forward,
  Calendar,
  Check,
  Gift,
} from "@/components/icons";
import { SiteShell } from "@/components/SiteShell";
import type { Storefront, TutorReviews, ClassItem } from "@tnajem/shared";

/** Month label map FR → AR (short). Demo data uses FR short labels. */
const monthAr: Record<string, string> = {
  JANV: "جانفي", FÉVR: "فيفري", MARS: "مارس", AVR: "أفريل",
  MAI: "ماي", JUIN: "جوان", JUIL: "جويل", AOÛT: "أوت",
  SEPT: "سبتمبر", OCT: "أكتوبر", NOV: "نوفمبر", DÉC: "ديسمبر",
};

/* Component-local copy (FR + Tunisian Derija). lib/i18n.ts is owned elsewhere, so
   any new string lives here — same pattern as app/pour-les-profs/page.tsx.

   Two shared keys are deliberately NOT used on this page:
     • t.common.secure  → "Paiement sécurisé · Flouci & D17". There is no payment
       rail in the pilot (lib/payments.ts::paymentsEnabled() is false), so that
       string promises a checkout that does not exist. `noCard`/`payDirect` below
       say what is actually true.
     • t.common.seats(n) → "${n} places", which reads "1 places" and, at 0, invites
       a click straight into a full class. `seats()` below pluralises and says
       "Complet" / "كامل". */
const copy = bilingual({
  fr: {
    students: "élèves",
    isNew: "Nouveau prof",
    verifiedLabel: "Prof vérifié par Tnajem",
    reviewsTitle: "Avis des élèves",
    reviewsCount: (n: number) => (n === 1 ? "1 avis" : `${n} avis`),
    noReviewsTitle: "Pas encore d'avis",
    noReviewsBody: "Ce prof vient d'arriver. Après ta séance, tu pourras laisser le premier avis.",
    anon: "Élève",
    // Fallback CTA when the first class is NOT the free session — t.storefront.cta
    // hardcodes "1ère séance gratuite", so it would be a false promise here.
    book: "Réserver la séance",
    bookShort: "Réserver",
    noClassesTitle: "Ce prof n'a pas encore publié de séance",
    noClassesBody:
      "Sa page est ouverte, mais aucune séance n'est encore programmée. Reviens bientôt — ou trouve un autre prof dès maintenant.",
    noClassesCta: "Voir d'autres profs",

    // ── Price / seats ──
    free: "Gratuite",
    then: (p: number) => `puis ${p} TND la séance`,
    perSession: "la séance",
    seats: (n: number) =>
      n <= 0 ? "Complet" : n === 1 ? "1 place restante" : `${n} places restantes`,

    // ── Trust (true for the pilot: no rail, no card, nothing charged here) ──
    freeFirst: "1ère séance gratuite",
    noCard: "Sans engagement",
    cancel24: "Annulation gratuite 24h avant",
    payDirect:
      "Tnajem ne prend aucun paiement. La 1ère séance est offerte ; les suivantes, tu les règles directement avec ton prof.",

    // ── How it works ──
    howTitle: "Comment ça se passe",
    how1: "Tu réserves ta place — sans engagement.",
    how2: "Tu reçois le lien de la séance dans « Mes cours ».",
    how3: "1ère séance offerte. Ensuite tu payes ton prof directement, s'il te convient.",

    nextSession: "Prochaine séance",
    classesAria: "Séances en direct de ce prof",
    packsNote: "À demander à ton prof pendant la séance — rien ne s'achète ici.",
    allFullTitle: "Toutes les séances sont complètes",
    allFullBody:
      "Ce prof affiche complet. Reviens quand il publiera de nouvelles dates — ou trouve un autre prof dès maintenant.",
  },
  ar: {
    students: "تلميذ",
    isNew: "أستاذ جديد",
    verifiedLabel: "أستاذ مؤكّد من Tnajem",
    reviewsTitle: "آراء التلامذة",
    reviewsCount: (n: number) => (n === 1 ? "تقييم واحد" : `${n} تقييم`),
    noReviewsTitle: "ما فماش تقييمات توّا",
    noReviewsBody: "الأستاذ هذا جديد. بعد الحصة متاعك، تنجّم تكون أوّل واحد يقيّم.",
    anon: "تلميذ",
    book: "احجز الحصة",
    bookShort: "احجز",
    noClassesTitle: "هذا الأستاذ مازال ما نشرش حصة",
    noClassesBody:
      "الصفحة متاعو محلولة، أما مازال ما فماش حصة مبرمجة. عاود شوف قريب — ولا لوّج على أستاذ آخر توّا.",
    noClassesCta: "شوف أساتذة أخرين",

    free: "مجانية",
    then: (p: number) => `من بعد ${p} د.ت للحصة`,
    perSession: "للحصة",
    seats: (n: number) =>
      n <= 0 ? "كامل" : n === 1 ? "بلاصة وحدة تبقات" : n === 2 ? "زوز بلايص تبقاو" : `${n} بلايص تبقاو`,

    freeFirst: "الحصة الأولى مجانية",
    noCard: "بلا التزام",
    cancel24: "إلغاء مجاني 24 ساعة قبل",
    payDirect:
      "Tnajem ما تاخذ حتى خلاص. الحصة الأولى مجانية ؛ الحصص الموالية تخلّصهم مباشرة مع أستاذك.",

    howTitle: "كيفاش تمشي الحكاية",
    how1: "تحجز بلاصتك — بلا التزام.",
    how2: "يوصلك رابط الحصة في « حصصي ».",
    how3: "الحصة الأولى مجانية. من بعد تخلّص أستاذك مباشرة، كان عجبك.",

    nextSession: "الحصة الجاية",
    classesAria: "الحصص المباشرة متاع الأستاذ",
    packsNote: "اطلبهم من أستاذك في الحصة — ما فماش شراء هوني.",
    allFullTitle: "الحصص الكل كاملة",
    allFullBody:
      "هذا الأستاذ كامل توّا. عاود شوف كي يزيد دواتم جداد — ولا لوّج على أستاذ آخر توّا.",
  },
});

const EMPTY_REVIEWS: TutorReviews = { items: [], average: 0, count: 0 };

/** "Amine K." → "AK". Reviews only ever carry a public name (never the phone). */
function initialsOf(name: string | null) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/** Deterministic (UTC) date — identical on the server and after hydration. */
function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

/** 5 stars, only `filled` of them lit. No reviews → the caller shows "Nouveau" instead.
    Decorative by default (aria-hidden) since a nearby number carries the score; pass
    `label` on a standalone rating (e.g. a review row) so the score is announced. */
function Stars({ filled, size = 13, label }: { filled: number; size?: number; label?: string }) {
  return (
    <span
      className="stars"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{
            width: size,
            height: size,
            opacity: i <= filled ? 1 : 0.28,
          }}
        />
      ))}
    </span>
  );
}

export function StorefrontView({
  data,
  reviews = EMPTY_REVIEWS,
  locale,
}: {
  data: Storefront;
  reviews?: TutorReviews;
  locale: AppLocale;
}) {
  const t = dict[locale];
  const c = copy[locale === "ar" ? "ar" : "fr"];
  const { tutor, classes, packs } = data;

  /* A newly-verified tutor can have ZERO published classes. In that state there is
     nothing to book, so `firstClass` is undefined and EVERY booking CTA must be
     suppressed: /checkout with no `class` param is a dead end (it cannot resolve a
     class, a price or a seat). We show an honest empty state and point the student
     at /explore instead of handing them a broken checkout.

     The panel/sticky-bar CTA books ONE class, so it books the first one that still
     has a seat — sending every visitor at classes[0] when classes[0] is full is a
     guaranteed trip to the "Plus de places" error. If every class is full we say so
     instead of offering the CTA at all. */
  const firstClass = classes.find((k) => k.seats_left > 0) ?? classes[0];
  const allFull = Boolean(firstClass) && firstClass.seats_left <= 0;

  /* The shared CTA string promises a free first session. Only say that when the
     class we'd actually book IS the free one; otherwise fall back to a neutral,
     honest label so a paid class never carries a "gratuite" promise. */
  const ctaLabel = firstClass?.is_free_first ? t.storefront.cta : c.book;

  // The rating shown is the one backed by the reviews table — never a decorative 5 stars.
  const hasReviews = reviews.count > 0;
  const average = hasReviews ? reviews.average : 0;

  function localMonth(m: string) {
    if (locale === "ar") return monthAr[m] ?? m;
    return m;
  }

  /* One price renderer for every surface, so the storefront can never show
     "1ère gratuite" and "15 TND" side by side as if both applied. A free-first
     class reads: Gratuite → puis 15 TND la séance. */
  function PriceBlock({ cls, big }: { cls: ClassItem; big?: boolean }) {
    if (cls.is_free_first) {
      return (
        <div className="sf-price-block">
          <div className={big ? "sf-amount sf-amount-lg sf-free" : "sf-amount sf-free"}>{c.free}</div>
          {cls.price_tnd > 0 && <div className="sf-then">{c.then(cls.price_tnd)}</div>}
        </div>
      );
    }
    return (
      <div className="sf-price-block">
        <div className={big ? "sf-amount sf-amount-lg" : "sf-amount"}>
          {cls.price_tnd} <span className="sf-cur">{t.common.tnd}</span>
        </div>
        <div className="sf-then">{c.perSession}</div>
      </div>
    );
  }

  /* Shared dead-end state: no published class, or every class full. Rendered in the
     main column AND in the aside so neither surface offers a CTA that resolves to
     nothing — and both always hand the student a way out (/explore). */
  function NoBooking({ center, full }: { center?: boolean; full?: boolean }) {
    return (
      <div className={`u-card u-card-pad sf-empty${center ? " sf-empty-center" : ""}`}>
        <span className="sf-empty-ic" aria-hidden="true">
          {full ? <Users /> : <Clock />}
        </span>
        <div className="min-w-0">
          <h3 className="sf-empty-title">{full ? c.allFullTitle : c.noClassesTitle}</h3>
          <p className="sf-empty-body">{full ? c.allFullBody : c.noClassesBody}</p>
          <Link href="/explore" className="btn btn-ghost btn-sm sf-empty-cta">
            {c.noClassesCta}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <SiteShell>
      {/* ── Full-bleed zellige hero band ── */}
      <div className="zellige hero-blue shrink-0">
        <div className="container">
          <div className="sf-hero">
            {/* Tutor identity */}
            <div className="sf-hero-id">
              <Avatar initials={tutor.avatar_initials} size={88} />
              <div className="min-w-0">
                <h1 className="web-h2 sf-name">
                  <span className="sf-name-txt">{tutor.full_name}</span>
                  {tutor.verified && <Verified label={c.verifiedLabel} />}
                </h1>
                <div className="sf-subject">{tutor.subject}</div>

                <div className="sf-hero-meta">
                  {hasReviews ? (
                    <>
                      <Stars filled={Math.round(average)} />
                      <b className="sf-num">{average.toFixed(1)}</b>
                      <span className="opacity-[0.85]">({c.reviewsCount(reviews.count)})</span>
                    </>
                  ) : (
                    /* No reviews yet → say so. Never a fake star score. */
                    <span className="sf-newtag">{c.isNew}</span>
                  )}

                  {tutor.students_count > 0 && (
                    <>
                      <span aria-hidden="true" className="opacity-[0.6]">·</span>
                      <span>
                        {tutor.students_count.toLocaleString()} {c.students}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* The page's one interactive element — see ShareButton. */}
            <ShareButton title={tutor.full_name} label={t.common.share} />
          </div>

          {/* The three facts that decide whether a visitor tries this prof. Each pill
              is nowrap and the strip wraps — it can never deform at 320px. Hidden
              when there is nothing to book: they'd be promises about a checkout the
              visitor cannot reach. */}
          {firstClass && !allFull && (
            <ul className="sf-pills" role="list">
              {firstClass.is_free_first && (
                <li className="sf-pill"><Gift />{c.freeFirst}</li>
              )}
              <li className="sf-pill"><Shield />{c.noCard}</li>
              <li className="sf-pill"><Calendar />{c.cancel24}</li>
            </ul>
          )}
        </div>
      </div>

      {/* ── Main content area ── */}
      <section className="web-section">
        <div className="container">
          {/*
            Two-column desktop layout:
            main (1fr) | aside (340px)
            Stacks to single column on mobile.
          */}
          <div className="sf-grid" data-sf-grid="true">
            {/* ── MAIN column ── */}
            <div className="min-w-0">
              {/* No "réservé 23 fois cette semaine" banner: that number was a
                  hardcoded string in lib/i18n.ts (t.storefront.bookedThisWeek),
                  rendered on EVERY storefront including a brand-new tutor with
                  zero bookings. The real, earned social proof is the rating +
                  students_count in the hero above — both computed from the
                  reviews/bookings tables. Don't reintroduce this without a
                  real per-tutor "booked this week" count. */}

              {/* Bio — guarded so an empty bio doesn't leave a gapped blank block. */}
              {tutor.bio && <p className="web-lead sf-bio">{tutor.bio}</p>}

              {/* ── Classes ── the reason the page exists, so it comes first. */}
              <div className="sf-sechead">
                <h2 className="sf-h2">{t.storefront.live}</h2>
                {/* Every published class is already listed below — no dead "see all" link. */}
                {classes.length > 0 && <span className="sf-count">{classes.length}</span>}
              </div>

              {!firstClass ? (
                /* Honest empty state — no phantom card, no CTA to a class that
                   does not exist. */
                <NoBooking />
              ) : (
                <ul className="sf-classes" role="list" aria-label={c.classesAria}>
                  {classes.map((cls) => {
                    const soldOut = cls.seats_left <= 0;
                    return (
                      <li key={cls.id}>
                        {/* The <a> IS the row: a <button> inside an <a> (the old
                            markup) is invalid, non-focusable-in-order interactive
                            nesting. */}
                        <Link href={`/class/${cls.id}`} className="u-card u-card-int sf-row">
                          <div className="thumb">
                            <b>{cls.day}</b>
                            <span>{localMonth(cls.month)}</span>
                          </div>

                          <div className="sf-row-main">
                            <h3 className="sf-row-title">{cls.title}</h3>
                            <div className="metaline">
                              <span>
                                <Clock />
                                {cls.time} · {cls.duration_min} {t.common.min}
                              </span>
                              <span className={soldOut ? "sf-soldout" : undefined}>
                                <Users />
                                {c.seats(cls.seats_left)}
                              </span>
                            </div>
                          </div>

                          <div className="sf-row-end">
                            <PriceBlock cls={cls} />
                            <Forward className="sf-chev" />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* ── How it works — three lines that answer "what happens to my money".
                   Placed right after the list, where the visitor is deciding. ── */}
              <div className="sf-how">
                <h2 className="sf-h3">{c.howTitle}</h2>
                <ol className="sf-steps" role="list">
                  <li><span className="sf-step-n">1</span><span>{c.how1}</span></li>
                  <li><span className="sf-step-n">2</span><span>{c.how2}</span></li>
                  <li><span className="sf-step-n">3</span><span>{c.how3}</span></li>
                </ol>
              </div>

              {/* ── Packs — only when the tutor actually has packs. Demoted to a
                   compact list: nothing here is purchasable (there is no pack
                   checkout), so a card that looks buyable is a dead end. ── */}
              {packs.length > 0 && (
                <>
                  <div className="sf-sechead mt-[34px]">
                    <h2 className="sf-h2">{t.storefront.packs}</h2>
                  </div>
                  <ul className="sf-packs" role="list">
                    {packs.map((pack) => (
                      <li key={pack.id} className="u-card sf-pack">
                        <span className="sf-pack-ic" aria-hidden="true"><Play /></span>
                        <div className="sf-pack-main">
                          <h3 className="sf-pack-title">{pack.title}</h3>
                          <div className="metaline"><span>{pack.meta}</span></div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="sf-packs-note">{c.packsNote}</p>
                </>
              )}

              {/* ── Reviews section — real rows from getTutorReviews(slug) ── */}
              <div className="sf-sechead mt-[34px]">
                <h2 className="sf-h2">{c.reviewsTitle}</h2>
                {hasReviews && <span className="sf-count">{c.reviewsCount(reviews.count)}</span>}
              </div>

              {!hasReviews ? (
                /* Honest empty state — no stars, no invented score. */
                <div className="u-card u-card-pad sf-empty">
                  <span className="sf-empty-ic sf-empty-ic-blue" aria-hidden="true">
                    <Star />
                  </span>
                  <div className="min-w-0">
                    <h3 className="sf-empty-title">{c.noReviewsTitle}</h3>
                    <p className="sf-empty-body is-flush">{c.noReviewsBody}</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Average summary */}
                  <div className="u-card u-card-pad sf-avg">
                    <div className="sf-avg-n">{average.toFixed(1)}</div>
                    <div className="min-w-0">
                      <Stars filled={Math.round(average)} size={15} />
                      <div className="sf-avg-c">{c.reviewsCount(reviews.count)}</div>
                    </div>
                  </div>

                  {/* Review list */}
                  <ul className="sf-reviews" role="list">
                    {reviews.items.map((r) => (
                      <li key={r.id} className="u-card u-card-pad">
                        <div className="sf-rev-head">
                          <div className="sf-rev-who">
                            <Avatar initials={initialsOf(r.studentName) || "?"} size={34} square />
                            <div className="min-w-0">
                              <div className="sf-rev-name">{r.studentName ?? c.anon}</div>
                              <Stars filled={r.rating} size={12} label={`${r.rating}/5`} />
                            </div>
                          </div>
                          <time dateTime={r.createdAt} className="sf-rev-date">
                            {fmtDate(r.createdAt)}
                          </time>
                        </div>

                        {r.text && <p className="sf-rev-text">{r.text}</p>}
                        {r.classTitle && (
                          <div className="metaline mt-2">
                            <span>{r.classTitle}</span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            {/* ── ASIDE (desktop sticky booking panel) ── */}
            <aside data-sf-aside="true">
              <div className="panel panel-pad sf-panel">
                {/* No published class → nothing to book. Say so, and send the
                    student somewhere that works. NEVER a /checkout link without a
                    class id: it resolves no class, no price, no seat.
                    Branch on `firstClass` (not a boolean) so TS narrows it to a
                    defined ClassItem inside the bookable branch. */}
                {/* `!firstClass || allFull` (not a precomputed boolean) so TS narrows
                    firstClass to a defined ClassItem inside the bookable branch. */}
                {!firstClass || allFull ? (
                  <NoBooking center full={allFull} />
                ) : (
                  <>
                    {/* Which class this button actually books — naming it removes
                        the guesswork when the tutor has several. */}
                    <div className="sf-panel-label">{c.nextSession}</div>
                    <div className="sf-panel-title">{firstClass.title}</div>
                    <div className="metaline sf-panel-meta">
                      <span>
                        <Calendar />
                        {firstClass.day} {localMonth(firstClass.month)} · {firstClass.time}
                      </span>
                      <span>
                        <Clock />
                        {firstClass.duration_min} {t.common.min}
                      </span>
                      <span className={firstClass.seats_left <= 0 ? "sf-soldout" : undefined}>
                        <Users />
                        {c.seats(firstClass.seats_left)}
                      </span>
                    </div>

                    <div className="divider" style={{ margin: "16px 0" }} />

                    <PriceBlock cls={firstClass} big />

                    {/* CTA — only reachable when firstClass exists. */}
                    <Link
                      href={`/checkout?class=${firstClass.id}`}
                      className="btn btn-primary sf-cta"
                    >
                      {ctaLabel}
                    </Link>

                    {/* What is actually true in the pilot: nothing is charged here. */}
                    <div className="trust sf-trust">
                      <Shield />
                      <p>{c.payDirect}</p>
                    </div>
                  </>
                )}
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Mobile sticky CTA — visible on small screens only.
          Suppressed entirely when the tutor has no published class, or when every
          class is full: a sticky bar that can only lead to a broken /checkout (or a
          guaranteed "Plus de places") is worse than no bar at all. The in-page
          states above already offer /explore. */}
      {firstClass && !allFull && (
        <div data-sf-mobilecta="true" className="sf-mcta">
          <div className="sf-mcta-row">
            <div className="sf-mcta-price">
              {firstClass.is_free_first ? (
                <>
                  <b className="sf-free">{c.free}</b>
                  <span>{c.freeFirst}</span>
                </>
              ) : (
                <>
                  <b>
                    {firstClass.price_tnd} {t.common.tnd}
                  </b>
                  <span>{c.perSession}</span>
                </>
              )}
            </div>
            <Link
              href={`/checkout?class=${firstClass.id}`}
              className="btn btn-primary sf-mcta-btn"
              aria-label={ctaLabel}
            >
              {c.bookShort}
            </Link>
          </div>
          <div className="sf-mcta-note">
            <Check />
            <span>{c.noCard}</span>
          </div>
        </div>
      )}

      {/* Page-scoped styles. Everything below is layout that has to survive
          320px-wide Arabic strings, so it lives in real CSS (media queries,
          logical properties, RTL font fallbacks) rather than inline objects. */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* Display font. No RTL overrides here on purpose: globals.css redefines the
           --fd token to --fa and zeroes letter-spacing under html[dir="rtl"], which
           covers every surface below. Duplicating it locally would only rot. */
        .sf-h2,.sf-h3,.sf-amount,.sf-num,.sf-avg-n,.sf-panel-label,.sf-step-n{
          font-family:var(--fd);
        }

        /* ── hero ── */
        .sf-hero{
          display:flex;align-items:center;justify-content:space-between;gap:18px;
          flex-wrap:wrap;padding-top:clamp(26px,4vw,46px);padding-bottom:14px;
        }
        .sf-hero-id{display:flex;gap:clamp(14px,3vw,20px);align-items:center;flex:1 1 240px;min-width:0}
        .sf-share{flex:none}
        /* No inline letterSpacing here (the old markup had one): an inline style
           beats the stylesheet, so it would have survived the RTL reset in
           globals.css and kept severing Arabic joins in the tutor's own name. */
        .sf-name{color:#fff;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
        .sf-name-txt{min-width:0;overflow-wrap:anywhere}
        .sf-subject{color:var(--on-blue-soft);font-size:15px;margin-top:5px;font-weight:600;overflow-wrap:anywhere}
        .sf-hero-meta{
          display:flex;align-items:center;gap:8px;margin-top:10px;
          font-size:13.5px;color:var(--on-blue);flex-wrap:wrap;
        }
        .sf-newtag{background:rgba(255,255,255,.16);border-radius:999px;padding:3px 10px;font-weight:700;font-size:13px;white-space:nowrap}
        @media (max-width:520px){
          /* 88px avatar + Arabic name + share button do not fit at 320px. The size
             is an inline style on <Avatar>, hence !important. */
          .sf-hero-id .avatar{width:62px!important;height:62px!important;font-size:23px!important;border-width:2px}
          .sf-name{font-size:22px}
          .sf-subject{font-size:14px}
        }

        .sf-pills{
          list-style:none;display:flex;flex-wrap:wrap;gap:8px;
          padding:0 0 clamp(22px,3.4vw,34px);margin:0;
        }
        .sf-pill{
          display:inline-flex;align-items:center;gap:6px;white-space:nowrap;
          background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.2);
          border-radius:999px;padding:6px 12px;font-size:13px;font-weight:700;color:#fff;
        }
        .sf-pill .ic{width:13px;height:13px;color:var(--mint200)}

        /* ── layout ── */
        .sf-grid{display:grid;grid-template-columns:1fr;gap:clamp(24px,3vw,40px);align-items:start}
        .sf-bio{margin-bottom:30px;line-height:1.7;overflow-wrap:anywhere}
        .sf-sechead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}
        .sf-h2{font-size:clamp(17px,2vw,21px);letter-spacing:-.3px;line-height:1.25;min-width:0}
        .sf-h3{font-size:14.5px;letter-spacing:-.2px;margin-bottom:10px}
        .sf-count{font-size:13px;color:var(--muted);font-weight:600;flex:none}

        /* ── class rows: a scannable list, not a grid of squeezed cards. The old
             260px card put thumb + title + meta + chip + price on ONE flex line, so
             the text column collapsed to a few pixels and spilled out of the card. ── */
        .sf-classes{list-style:none;display:grid;gap:10px;margin:0;padding:0}
        /* Surface comes from .u-card (globals) — only the row geometry lives here,
           so these rows can never drift from the rest of the product's cards. */
        .sf-row{flex-direction:row;align-items:center;gap:14px;flex-wrap:wrap;
          padding:14px 16px;color:var(--ink)}
        .sf-row-main{flex:1 1 180px;min-width:0}
        .sf-row-title{font-weight:700;font-size:15px;line-height:1.35;margin-bottom:6px;overflow-wrap:anywhere}
        .sf-row-end{display:flex;align-items:center;gap:12px;flex:none;margin-inline-start:auto}
        .sf-chev{width:16px;height:16px;color:var(--muted);flex:none}
        .sf-soldout{color:var(--rose);font-weight:700}
        @media (max-width:559px){
          /* Below ~560px the price + chevron drop to their own full-width line
             instead of stealing width from the title. */
          .sf-row-end{
            flex:1 0 100%;margin-inline-start:0;justify-content:space-between;
            border-top:1px solid var(--line);padding-top:10px;
          }
        }

        /* ── price ── */
        .sf-price-block{min-width:0}
        .sf-amount{font-weight:700;font-size:17px;letter-spacing:-.3px;white-space:nowrap;line-height:1.15}
        .sf-amount-lg{font-size:30px;letter-spacing:-.9px}
        .sf-free{color:var(--green-ink)}
        /* max(13px, .72em): the relative size read 12.2px next to a 17px price. */
        .sf-cur{font-size:max(13px,.72em);font-weight:600;color:var(--muted)}
        .sf-then{font-size:13px;color:var(--muted);margin-top:3px;line-height:1.4}

        /* ── how it works ── */
        .sf-how{
          margin-top:22px;background:var(--blue50);border:1px solid var(--lineCool);
          border-radius:var(--r);padding:16px;
        }
        .sf-steps{list-style:none;display:grid;gap:10px;margin:0;padding:0}
        .sf-steps li{display:flex;gap:10px;align-items:flex-start;font-size:13.5px;line-height:1.55;color:var(--ink2)}
        .sf-step-n{
          flex:none;width:22px;height:22px;border-radius:999px;background:var(--blue);color:#fff;
          display:grid;place-items:center;font-size:13px;font-weight:700;margin-top:1px;
        }

        /* ── packs (informational only — nothing is purchasable) ── */
        .sf-packs{list-style:none;display:grid;gap:8px;margin:0;padding:0}
        .sf-pack{flex-direction:row;gap:12px;align-items:center;padding:12px 14px}
        .sf-pack-ic{flex:none;width:40px;height:40px;border-radius:12px;background:var(--green50);
          color:var(--green);display:grid;place-items:center}
        .sf-pack-main{min-width:0}
        .sf-pack-title{font-weight:700;font-size:13.5px;line-height:1.35;margin-bottom:4px;overflow-wrap:anywhere}
        .sf-packs-note{font-size:13px;color:var(--muted);margin-top:8px;line-height:1.55}

        /* ── reviews ── */
        .sf-avg{flex-direction:row;align-items:center;gap:16px;margin-bottom:12px;flex-wrap:wrap}
        .sf-avg-n{font-size:34px;font-weight:700;letter-spacing:-1px;color:var(--ink);line-height:1}
        .sf-avg-c{font-size:13px;color:var(--muted);margin-top:4px}
        .sf-reviews{list-style:none;display:grid;gap:12px;margin:0;padding:0}
        .sf-rev-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;flex-wrap:wrap}
        .sf-rev-who{display:flex;align-items:center;gap:9px;min-width:0}
        .sf-rev-name{font-weight:700;font-size:13.5px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .sf-rev-date{font-size:13px;color:var(--muted);flex:none}
        .sf-rev-text{font-size:13.5px;line-height:1.65;color:var(--ink2);margin:0;overflow-wrap:anywhere}

        /* ── empty states ── */
        .sf-empty{flex-direction:row;gap:14px;align-items:flex-start}
        .sf-empty-center{flex-direction:column;align-items:center;text-align:center}
        .sf-empty-ic{flex:none;width:44px;height:44px;border-radius:999px;background:var(--sand);
          color:var(--ink2);display:grid;place-items:center}
        .sf-empty-ic .ic{width:20px;height:20px}
        .sf-empty-ic-blue{background:var(--blue50);color:var(--blue)}
        .sf-empty-title{font-size:14.5px;margin-bottom:5px}
        .sf-empty-body{font-size:13px;color:var(--muted);line-height:1.6;margin:0 0 12px}
        /* This block is injected unlayered, so it outranks every Tailwind layer
           whatever the specificity — an mb-0 utility on the element is simply
           inert. The flush variant has to live here too. */
        .sf-empty-body.is-flush{margin-bottom:0}
        .sf-empty-cta{display:inline-flex;width:auto}
        .sf-empty-center .sf-empty-cta{width:100%}

        /* ── aside panel ── */
        .sf-panel-label{font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
        .sf-panel-title{font-weight:700;font-size:15.5px;line-height:1.35;margin-bottom:8px;overflow-wrap:anywhere}
        .sf-panel-meta{gap:10px}
        .sf-cta{margin-top:16px;min-height:52px}
        .sf-trust{margin-top:14px}

        /* ── mobile sticky CTA ── */
        .sf-mcta{
          position:sticky;bottom:0;z-index:20;
          background:rgba(251,247,240,.94);
          -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
          border-top:1px solid var(--line);
          padding:12px clamp(16px,4vw,40px) max(14px,env(safe-area-inset-bottom));
        }
        .sf-mcta-row{display:flex;align-items:center;gap:12px}
        .sf-mcta-price{min-width:0;display:flex;flex-direction:column;line-height:1.2}
        .sf-mcta-price b{font-family:var(--fd);font-size:17px;letter-spacing:-.3px;white-space:nowrap}
        .sf-mcta-price span{font-size:13px;color:var(--muted);margin-top:2px}
        .sf-mcta-btn{flex:1 1 auto;width:auto;max-width:260px;margin-inline-start:auto;min-height:50px}
        .sf-mcta-note{
          display:flex;justify-content:center;align-items:center;gap:6px;
          margin-top:8px;color:var(--muted);font-size:13px;
        }
        .sf-mcta-note .ic{width:13px;height:13px;color:var(--green)}

        /* ── responsive: two-column from 960px ── */
        @media (min-width:960px){
          [data-sf-grid="true"]{grid-template-columns:1fr 340px}
          [data-sf-aside="true"]{display:block;position:sticky;top:84px}
          /* Aside now carries the CTA — the sticky mobile bar would double it. */
          [data-sf-mobilecta="true"]{display:none}
        }
        @media (max-width:959px){
          [data-sf-aside="true"]{display:none}
        }
      `}} />
    </SiteShell>
  );
}
