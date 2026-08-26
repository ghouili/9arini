"use client";
/* ───────────────────────────────────────────────────────────────────────────
   /privacy — Politique de confidentialité (FR + AR).

   ⚠️  DRAFT / MODÈLE. Written by the product team, NOT by a lawyer. Must be
   reviewed by a Tunisian lawyer (and the INPDP formalities completed) before
   go-live. The dated "modèle — à faire relire par un avocat" banner at the top
   is deliberate: do not remove it until counsel has signed off and the bracketed
   placeholders (legal entity, INPDP declaration number, host, SMS provider) are
   filled in.

   Accuracy notes for whoever maintains this page — keep the copy in sync with
   the code:
   • ID documents are written to a private server directory (STORAGE_DIR, default
     `.storage/`, OUTSIDE /public) — see app/actions.ts + lib/db/schema.ts
     (verification_docs).
   • They are only ever served through app/api/admin/doc/[id]/route.ts, which
     requires a valid session whose phone is in ADMIN_PHONES, and responds with
     Cache-Control: private, no-store.
   • Retention promises below (90 days after the review decision) are a POLICY —
     they require a purge job. Don't ship this page publicly claiming automatic
     deletion until that job exists.

   Design system: SiteShell + .panel + .container-narrow. RTL-safe (logical
   properties). Page CSS prefixed `lg-`, injected via dangerouslySetInnerHTML.
   ─────────────────────────────────────────────────────────────────────────── */
