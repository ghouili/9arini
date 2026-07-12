"use client";
/* ───────────────────────────────────────────────────────────────────────────
   /terms — Conditions d'utilisation (FR + AR).

   ⚠️  DRAFT / MODÈLE. Written by the product team, NOT by a lawyer. It must be
   reviewed by a Tunisian lawyer before go-live. The dated "modèle — à faire
   relire par un avocat" banner at the top of the page is deliberate: do not
   remove it until counsel has signed off and the bracketed placeholders
   (company form, registered office, matricule fiscal, competent court) are
   filled in.

   Self-contained bilingual copy lives in `copy` below (same pattern as
   /pour-les-profs). Design system: SiteShell + .panel + .container-narrow.
   RTL-safe: logical properties only. Page-scoped CSS is prefixed `lg-` and
   injected with dangerouslySetInnerHTML (an inline <style>{`…`}</style> inside a
   client component causes hydration errors).
   ─────────────────────────────────────────────────────────────────────────── */
import Link from "next/link";
import { SiteShell } from "@/components/SiteShell";
import { useLocale } from "@/components/LocaleProvider";

type Section = { h: string; p?: string[]; list?: string[]; after?: string[] };
type LegalCopy = {
  notice: string;
  noticeSub: string;
  eyebrow: string;
  title: string;
  updated: string;
  lead: string;
  sections: Section[];
  seeAlso: string;
};

const CSS = `
.lg-notice{display:flex;gap:12px;align-items:flex-start;padding:14px 16px;margin-bottom:26px;
  background:var(--rose50);border:1px solid rgba(226,72,61,.28);border-radius:var(--r);}
.lg-notice .ic{color:var(--rose);flex:none;margin-top:2px}
.lg-notice b{display:block;color:#9E2C23;font-size:14px;line-height:1.5}
.lg-notice span{display:block;margin-top:4px;color:#8A3A34;font-size:12.5px;line-height:1.6}
.lg-head{margin-bottom:24px}
.lg-head .web-h2{margin:8px 0 6px}
.lg-updated{font-size:12.5px;font-weight:700;color:var(--muted);margin-bottom:14px}
.lg-doc h2{font-family:var(--fd);font-size:18px;line-height:1.35;margin:30px 0 10px;color:var(--ink)}
.lg-doc h2:first-child{margin-top:0}
.lg-doc p{font-size:15px;line-height:1.75;color:var(--ink2);margin-bottom:10px}
.lg-doc ul{margin:6px 0 12px;padding-inline-start:20px;list-style:disc}
.lg-doc li{font-size:15px;line-height:1.75;color:var(--ink2);margin-bottom:6px}
.lg-doc hr{border:0;height:1px;background:var(--line);margin:26px 0 0}
.lg-seealso{margin-top:20px;font-size:14px}
`;

const copy: { fr: LegalCopy; ar: LegalCopy } = {
  fr: {
    notice: "Modèle — à faire relire par un avocat avant la mise en ligne.",
    noticeSub:
      "Version du 12 juillet 2026. Ce texte est un projet rédigé par l'équipe produit pour cadrer le service. Il ne constitue pas un conseil juridique et n'a pas encore été validé par un avocat.",
    eyebrow: "Légal",
    title: "Conditions d'utilisation",
    updated: "Version du 12 juillet 2026",
    lead:
      "Ces conditions expliquent, en langage simple, ce que 9arini fait, ce que 9arini ne fait pas, et les règles que chacun accepte en utilisant la plateforme. En créant un compte ou en réservant une séance, tu les acceptes.",
    sections: [
      {
        h: "1. Ce qu'est 9arini (et ce qu'il n'est pas)",
        p: [
          "9arini (قرّيني) est une plateforme de mise en relation. Elle permet à des élèves — et à leurs parents — de trouver des profs particuliers indépendants en Tunisie, de voir leurs séances et de réserver une place.",
          "9arini n'est pas une école, ne délivre aucun diplôme, et n'est pas l'employeur des profs. Les profs sont indépendants : ils choisissent leurs matières, leurs horaires, leur méthode et leurs prix. Le cours lui-même est un accord entre l'élève (ou son parent) et le prof. 9arini fournit l'outil, pas l'enseignement.",
          "9arini ne garantit aucun résultat scolaire, aucune note et aucun niveau.",
        ],
      },
      {
        h: "2. Qui peut utiliser 9arini",
        p: [
          "Il faut être une personne physique et donner des informations exactes. Un compte est personnel : tu ne le partages pas et tu es responsable de ce qui en est fait.",
        ],
        list: [
          "Élève majeur : tu peux créer ton compte toi-même.",
          "Élève mineur (moins de 18 ans) : un parent ou tuteur doit donner son accord et renseigner son nom et son téléphone. Sans cet accord, le compte n'est pas activé.",
          "Prof : tu dois pouvoir prouver ton identité (voir article 9) et être en règle avec tes propres obligations (statut, fiscalité, autorisations éventuelles). 9arini ne s'en charge pas à ta place.",
        ],
      },
      {
        h: "3. Compte, téléphone et code SMS",
        p: [
          "La connexion se fait avec ton numéro de téléphone et un code à usage unique envoyé par SMS. Ce code est personnel et temporaire : ne le communique jamais, à personne. 9arini ne te demandera jamais ton code par téléphone, par WhatsApp ou par message.",
          "Si tu perds l'accès à ton numéro, écris-nous : nous pouvons devoir vérifier ton identité avant de rétablir l'accès.",
        ],
      },
      {
        h: "4. Les profs fixent leurs prix",
        p: [
          "Chaque prof affiche librement le prix de ses séances, en dinar tunisien (TND), ainsi que la durée, le nombre de places et le contenu. 9arini n'impose aucun tarif et ne négocie pas à la place du prof.",
          "Les prix affichés sont ceux du prof. Le prof est seul responsable de ses obligations fiscales et déclaratives liées à ses revenus.",
        ],
      },
      {
        h: "5. La première séance offerte",
        p: [
          "Un prof peut choisir d'offrir la première séance à un nouvel élève. Quand c'est le cas, c'est indiqué clairement sur sa page.",
          "L'offre est limitée à une séance gratuite par élève et par prof. Elle ne peut être ni revendue, ni cumulée, ni transformée en argent. Un prof peut retirer l'offre pour ses futures séances à tout moment ; cela n'affecte pas une séance gratuite déjà réservée.",
        ],
      },
      {
        h: "6. Paiements : pas encore actifs",
        p: [
          "Aujourd'hui, 9arini n'encaisse aucun paiement. Aucune carte, aucun portefeuille et aucun compte bancaire n'est débité via la plateforme. Réserver une séance ne déclenche aucun prélèvement.",
          "Les éléments liés au paiement que tu peux voir dans l'application (moyens de paiement, commission de la plateforme, retraits) décrivent une fonctionnalité en préparation. Ils ne s'appliquent pas tant que les paiements ne sont pas officiellement activés — ce qui suppose les accords, agréments et vérifications nécessaires.",
          "Si un prof et un élève choisissent de s'arranger financièrement en dehors de 9arini, cela se fait entre eux, hors plateforme, sous leur seule responsabilité. 9arini n'est ni partie, ni intermédiaire, ni garant de cet arrangement.",
          "Quand les paiements seront activés, ces conditions seront mises à jour et tu en seras informé avant que la fonctionnalité ne s'applique à toi.",
        ],
      },
      {
        h: "7. Réservation et annulation (règle des 24 h)",
        p: ["Une séance a un nombre de places limité. La réservation est confirmée dans la limite des places disponibles."],
        list: [
          "Tu peux annuler gratuitement jusqu'à 24 heures avant le début de la séance.",
          "À moins de 24 heures du début, la place est considérée comme retenue : le prof n'est pas tenu de la reprogrammer.",
          "Si le prof annule ou ne se présente pas, tu ne dois rien et la séance est reprogrammée ou annulée.",
          "Les annulations répétées de dernière minute (élève ou prof) peuvent entraîner une suspension du compte.",
        ],
      },
      {
        h: "8. Règles d'usage",
        p: ["En utilisant 9arini, tu t'engages à ne pas :"],
        list: [
          "harceler, insulter, menacer ou discriminer qui que ce soit — élève, parent ou prof ;",
          "publier un contenu illégal, violent, haineux, sexuel, ou inadapté à des mineurs ;",
          "usurper l'identité d'une autre personne, ou mentir sur tes diplômes et ton expérience ;",
          "enregistrer, filmer ou rediffuser une séance sans l'accord clair de toutes les personnes présentes ;",
          "revendre, copier ou redistribuer les cours, fiches et enregistrements d'un prof ;",
          "utiliser des robots ou du scraping pour extraire des données de la plateforme ;",
          "envoyer du spam, de la publicité, ou détourner 9arini de son objet éducatif.",
        ],
        after: [
          "En cas de manquement, nous pouvons retirer un contenu, suspendre ou supprimer un compte — sans préavis lorsque la sécurité des utilisateurs, en particulier des mineurs, l'exige.",
        ],
      },
      {
        h: "9. Vérification des profs",
        p: [
          "Avant d'apparaître publiquement, un prof doit soumettre une pièce d'identité (CIN ou passeport, recto/verso). Les diplômes et attestations sont facultatifs et servent à renforcer la confiance.",
          "Ces documents sont examinés manuellement par un administrateur de 9arini. Ils ne sont jamais publiés. Leur traitement, leur durée de conservation et leur suppression sont décrits dans la politique de confidentialité.",
          "Le badge « Vérifié » signifie uniquement que des documents d'identité ont été présentés et contrôlés visuellement. Ce n'est ni une enquête judiciaire, ni un agrément de l'État, ni une garantie de compétence pédagogique ou de bonne conduite. Nous pouvons refuser ou retirer une vérification à tout moment.",
        ],
      },
      {
        h: "10. Contenus et propriété intellectuelle",
        p: [
          "Le prof reste propriétaire de ses cours, fiches, enregistrements et supports. En les publiant sur 9arini, il accorde à 9arini une licence gratuite et non exclusive, limitée à l'hébergement, l'affichage et la promotion de son offre sur la plateforme et ses canaux de communication, pour la durée de la publication.",
          "L'élève reçoit un droit d'usage strictement personnel : il peut apprendre avec ces supports, pas les revendre ni les diffuser.",
          "Le nom « 9arini », « قرّيني », le logo et l'identité visuelle appartiennent à 9arini et ne peuvent pas être utilisés sans autorisation écrite.",
        ],
      },
      {
        h: "11. Cours en direct et outils tiers",
        p: [
          "Les séances en direct peuvent s'appuyer sur des outils tiers (visioconférence, tableau blanc, quiz). Ces outils ont leurs propres conditions et leur propre politique de confidentialité. 9arini ne les contrôle pas et n'est pas responsable de leur disponibilité.",
        ],
      },
      {
        h: "12. Disponibilité du service",
        p: [
          "9arini est fourni « en l'état ». Le service peut être interrompu pour maintenance, mise à jour ou incident technique. Nous faisons de notre mieux pour limiter ces interruptions, sans garantie de disponibilité continue.",
        ],
      },
      {
        h: "13. Responsabilité",
        p: [
          "9arini met en relation ; elle ne dispense pas le cours. Dans les limites permises par le droit tunisien, 9arini n'est pas responsable du contenu pédagogique, de la qualité, du comportement ou des propos d'un prof, d'un élève ou d'un parent, ni des dommages indirects (perte de temps, perte d'une note, perte de chance).",
          "Rien dans ces conditions n'exclut la responsabilité de 9arini en cas de dol, de faute lourde ou d'atteinte à l'intégrité physique, ni les droits que la loi tunisienne reconnaît impérativement aux consommateurs.",
        ],
      },
      {
        h: "14. Suspension et fermeture du compte",
        p: [
          "Tu peux fermer ton compte à tout moment en nous écrivant. Nous pouvons suspendre ou fermer un compte qui enfreint ces conditions, la loi, ou qui met en danger d'autres utilisateurs.",
          "La fermeture n'annule pas d'elle-même les séances déjà réservées auprès d'autres utilisateurs ; nous ferons le nécessaire pour prévenir les personnes concernées.",
        ],
      },
      {
        h: "15. Modification des conditions",
        p: [
          "Ces conditions peuvent évoluer, notamment lors de l'activation des paiements. La version applicable est celle publiée sur cette page. En cas de changement important, nous te préviendrons dans l'application ou par SMS avant qu'il ne s'applique.",
        ],
      },
      {
        h: "16. Droit applicable et litiges",
        p: [
          "Ces conditions sont soumises au droit tunisien. En cas de désaccord, on commence par en parler : écris-nous, nous cherchons une solution amiable. À défaut d'accord, le litige relève des tribunaux tunisiens compétents.",
          "[À compléter par l'avocat : forme sociale et dénomination exacte de l'éditeur, siège social, matricule fiscal, registre national des entreprises, tribunal compétent, éventuelle clause de médiation de la consommation.]",
        ],
      },
      {
        h: "17. Nous contacter",
        p: ["Une question sur ces conditions : contact@9arini.tn."],
      },
    ],
    seeAlso: "Voir aussi : politique de confidentialité",
  },

  ar: {
    notice: "نموذج — لازم يقراه محامي قبل ما ينشر رسميًا.",
    noticeSub:
      "نسخة 12 جويلية 2026. النصّ هذا مسودّة كتبها فريق المنتج باش يوضّح الخدمة. ما هوش استشارة قانونية وما زال ما صادقش عليه محامي.",
    eyebrow: "قانوني",
    title: "شروط الاستعمال",
    updated: "نسخة 12 جويلية 2026",
    lead:
      "الشروط هاذي تشرح، بكلام بسيط، شنوّة تعمل قرّيني، شنوّة ما تعملهاش، والقواعد اللي كل واحد يقبلها كي يستعمل المنصّة. كي تعمل حساب ولا تحجز حصة، إنت تقبل بيهم.",
    sections: [
      {
        h: "1. شنوّة هي قرّيني (وشنوّة ما هيش)",
        p: [
          "قرّيني (9arini) هي منصّة ربط. تعاون التلاميذ — وأولياءهم — باش يلقاو أساتذة خصوصيين مستقلّين في تونس، يشوفو حصصهم ويحجزو بلاصة.",
          "قرّيني ماهيش مدرسة، ما تعطي حتى شهادة، وماهيش المشغّل متاع الأساتذة. الأساتذة مستقلّين: هوما اللي يختارو الموادّ، الأوقات، الطريقة والأسعار. الحصة روحها اتفاق بين التلميذ (ولا وليّه) والأستاذ. قرّيني توفّر الأداة، موش التدريس.",
          "قرّيني ما تضمنش حتى نتيجة دراسية ولا عدد ولا مستوى.",
        ],
      },
      {
        h: "2. شكون ينجّم يستعمل قرّيني",
        p: [
          "لازم تكون شخص طبيعي وتعطي معلومات صحيحة. الحساب شخصي: ما تشاركوش مع حتى واحد وإنت مسؤول على كل شيء يتعمل بيه.",
        ],
        list: [
          "تلميذ راشد: تنجّم تعمل حسابك وحدك.",
          "تلميذ قاصر (أقلّ من 18 سنة): لازم وليّ يوافق ويعمّر اسمه ورقم تليفونه. من غير الموافقة هاذي، الحساب ما يتفعّلش.",
          "أستاذ: لازم تثبت هويتك (شوف الفصل 9) وتكون في القانون مع واجباتك (الوضعية، الجباية، الرخص إذا لزمو). قرّيني ما تعملهمش عوضك.",
        ],
      },
      {
        h: "3. الحساب، التليفون ورمز الـSMS",
        p: [
          "الدخول يتمّ برقم تليفونك وبرمز وحيد يوصلك في SMS. الرمز هذا شخصي ووقتي: ما تعطيه لحتى واحد. قرّيني عمرها ما تطلب منّك الرمز بالتليفون ولا بواتساب ولا برسالة.",
          "إذا ضيّعت رقمك، اكتبلنا: نجّمو نحتاجو نتثبّتو في هويتك قبل ما نرجّعولك الدخول.",
        ],
      },
      {
        h: "4. الأساتذة هوما اللي يحدّدو أسعارهم",
        p: [
          "كل أستاذ يحطّ سعر حصصه بالدينار التونسي (TND) بكل حرّية، مع المدّة، عدد الأماكن والمحتوى. قرّيني ما تفرضش تعريفة وما تفاوضش عوض الأستاذ.",
          "الأسعار الظاهرة هي أسعار الأستاذ. الأستاذ وحدو مسؤول على واجباته الجبائية والتصريحية على مداخيله.",
        ],
      },
      {
        h: "5. الحصة الأولى مجانية",
        p: [
          "الأستاذ ينجّم يختار يعطي الحصة الأولى مجانا لتلميذ جديد. وقتها يتكتب بوضوح في صفحته.",
          "العرض محدود بحصة مجانية وحدة لكل تلميذ مع كل أستاذ. ما ينباعش، ما يتجمّعش وما يتحوّلش لفلوس. الأستاذ ينجّم ينحّي العرض على حصصه الجايّة وقت ما يحبّ؛ هذا ما يمسّش حصة مجانية محجوزة من قبل.",
        ],
      },
      {
        h: "6. الخلاص: ما زال ما تفعّلش",
        p: [
          "اليوم، قرّيني ما تقبض حتى مليم. حتى بطاقة، حتى محفظة وحتى حساب بنكي ما يتخصمش عبر المنصّة. الحجز ما يجرّ حتى خصم.",
          "كل حاجة تشوفها في التطبيق على الدفع (وسائل الخلاص، عمولة المنصّة، السحب) تخصّ ميزة ما زالت في التحضير. ما تنطبقش قبل ما الدفع يتفعّل رسميًا — وهذا يستوجب الاتفاقات والتراخيص والتثبّتات اللازمة.",
          "إذا أستاذ وتلميذ قرّرو يتفاهمو على الخلاص برّة قرّيني، هذا يصير بيناتهم، برّة المنصّة، على مسؤوليتهم وحدهم. قرّيني ماهيش طرف، لا وسيط ولا ضامن في الاتفاق هذاكا.",
          "كي يتفعّل الخلاص، الشروط هاذي باش تتحيّن وباش نعلموك قبل ما تنطبق عليك.",
        ],
      },
      {
        h: "7. الحجز والإلغاء (قاعدة الـ24 ساعة)",
        p: ["الحصة عندها عدد أماكن محدود. الحجز يتأكّد على قدّ الأماكن المتوفّرة."],
        list: [
          "تنجّم تلغي بلا مصاريف حتى 24 ساعة قبل بداية الحصة.",
          "أقلّ من 24 ساعة قبل البداية، البلاصة تتعدّ محجوزة: الأستاذ موش ملزم يعاود يبرمجها.",
          "إذا الأستاذ لغى ولا ما جاش، ما عليك والو والحصة تتبرمج من جديد ولا تتلغى.",
          "الإلغاء المتكرّر في آخر لحظة (تلميذ ولا أستاذ) ينجّم يجرّ تعليق الحساب.",
        ],
      },
      {
        h: "8. قواعد الاستعمال",
        p: ["كي تستعمل قرّيني، إنت تلتزم ما تعملش:"],
        list: [
          "مضايقة، شتيمة، تهديد ولا تمييز ضدّ أيّ واحد — تلميذ، وليّ ولا أستاذ؛",
          "نشر محتوى غير قانوني، عنيف، فيه كراهية، جنسي، ولا ما يصلحش للقاصرين؛",
          "انتحال شخصية غيرك، ولا الكذب على شهائدك وخبرتك؛",
          "تسجيل ولا تصوير ولا إعادة بثّ حصة من غير موافقة واضحة من الكلّ؛",
          "بيع ولا نسخ ولا توزيع دروس وملخّصات وتسجيلات أستاذ؛",
          "استعمال روبوات ولا أدوات آلية باش تسحب البيانات من المنصّة؛",
          "إرسال سبام ولا إشهار، ولا استعمال قرّيني في حاجة ما عندهاش علاقة بالتعليم.",
        ],
        after: [
          "في صورة الإخلال، ننجّمو ننحّيو محتوى، نعلّقو ولا نحذفو حساب — وبلا إعلام مسبق كي تكون سلامة المستعملين، وبالخصوص القاصرين، في خطر.",
        ],
      },
      {
        h: "9. توثيق الأساتذة",
        p: [
          "قبل ما يظهر للعموم، الأستاذ لازم يبعث وثيقة هوية (بطاقة تعريف وطنية ولا جواز سفر، وجه وظهر). الشهائد والوثائق الأخرى اختيارية وتزيد في الثقة.",
          "الوثائق هاذي يشوفها إداري من قرّيني بصفة يدوية. ما تتنشرش عمرها. طريقة معالجتها، مدّة الاحتفاظ بيها وحذفها مشروحين في سياسة الخصوصية.",
          "شارة « موثّق » تعني برك إلّي وثائق الهوية تقدّمت واتشافت بالعين. ماهيش تحرّي قضائي، لا ترخيص من الدولة، ولا ضمان للكفاءة البيداغوجية ولا لحسن السلوك. ننجّمو نرفضو ولا ننحّيو التوثيق وقت ما نحبّو.",
        ],
      },
      {
        h: "10. المحتوى والملكية الفكرية",
        p: [
          "الأستاذ يبقى مالك دروسه، ملخّصاته، تسجيلاته وموادّه. كي ينشرهم في قرّيني، يعطي لقرّيني رخصة مجانية وغير حصرية، محدودة في الاستضافة والعرض والترويج لعرضه في المنصّة وقنواتها، طول مدّة النشر.",
          "التلميذ عندو حقّ استعمال شخصي برك: يقرا بيهم، ما ينجّمش يبيعهم ولا يوزّعهم.",
          "الاسم « قرّيني »، « 9arini »، الشعار والهوية البصرية ملك لقرّيني وما يتستعملوش من غير إذن كتابي.",
        ],
      },
      {
        h: "11. الحصص المباشرة والأدوات الخارجية",
        p: [
          "الحصص المباشرة تنجّم تتعمل بأدوات خارجية (فيديو، سبورة، كويز). الأدوات هاذي عندها شروطها وسياسة خصوصيتها. قرّيني ما تتحكّمش فيهم وماهيش مسؤولة على توفّرهم.",
        ],
      },
      {
        h: "12. توفّر الخدمة",
        p: [
          "قرّيني تتقدّم « كيما هي ». الخدمة تنجّم تتقطع للصيانة، التحيين ولا مشكل تقني. نعملو جهدنا باش نقلّلو التقطّعات، أما بلا ضمان استمرارية.",
        ],
      },
      {
        h: "13. المسؤولية",
        p: [
          "قرّيني تربط برك؛ ماهيش اللي تعطي الدرس. في حدود ما يسمح بيه القانون التونسي، قرّيني ماهيش مسؤولة على المحتوى البيداغوجي، الجودة، السلوك ولا كلام أستاذ ولا تلميذ ولا وليّ، ولا على الأضرار غير المباشرة (ضياع وقت، عدد، ولا فرصة).",
          "ما فمّا حتى حاجة في الشروط هاذي تنفي مسؤولية قرّيني في صورة التدليس، الخطأ الجسيم، ولا المساس بالسلامة الجسدية، ولا الحقوق اللي يضمنها القانون التونسي وجوبًا للمستهلك.",
        ],
      },
      {
        h: "14. تعليق الحساب وغلقه",
        p: [
          "تنجّم تغلق حسابك وقت ما تحبّ كي تكتبلنا. ونجّمو نعلّقو ولا نغلقو حساب يخالف الشروط هاذي، ولا القانون، ولا يحطّ مستعملين آخرين في خطر.",
          "الغلق وحدو ما يلغيش الحصص المحجوزة مع مستعملين آخرين؛ باش نعملو اللازم باش نعلمو الأطراف المعنيّة.",
        ],
      },
      {
        h: "15. تغيير الشروط",
        p: [
          "الشروط هاذي تنجّم تتبدّل، بالخصوص وقت تفعيل الخلاص. النسخة المعتمدة هي اللي منشورة في الصفحة هاذي. في صورة تغيير مهمّ، باش نعلموك في التطبيق ولا بـSMS قبل ما ينطبق.",
        ],
      },
      {
        h: "16. القانون المنطبق والنزاعات",
        p: [
          "الشروط هاذي تخضع للقانون التونسي. في صورة خلاف، نبداو بالكلام: اكتبلنا ونلوّجو على حلّ ودّي. وإذا ما تفاهمناش، النزاع يرجع للمحاكم التونسية المختصّة.",
          "[يكمّلو المحامي: الشكل القانوني والتسمية الدقيقة للناشر، المقرّ الاجتماعي، المعرّف الجبائي، السجلّ الوطني للمؤسّسات، المحكمة المختصّة، وإمكانية بند وساطة استهلاكية.]",
        ],
      },
      {
        h: "17. اتصل بينا",
        p: ["عندك سؤال على الشروط هاذي: contact@9arini.tn."],
      },
    ],
    seeAlso: "شوف زادة: سياسة الخصوصية",
  },
};