import { Link } from "@/components/Link";
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
.lg-notice b{display:block;color:var(--rose700);font-size:14px;line-height:1.5}
.lg-notice span{display:block;margin-top:4px;color:var(--rose600);font-size:13px;line-height:1.6}
.lg-head{margin-bottom:24px}
.lg-head .web-h2{margin:8px 0 6px}
.lg-updated{font-size:13px;font-weight:700;color:var(--muted);margin-bottom:14px}
.lg-doc h2{font-family:var(--fd);font-size:18px;line-height:1.35;margin:30px 0 10px;color:var(--ink)}
.lg-doc h2:first-child{margin-top:0}
.lg-doc p{font-size:15px;line-height:1.75;color:var(--ink2);margin-bottom:10px}
.lg-doc ul{margin:6px 0 12px;padding-inline-start:20px;list-style:disc}
.lg-doc li{font-size:15px;line-height:1.75;color:var(--ink2);margin-bottom:6px}
.lg-seealso{margin-top:20px;font-size:14px}
`;

const copy: { fr: LegalCopy; ar: LegalCopy } = {
  fr: {
    notice: "Modèle — à faire relire par un avocat avant la mise en ligne.",
    noticeSub:
      "Version du 12 juillet 2026. Ce texte est un projet rédigé par l'équipe produit. Il ne constitue pas un conseil juridique, n'a pas encore été validé par un avocat, et les formalités auprès de l'INPDP ne sont pas encore finalisées.",
    eyebrow: "Légal",
    title: "Politique de confidentialité",
    updated: "Version du 12 juillet 2026",
    lead:
      "9arini collecte peu de données, mais certaines sont sensibles : pour être vérifiés, les profs nous envoient une pièce d'identité. Cette page explique exactement ce que nous collectons, pourquoi, qui peut le voir, combien de temps nous le gardons, et comment tu peux faire supprimer tes données.",
    sections: [
      {
        h: "1. Qui est responsable de tes données",
        p: [
          "9arini (قرّيني), plateforme tunisienne de mise en relation entre élèves et profs particuliers, est responsable du traitement des données décrites ici.",
          "Contact données personnelles : privacy@9arini.tn — c'est l'adresse à utiliser pour toute demande d'accès, de rectification ou de suppression.",
          "[À compléter par l'avocat : dénomination sociale exacte, siège social, matricule fiscal, numéro de déclaration / d'autorisation auprès de l'INPDP conformément à la loi organique n° 2004-63 du 27 juillet 2004 relative à la protection des données à caractère personnel.]",
        ],
      },
      {
        h: "2. Ce que nous collectons",
        p: ["Nous ne collectons que ce qui sert à faire fonctionner le service."],
        list: [
          "Compte : ton numéro de téléphone, ton nom, ton rôle (élève, parent/tuteur ou prof), ta langue, et ton année de naissance (uniquement pour savoir si un accord parental est nécessaire).",
          "Accord parental (élève mineur) : le nom et le téléphone du parent ou tuteur, le texte de l'accord et sa date.",
          "Page publique du prof : nom, matière, niveau, présentation, photo, années d'expérience, établissement, liens vers tes réseaux — tout ce que tu publies toi-même et qui est visible par tout le monde.",
          "Documents de vérification (profs uniquement) : pièce d'identité (CIN ou passeport, recto/verso), éventuellement un selfie et des diplômes ou attestations. Ce sont les données les plus sensibles que nous détenons.",
          "Réservations : quelles séances tu as réservées, chez quel prof, à quelle date, et leur statut.",
          "Technique : un cookie de session pour te garder connecté, les codes SMS (stockés uniquement sous forme hachée, jamais en clair) et des journaux techniques de base.",
        ],
        after: [
          "Nous ne collectons aucune donnée bancaire : les paiements ne sont pas actifs sur 9arini. Nous ne collectons pas ta géolocalisation, ni tes contacts, ni de données de santé.",
        ],
      },
      {
        h: "3. Pourquoi, et sur quelle base",
        p: ["Chaque donnée a une raison d'être précise :"],
        list: [
          "Numéro de téléphone → créer ton compte et t'identifier par code SMS (exécution du service que tu demandes).",
          "Nom et rôle → permettre au prof de savoir qui a réservé, et à l'élève de savoir avec qui il apprend.",
          "Année de naissance → déclencher l'accord parental obligatoire pour les moins de 18 ans (obligation légale et protection des mineurs).",
          "Nom et téléphone du parent → recueillir et prouver son consentement (consentement).",
          "Documents d'identité → vérifier qu'un prof est bien la personne qu'il prétend être, avant de l'exposer à des élèves, souvent mineurs (consentement du prof + intérêt légitime de sécurité de la communauté). Un prof qui refuse ne peut pas être vérifié, donc pas listé publiquement.",
          "Réservations → organiser les séances, gérer les places et la règle d'annulation à 24 h.",
          "Journaux et codes hachés → sécurité, lutte contre la fraude et les abus.",
        ],
        after: [
          "Nous n'utilisons pas tes données pour de la publicité. Nous ne les vendons pas, ne les louons pas et ne les échangeons pas.",
        ],
      },
      {
        h: "4. Qui peut voir quoi",
        p: ["C'est le point le plus important, alors soyons précis :"],
        list: [
          "Ta page publique de prof (nom, matière, bio, photo) : visible par tout le monde, c'est le but.",
          "Ton nom d'élève : visible par le prof chez qui tu as réservé, et par lui seul. Les autres élèves ne voient pas ton nom.",
          "Ton numéro de téléphone : jamais affiché publiquement.",
          "Tes documents d'identité : jamais publics, jamais partagés avec les élèves, jamais partagés avec les autres profs, jamais utilisés pour autre chose que la vérification.",
        ],
        after: [
          "Concrètement, les documents ne sont pas stockés dans le dossier public du site : ils sont écrits dans un répertoire privé du serveur, en dehors de tout ce qui est servi publiquement. Aucune adresse web publique ne permet de les ouvrir. Ils ne sont consultables qu'à travers une route protégée réservée aux administrateurs : le serveur vérifie que la session appartient à un administrateur autorisé (liste restreinte de numéros) avant d'afficher le fichier, et demande au navigateur de ne rien mettre en cache. Toute autre demande reçoit un refus.",
          "Sous-traitants : l'hébergeur du serveur et de la base de données, et le fournisseur SMS qui envoie ton code de connexion (il reçoit ton numéro et le code, rien d'autre). Ils agissent sur nos instructions et n'ont pas le droit d'utiliser tes données pour eux-mêmes. [À compléter par l'avocat : identité de l'hébergeur et du fournisseur SMS, pays d'hébergement, et — si les serveurs sont hors de Tunisie — l'autorisation de transfert requise par la loi n° 2004-63.]",
          "Nous ne communiquons des données à une autorité que si la loi tunisienne nous y oblige.",
        ],
      },
      {
        h: "5. Combien de temps nous gardons tes données",
        p: [
          "Les documents d'identité sont les données que nous gardons le moins longtemps. Ils servent à une décision, pas à constituer un fichier.",
        ],
        list: [
          "Documents d'identité et diplômes : conservés le temps de l'examen du dossier, puis supprimés au plus tard 90 jours après la décision — que le prof soit accepté ou refusé.",
          "Après suppression, il ne reste qu'une trace minimale sans le document lui-même : le type de document présenté, la date du contrôle et la décision. C'est ce qui nous permet de prouver que la vérification a bien eu lieu.",
          "Compte, profil et réservations : conservés tant que ton compte existe, puis jusqu'à 3 ans après ta dernière activité (délai lié aux éventuels litiges), puis supprimés.",
          "Codes SMS : hachés et supprimés après quelques minutes.",
          "Session de connexion : supprimée à l'expiration ou à la déconnexion.",
        ],
        after: [
          "Supprimer signifie supprimer : le fichier est effacé du disque du serveur et la ligne correspondante est effacée de la base de données. Ce n'est pas une simple mise en « archive ».",
        ],
      },
      {
        h: "6. Sécurité",
        p: [
          "Les documents sensibles sont stockés hors du dossier public et ne sont accessibles qu'à un nombre restreint d'administrateurs, via une route protégée. Les codes SMS sont hachés. Les échanges avec le site sont chiffrés (HTTPS). L'accès administrateur est limité à une liste de numéros définie côté serveur.",
          "Aucun système n'est infaillible. En cas d'incident de sécurité affectant tes données, nous t'informerons et informerons l'INPDP dans les conditions prévues par la loi.",
        ],
      },
      {
        h: "7. Tes droits",
        p: [
          "Conformément à la loi organique n° 2004-63 du 27 juillet 2004 relative à la protection des données à caractère personnel, tu disposes des droits suivants :",
        ],
        list: [
          "Accès : savoir quelles données nous détenons sur toi et en obtenir une copie.",
          "Rectification : corriger une donnée fausse ou incomplète.",
          "Suppression : demander l'effacement de tes données, y compris tes documents d'identité.",
          "Opposition : t'opposer, pour un motif légitime, à un traitement.",
          "Retrait du consentement : à tout moment, sans que cela remette en cause ce qui a été fait avant. Retirer ton consentement à la vérification signifie que ta page de prof ne peut plus être publiée.",
          "Réclamation : saisir l'Instance Nationale de Protection des Données Personnelles (INPDP) si tu estimes que tes droits ne sont pas respectés.",
        ],
        after: [
          "Pour exercer un droit, écris à privacy@9arini.tn depuis l'adresse ou le numéro associé à ton compte. Nous pouvons devoir vérifier ton identité (sans te demander de nouveaux documents inutiles). Nous répondons au plus tard dans un délai d'un mois.",
          "Pour un élève mineur, ces droits sont exercés par le parent ou le tuteur qui a donné l'accord.",
        ],
      },
      {
        h: "8. Les mineurs",
        p: [
          "9arini est utilisé par des collégiens et des lycéens. Un compte d'élève de moins de 18 ans n'est activé qu'après l'accord d'un parent ou tuteur, dont nous conservons le nom, le téléphone et la date de l'accord.",
          "Nous limitons volontairement ce que nous demandons à un mineur : téléphone, prénom/nom, année de naissance. Un mineur ne nous envoie jamais de pièce d'identité — cette obligation ne concerne que les profs.",
        ],
      },
      {
        h: "9. Cookies",
        p: [
          "Nous utilisons un seul cookie essentiel : celui qui te garde connecté après la saisie de ton code SMS. Sans lui, le site ne peut pas fonctionner.",
          "Pas de cookie publicitaire, pas de pixel de réseau social, pas de mesure d'audience tierce. Ton choix de langue est simplement gardé dans la mémoire locale de ton navigateur, sur ton appareil.",
        ],
      },
      {
        h: "10. Modifications de cette politique",
        p: [
          "Cette politique évoluera — notamment lors de l'activation des paiements, qui introduira de nouvelles données (transactions). La version applicable est celle publiée sur cette page. En cas de changement important, nous te préviendrons dans l'application ou par SMS.",
        ],
      },
      {
        h: "11. Nous contacter",
        p: [
          "Questions sur tes données, demande d'accès ou de suppression : privacy@9arini.tn.",
          "Autres questions : contact@9arini.tn.",
        ],
      },
    ],
    seeAlso: "Voir aussi : conditions d'utilisation",
  },

  ar: {
    notice: "نموذج — لازم يقراه محامي قبل ما ينشر رسميًا.",
    noticeSub:
      "نسخة 12 جويلية 2026. النصّ هذا مسودّة كتبها فريق المنتج. ما هوش استشارة قانونية، ما زال ما صادقش عليه محامي، والإجراءات مع الهيئة الوطنية لحماية المعطيات الشخصية (INPDP) ما زالت ما كمّلتش.",
    eyebrow: "قانوني",
    title: "سياسة الخصوصية",
    updated: "نسخة 12 جويلية 2026",
    lead:
      "قرّيني تجمع معطيات قليلة، أما فمّا منها حسّاسة: باش يتوثّق الأستاذ، يبعثلنا وثيقة هوية. الصفحة هاذي تشرحلك بالضبط شنوّة نجمعو، علاش، شكون ينجّم يشوفو، قدّاش نحتافظو بيه، وكيفاش تنجّم تطلب حذفو.",
    sections: [
      {
        h: "1. شكون مسؤول على معطياتك",
        p: [
          "قرّيني (9arini)، منصّة تونسية تربط التلاميذ بالأساتذة الخصوصيين، هي المسؤولة على معالجة المعطيات الموصوفة هوني.",
          "الاتصال بخصوص المعطيات الشخصية: privacy@9arini.tn — هذا هو العنوان لأيّ طلب نفاذ، تصحيح ولا حذف.",
          "[يكمّلو المحامي: التسمية الاجتماعية الدقيقة، المقرّ، المعرّف الجبائي، ورقم التصريح/الترخيص لدى الهيئة الوطنية لحماية المعطيات الشخصية (INPDP) طبقًا للقانون الأساسي عدد 63 لسنة 2004 المؤرخ في 27 جويلية 2004 المتعلّق بحماية المعطيات الشخصية.]",
        ],
      },
      {
        h: "2. شنوّة نجمعو",
        p: ["ما نجمعو كان اللي يلزم باش الخدمة تمشي."],
        list: [
          "الحساب: رقم تليفونك، اسمك، دورك (تلميذ، وليّ ولا أستاذ)، لغتك، وسنة ميلادك (كان باش نعرفو إذا لازمة موافقة وليّ).",
          "موافقة الوليّ (تلميذ قاصر): اسم الوليّ، رقم تليفونو، نصّ الموافقة وتاريخها.",
          "الصفحة العمومية متاع الأستاذ: الاسم، المادة، المستوى، التقديم، الصورة، سنوات الخبرة، المؤسسة، وروابط شبكاتك — كل شيء إنت اللي تنشرو وكل الناس تشوفو.",
          "وثائق التوثيق (الأساتذة برك): وثيقة هوية (بطاقة تعريف وطنية ولا جواز سفر، وجه وظهر)، وأحيانًا صورة سيلفي وشهائد. هاذي أكثر معطيات حسّاسة عندنا.",
          "الحجوزات: أنهي حصص حجزت، مع أنهي أستاذ، في أنهي تاريخ، وشنوّة وضعيتها.",
          "تقني: كوكي للجلسة باش تبقى داخل، رموز الـSMS (محفوظين مشفّرين بـhash برك، عمرهم ما يتحفظو واضحين)، وسجلاّت تقنية أساسية.",
        ],
        after: [
          "ما نجمعو حتى معطيات بنكية: الخلاص موش مفعّل في قرّيني. ما نجمعوش موقعك الجغرافي، لا جهات الاتصال متاعك، لا معطيات صحّية.",
        ],
      },
      {
        h: "3. علاش، وعلى أيّ أساس",
        p: ["كل معطى عندو سبب واضح:"],
        list: [
          "رقم التليفون ← نعملو حسابك ونتثبّتو منّك برمز SMS (تنفيذ الخدمة اللي طلبتها).",
          "الاسم والدور ← الأستاذ يعرف شكون حجز، والتلميذ يعرف مع شكون باش يقرا.",
          "سنة الميلاد ← نفعّلو موافقة الوليّ الإجبارية لأقلّ من 18 سنة (واجب قانوني وحماية للقاصرين).",
          "اسم ورقم الوليّ ← نجمعو موافقتو ونثبّتوها (الموافقة).",
          "وثائق الهوية ← نتثبّتو إلّي الأستاذ هو فعلاً اللي يقول، قبل ما نعرّضوه لتلاميذ، وأغلبهم قاصرين (موافقة الأستاذ + مصلحة مشروعة في سلامة المجموعة). الأستاذ اللي يرفض ما ينجّمش يتوثّق، وبالتالي ما يظهرش للعموم.",
          "الحجوزات ← تنظيم الحصص، الأماكن وقاعدة الإلغاء في 24 ساعة.",
          "السجلاّت والرموز المشفّرة ← الأمان ومقاومة الغشّ والتجاوزات.",
        ],
        after: [
          "ما نستعملوش معطياتك في الإشهار. ما نبيعوهمش، ما نكروهمش وما نبدّلوهمش.",
        ],
      },
      {
        h: "4. شكون ينجّم يشوف شنوّة",
        p: ["هاذي أهمّ نقطة، خلّينا نكونو دقيقين:"],
        list: [
          "صفحتك العمومية كأستاذ (الاسم، المادة، التقديم، الصورة): يشوفها الكلّ، هذا هو الهدف.",
          "اسمك كتلميذ: يشوفو برك الأستاذ اللي حجزت عندو. التلاميذ الآخرين ما يشوفوش اسمك.",
          "رقم تليفونك: عمرو ما يتعرض للعموم.",
          "وثائق هويتك: عمرها ما تكون عمومية، ما تتشاركش مع التلاميذ، ما تتشاركش مع الأساتذة الآخرين، وما تتستعملش في حتى حاجة أخرى غير التوثيق.",
        ],
        after: [
          "بصفة ملموسة، الوثائق ما تتحطّش في المجلّد العمومي متاع الموقع: تتكتب في مجلّد خاصّ في السيرفر، برّة كل شيء يتقدّم للعموم. ما فمّا حتى رابط عمومي ينجّم يفتحهم. ما يتشافوش كان عبر مسار محمي مخصّص للإداريين: السيرفر يتثبّت إلّي الجلسة تخصّ إداري مرخّص (قائمة محدودة من الأرقام) قبل ما يعرض الملفّ، ويطلب من المتصفّح ما يخزّن حتى شيء. أيّ طلب آخر يترفض.",
          "المناولين: مستضيف السيرفر وقاعدة البيانات، ومزوّد الـSMS اللي يبعثلك رمز الدخول (ياخذ رقمك والرمز، وخلاص). يخدمو بتعليماتنا وما عندهمش الحقّ يستعملو معطياتك لروحهم. [يكمّلو المحامي: هوية المستضيف ومزوّد الـSMS، بلاد الاستضافة، وإذا كانت السيرفرات برّة تونس، الترخيص بالإحالة اللي يستوجبو القانون عدد 63 لسنة 2004.]",
          "ما نعطيوش معطيات لسلطة كان إذا القانون التونسي يلزمنا.",
        ],
      },
      {
        h: "5. قدّاش نحتافظو بمعطياتك",
        p: [
          "وثائق الهوية هي المعطيات اللي نحتافظو بيها أقلّ وقت. تخدم في قرار، موش باش نعملو بيها أرشيف.",
        ],
        list: [
          "وثائق الهوية والشهائد: نحتافظو بيهم وقت دراسة الملفّ برك، ومن بعد يتحذفو في أجل أقصاه 90 يوم بعد القرار — سواء الأستاذ تقبل ولا تنرفض.",
          "بعد الحذف، ما يبقى كان أثر بسيط بلا الملفّ روحو: نوع الوثيقة اللي تقدّمت، تاريخ التثبّت، والقرار. هذا اللي يخلّينا نثبّتو إلّي التوثيق صار فعلاً.",
          "الحساب، الملفّ الشخصي والحجوزات: نحتافظو بيهم طول ما حسابك موجود، ومن بعد حتى لـ3 سنين من آخر نشاط (أجل مرتبط بالنزاعات المحتملة)، ومن بعد يتحذفو.",
          "رموز الـSMS: مشفّرة ويتحذفو بعد دقائق.",
          "جلسة الدخول: تتحذف كي تنتهي صلوحيتها ولا كي تخرج.",
        ],
        after: [
          "الحذف يعني الحذف: الملفّ يتمسح من قرص السيرفر والسطر يتمسح من قاعدة البيانات. موش برك يتحطّ في « أرشيف ».",
        ],
      },
      {
        h: "6. الأمان",
        p: [
          "الوثائق الحسّاسة تتخزّن برّة المجلّد العمومي وما ينجّم يوصلّها كان عدد محدود من الإداريين عبر مسار محمي. رموز الـSMS مشفّرة. الاتّصال بالموقع مشفّر (HTTPS). النفاذ الإداري محدود بقائمة أرقام معرّفة في السيرفر.",
          "ما فمّا نظام كامل. إذا صار حادث أمني يمسّ معطياتك، باش نعلموك ونعلمو الـINPDP كيما يستوجبو القانون.",
        ],
      },
      {
        h: "7. حقوقك",
        p: [
          "طبقًا للقانون الأساسي عدد 63 لسنة 2004 المؤرّخ في 27 جويلية 2004 المتعلّق بحماية المعطيات الشخصية، عندك الحقوق هاذي:",
        ],
        list: [
          "النفاذ: تعرف شنوّة معطيات عندنا عليك وتاخذ نسخة منها.",
          "التصحيح: تصلّح معطى غالط ولا ناقص.",
          "الحذف: تطلب مسح معطياتك، بما فيها وثائق هويتك.",
          "الاعتراض: تعترض، لسبب مشروع، على معالجة.",
          "سحب الموافقة: وقت ما تحبّ، بلا ما يمسّ هذا اللي صار قبل. سحب موافقتك على التوثيق معناها صفحتك كأستاذ ما تبقاش منشورة.",
          "الشكاية: ترفع شكاية للهيئة الوطنية لحماية المعطيات الشخصية (INPDP) إذا شفت إلّي حقوقك ما تحترمتش.",
        ],
        after: [
          "باش تمارس حقّ، اكتب لـprivacy@9arini.tn من الرقم ولا العنوان المرتبط بحسابك. نجّمو نحتاجو نتثبّتو في هويتك (بلا ما نطلبو منّك وثائق جديدة بلا فايدة). نجاوبوك في أجل أقصاه شهر.",
          "للتلميذ القاصر، الحقوق هاذي يمارسها الوليّ اللي أعطى الموافقة.",
        ],
      },
      {
        h: "8. القاصرين",
        p: [
          "قرّيني يستعملوها تلاميذ إعدادي وثانوي. حساب تلميذ أقلّ من 18 سنة ما يتفعّلش كان بعد موافقة وليّ، ونحتافظو باسمو، رقمو وتاريخ الموافقة.",
          "نقلّلو بإرادتنا في اللي نطلبوه من القاصر: تليفون، اسم ولقب، سنة ميلاد. القاصر عمرو ما يبعثلنا وثيقة هوية — الواجب هذا يخصّ الأساتذة برك.",
        ],
      },
      {
        h: "9. الكوكيز",
        p: [
          "نستعملو كوكي وحيد وضروري: هو اللي يخلّيك داخل بعد ما تعمّر رمز الـSMS. من غيرو الموقع ما يخدمش.",
          "ما فمّا كوكي إشهاري، ما فمّا بيكسل شبكات اجتماعية، ما فمّاش قياس جمهور خارجي. اختيار اللغة يتحفظ برك في الذاكرة المحلية متاع متصفّحك، في جهازك.",
        ],
      },
      {
        h: "10. تغيير السياسة هاذي",
        p: [
          "السياسة هاذي باش تتطوّر — بالخصوص وقت تفعيل الخلاص، اللي باش يزيد معطيات جديدة (المعاملات). النسخة المعتمدة هي اللي منشورة في الصفحة هاذي. في صورة تغيير مهمّ، باش نعلموك في التطبيق ولا بـSMS.",
        ],
      },
      {
        h: "11. اتصل بينا",
        p: [
          "أسئلة على معطياتك، طلب نفاذ ولا حذف: privacy@9arini.tn.",
          "أسئلة أخرى: contact@9arini.tn.",
        ],
      },
    ],
    seeAlso: "شوف زادة: شروط الاستعمال",
  },
};

export default function PrivacyPage() {
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
            <Link href="/terms" className="linklike">{c.seeAlso}</Link>
          </p>
        </div>
      </section>
    </SiteShell>
  );
}