export default function TermsPage() {
  const { locale } = useLocale();
  const c = copy[locale];

  return (
    <SiteShell>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section className="web-section">
        <div className="container container-narrow">
          {/* Lawyer-review banner — required until counsel signs off. */}
          <div className="lg-notice" role="note">
            <svg viewBox="0 0 24 24" className="ic" aria-hidden="true">
              <path d="M12 3.6 21 19.5H3L12 3.6z" />
              <line x1="12" y1="10" x2="12" y2="14" />
              <circle cx="12" cy="16.8" r="0.9" className="fill" />
            </svg>
            <div>
              <b>{c.notice}</b>
              <span>{c.noticeSub}</span>
            </div>
          </div>

          <header className="lg-head">
            <span className="web-eyebrow">{c.eyebrow}</span>
            <h1 className="web-h2">{c.title}</h1>
            <p className="lg-updated">{c.updated}</p>
            <p className="web-lead">{c.lead}</p>
          </header>

          <article className="panel panel-pad lg-doc">
            {c.sections.map((s) => (
              <section key={s.h}>
                <h2>{s.h}</h2>
                {s.p?.map((line) => <p key={line}>{line}</p>)}
                {s.list && (
                  <ul>
                    {s.list.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                )}
                {s.after?.map((line) => <p key={line}>{line}</p>)}
              </section>
            ))}
          </article>

          <p className="lg-seealso">
            <Link href="/privacy" className="linklike">{c.seeAlso}</Link>
          </p>
        </div>
      </section>
    </SiteShell>
  );
}
