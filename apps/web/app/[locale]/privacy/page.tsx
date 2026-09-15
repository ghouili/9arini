"use client";
/* ───────────────────────────────────────────────────────────────────────────
   /privacy — Politique de confidentialité (FR + AR).

   ⚠️  DRAFT / MODÈLE. Written by the product team, NOT by a lawyer. Must be
   reviewed by a Tunisian lawyer (and the INPDP formalities completed) before
   go-live. The dated "modèle — à faire relire par un avocat" banner at the top
   is deliberate: do not remove it until counsel has signed off and the bracketed
   placeholders (legal entity, INPDP declaration number, host, e-mail provider) are
   filled in.

   EVERY SENTENCE HERE DESCRIBES WHAT IS IMPLEMENTED (production readiness Stage 5,
   rewritten 15 Sept 2026). The numbers come from @tnajem/shared/legal; bracketed
   passages are open questions for counsel, listed with LEGAL-REVIEW markers there.
   Deletion: packages/db/src/erasure.ts. Retention: packages/db/src/retention.ts.
   Consent: apps/api/src/routes/misc.ts + guardian.ts. Reports: moderation.ts.

   Accuracy notes for whoever maintains this page — keep the copy in sync with
   the code:
   • ID documents are SEALED (AES-256-GCM, packages/db/src/doc-crypto.ts) and written
     to the object store (STORAGE_DRIVER: a private directory or a private bucket) by
     apps/api — see apps/api/src/routes/admin.ts (POST /verification). apps/web never
     touches them.
   • They are only ever served through app/api/admin/doc/[id]/route.ts, which is a
     STREAMING PASS-THROUGH that makes no access decision of its own: apps/api
     decides, using the ADMIN_EMAILS allow-list (packages/shared/src/admin.ts).
     Not ADMIN_PHONES — login is e-mail OTP and most admin profiles have no phone
     at all. The link is signed, admin-bound and short-lived (apps/api/src/lib/doc-links.ts),
     the document downloads, and every read is audited before a byte is sent.
   • Retention promises below (90 days after the review decision) are a POLICY, and
     the job that keeps it is apps/api/src/routes/cron.ts (GET/POST /cron/purge,
     bearer CRON_SECRET). If that job stops being scheduled, this page starts
     lying — treat a silent purge as a legal problem, not an ops one.

   Design system: SiteShell + .panel + .container-narrow. RTL-safe (logical
   properties). Page CSS prefixed `lg-`, injected via dangerouslySetInnerHTML.
   ─────────────────────────────────────────────────────────────────────────── */
import { Link } from "@/components/Link";
import { SiteShell } from "@/components/SiteShell";
import { useLocale } from "@/components/LocaleProvider";
import {
  DELETION_GRACE_DAYS, ID_DOCUMENT_RETENTION_DAYS, INACTIVE_ACCOUNT_RETENTION_DAYS, MINOR_AGE_YEARS, PRIVACY_CONTACT_EMAIL,
  PRIVACY_POLICY_VERSION, SESSION_DAYS, SESSION_IDLE_DAYS, formatLongDate,
} from "@tnajem/shared";

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

/* The numbers in this text come from @tnajem/shared/legal, so the page cannot
   quote a period the code does not enforce. The version date is the policy version. */
const YEARS_INACTIVE = Math.round(INACTIVE_ACCOUNT_RETENTION_DAYS / 365);
const versionDate = (locale: "fr" | "ar") => formatLongDate(`${PRIVACY_POLICY_VERSION}T12:00:00Z`, locale);

const copy: { fr: LegalCopy; ar: LegalCopy } = {
  fr: {
    notice: "Modèle — à faire relire par un avocat avant la mise en ligne.",
    noticeSub:
      `Version du ${versionDate("fr")}. Ce texte est un projet rédigé par l'équipe produit. Il décrit ce que le service fait réellement à cette date, mais il ne constitue pas un conseil juridique, n'a pas encore été validé par un avocat, et les formalités auprès de l'INPDP ne sont pas encore finalisées. Les passages entre crochets restent à compléter par l'avocat.`,
    eyebrow: "Légal",
    title: "Politique de confidentialité",
    updated: `Version du ${versionDate("fr")}`,
    lead:
      "Tnajem collecte peu de données, mais certaines sont sensibles : pour être vérifiés, les profs nous envoient une pièce d'identité, et beaucoup d'élèves sont mineurs. Cette page explique exactement ce que nous collectons, pourquoi, qui peut le voir, combien de temps nous le gardons, et comment tu peux faire supprimer tes données.",
    sections: [
      {
        h: "1. Qui est responsable de tes données",
        p: [
          "Tnajem (تنجّم), plateforme tunisienne de mise en relation entre élèves et profs particuliers, est responsable du traitement des données décrites ici.",
          `Contact données personnelles : ${PRIVACY_CONTACT_EMAIL} — c'est l'adresse à utiliser pour toute demande d'accès, de rectification ou de suppression.`,
          "[À compléter par l'avocat : dénomination sociale exacte, siège social, matricule fiscal, numéro de déclaration / d'autorisation auprès de l'INPDP conformément à la loi organique n° 2004-63 du 27 juillet 2004 relative à la protection des données à caractère personnel.]",
        ],
      },
      {
        h: "2. Ce que nous collectons",
        p: ["Nous ne collectons que ce qui sert à faire fonctionner le service."],
        list: [
          "Compte : ton adresse e-mail (c'est avec elle que tu te connectes), ton nom, ton rôle (élève, parent/tuteur ou prof), ta langue, ton année de naissance (uniquement pour savoir si un accord parental est nécessaire), la version des conditions d'utilisation en vigueur quand tu as créé ton compte, et la date de ta dernière visite (pour appliquer la durée de conservation de la section 5). Ton numéro de téléphone est facultatif : il sert à te joindre, jamais à te connecter.",
          "Accord parental (élève mineur) : le nom, le téléphone et l'adresse e-mail du parent ou tuteur, le texte de l'accord, la version de cette politique sous laquelle il a été donné, sa date et, s'il est retiré, la date du retrait.",
          "Page publique du prof : nom, matière, niveau, présentation, photo, années d'expérience, établissement, liens vers tes réseaux — tout ce que tu publies toi-même et qui est visible par tout le monde.",
          "Dossier de vérification (profs uniquement) : pièce d'identité (CIN ou passeport, recto/verso), éventuellement un selfie et des diplômes ou attestations, et ta déclaration de ne pas enseigner dans un établissement public, avec sa date. Les documents d'identité sont les données les plus sensibles que nous détenons.",
          "Réservations : quelles séances tu as réservées, chez quel prof, à quelle date, et leur statut.",
          "Messages et signalements : les messages échangés dans la conversation d'une séance, et les signalements que tu nous envoies (avec ton adresse e-mail seulement si tu choisis de la donner).",
          "Technique : un cookie de session pour te garder connecté (le serveur n'en garde qu'une empreinte, jamais le jeton lui-même), les codes de connexion (stockés uniquement sous forme hachée) et des journaux techniques qui ne contiennent ni ton adresse e-mail ni ton numéro.",
        ],
        after: [
          "Nous ne collectons aucune donnée bancaire : les paiements ne sont pas actifs sur Tnajem. Nous ne collectons pas ta géolocalisation, ni tes contacts, ni de données de santé.",
        ],
      },
      {
        h: "3. Pourquoi, et sur quelle base",
        p: [
          "Chaque donnée a une raison d'être précise.",
          "[À compléter par l'avocat : la base légale de chaque traitement au sens de la loi n° 2004-63. Celles indiquées entre parenthèses sont des propositions de l'équipe produit.]",
        ],
        list: [
          "Adresse e-mail → créer ton compte et t'identifier par un code à usage unique (exécution du service que tu demandes). Numéro de téléphone, si tu le donnes → te joindre au sujet d'une séance, rien d'autre.",
          "Nom et rôle → permettre au prof de savoir qui a réservé, et à l'élève de savoir avec qui il apprend.",
          `Année de naissance → exiger l'accord d'un parent ou tuteur avant toute réservation d'un élève de moins de ${MINOR_AGE_YEARS} ans (obligation légale et protection des mineurs). Une année inconnue compte comme mineur.`,
          "Nom et téléphone du parent → recueillir et prouver son consentement (consentement).",
          "E-mail du parent → créer son compte parent et le relier à son enfant. Avec ce compte, le parent voit les séances réservées et peut LIRE les conversations de son enfant — l'enfant en est informé sur chaque conversation. Le parent ne peut ni écrire ni réserver à sa place, et les coordonnées des profs ne lui sont jamais communiquées. Il peut en revanche retirer son accord depuis son espace parent : son enfant ne peut alors plus réserver, et ses séances à venir sont annulées sans frais. Lui seul peut redonner cet accord.",
          `Suppression de ton compte → tu peux la demander depuis « Mon compte ». Ce n'est pas possible tant que tu as une séance à venir : annule-la d'abord. Nous te laissons ${DELETION_GRACE_DAYS} jours pour changer d'avis, et tes autres appareils sont déconnectés tout de suite. Ensuite, ton compte est anonymisé : ton nom, ton e-mail, ton téléphone et ton année de naissance sont effacés, tu es déconnecté partout, les messages que tu as écrits sont supprimés et ton nom est retiré des notifications des autres. Si tu es prof, ta page est retirée, son adresse ne peut plus être reprise par quelqu'un d'autre, et tes pièces d'identité, tes documents partagés et ta photo sont effacés du stockage. Ce qui reste ne permet pas de te reconnaître : la trace des places réservées (pour l'historique du prof et le registre des annulations), tes avis sans ton nom, les signalements, et un message que quelqu'un a signalé, gardé comme preuve. [À valider par l'avocat : la conservation des messages signalés après la suppression d'un compte.]`,
          "Documents d'identité → vérifier qu'un prof est bien la personne qu'il prétend être, avant de l'exposer à des élèves, souvent mineurs (consentement du prof + intérêt légitime de sécurité de la communauté). Un prof qui refuse ne peut pas être vérifié, donc pas listé publiquement.",
          "Déclaration de ne pas enseigner dans le public → respecter le décret n° 2015-1619 : Tnajem ne met pas en avant un enseignant en exercice dans un établissement public. Sans cette déclaration, un dossier de vérification ne peut pas être envoyé, et l'administrateur la compare à l'établissement indiqué.",
          "Réservations → organiser les séances, gérer les places, la règle d'annulation à 48 h et le registre des annulations.",
          "Messages échangés dans la conversation d'une séance → permettre à un prof et un élève de se parler sans échanger de coordonnées. Personne chez Tnajem ne lit une conversation, sauf un message signalé, qui arrive avec son texte dans la file de modération. Les coordonnées (numéro, email, lien) en sont retirées automatiquement avant enregistrement — nous conservons le TYPE de ce qui a été détecté, jamais le texte détecté. Quand une réservation est annulée, la conversation reste lisible mais on ne peut plus y écrire.",
          "Signalements → protéger les utilisateurs, en particulier les mineurs. Chacun peut signaler la page d'un prof, une séance, un document ou un message, sans compte ; l'adresse e-mail est facultative. Un signalement ne retire rien automatiquement : une personne de l'équipe le lit et décide. Un ayant droit peut demander le retrait d'un document par le même bouton.",
          "Documents et vidéos partagés par un prof → permettre à ses élèves d'y accéder. Les fichiers sont stockés hors du web public et ne sont servis qu'après vérification de tes droits (public, élève inscrit, ou le prof lui-même) — jamais par une adresse devinable. Une vidéo n'est pas hébergée ici : nous n'enregistrons que son identifiant YouTube et l'affichons sans cookie de suivi.",
          `Photo de profil d'un prof → mettre un visage sur sa page. Elle est vérifiée par une personne avant d'être visible. Nous ne conservons PAS le fichier d'origine : la photo est réencodée en trois tailles et toutes ses données cachées sont effacées, y compris la localisation GPS que ton téléphone y inscrit. Les moins de ${MINOR_AGE_YEARS} ans n'ont jamais de photo, seulement leurs initiales.`,
          "Journaux, codes hachés et limites de fréquence → sécurité, lutte contre la fraude et les abus. Une limite liée à une adresse e-mail n'en garde qu'une empreinte.",
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
          "Ton prénom d'élève : visible par le prof chez qui tu as réservé, et par lui seul. Les autres élèves ne voient pas ton nom.",
          "Pour un élève mineur : son parent ou tuteur lié voit ses séances à venir et lit ses conversations.",
          "Ton numéro de téléphone : jamais affiché publiquement, jamais montré à un prof ou à un élève.",
          "Tes documents d'identité : jamais publics, jamais partagés avec les élèves, jamais partagés avec les autres profs, jamais utilisés pour autre chose que la vérification.",
        ],
        after: [
          "Concrètement, les documents d'identité sont chiffrés avant d'être enregistrés, en dehors de tout ce qui est servi publiquement : un fichier copié depuis le disque ou une sauvegarde est illisible sans la clé. Aucune adresse web ne permet de les ouvrir. Un administrateur autorisé (liste restreinte d'adresses e-mail définie côté serveur) reçoit, pour chaque document, un lien valable quelques minutes et utilisable par lui seul. Le document est téléchargé, jamais mis en cache, et chaque consultation est enregistrée — qui, quand — avant l'envoi du fichier.",
          "Sous-traitants : l'hébergeur du serveur et de la base de données, le service de stockage des fichiers s'il est externe, et le fournisseur d'e-mail qui envoie ton code de connexion (il reçoit ton adresse et le code, rien d'autre). Ils agissent sur nos instructions et n'ont pas le droit d'utiliser tes données pour eux-mêmes. [À compléter par l'avocat : identité de ces prestataires, pays d'hébergement, et — si les serveurs sont hors de Tunisie — l'autorisation de transfert requise par la loi n° 2004-63.]",
          "Nous ne communiquons des données à une autorité que si la loi tunisienne nous y oblige.",
        ],
      },
      {
        h: "5. Combien de temps nous gardons tes données",
        p: [
          "Les documents d'identité sont les données que nous gardons le moins longtemps. Ils servent à une décision, pas à constituer un fichier.",
        ],
        list: [
          `Documents d'identité et diplômes : conservés le temps de l'examen du dossier, puis supprimés au plus tard ${ID_DOCUMENT_RETENTION_DAYS} jours après la décision — que le prof soit accepté ou refusé — ou dès la suppression du compte. [À compléter par l'avocat : durée maximale pour un dossier qui n'a jamais reçu de décision.]`,
          "Après suppression, il ne reste qu'une trace minimale sans le document lui-même : le type de document présenté, sa date d'envoi, la décision et sa date. C'est ce qui nous permet de prouver que la vérification a bien eu lieu. [Durée de conservation de cette trace à fixer par l'avocat.]",
          `Compte et profil : conservés tant que tu utilises ton compte. Un compte inutilisé pendant ${YEARS_INACTIVE} ans est supprimé comme si tu l'avais demandé (section 3). Aucun e-mail de rappel n'est envoyé avant. [À valider par l'avocat : cette durée, et l'obligation éventuelle de prévenir.]`,
          "Réservations et registre des annulations : conservés, et anonymisés quand le compte est supprimé. [Durée à fixer par l'avocat.]",
          "Messages : conservés tant que les deux comptes existent ; ceux d'un compte supprimé sont supprimés, sauf un message signalé. [Durée à fixer par l'avocat.]",
          "Signalements et journal des actions des administrateurs : conservés. [Durée à fixer par l'avocat.]",
          "Codes de connexion : hachés, inutilisables au bout de quelques minutes, puis supprimés.",
          `Session de connexion : elle se termine ${SESSION_DAYS} jours après la connexion, après ${SESSION_IDLE_DAYS} jours sans utilisation, ou quand tu te déconnectes — y compris avec « Se déconnecter de tous les appareils ».`,
        ],
        after: [
          "Supprimer signifie supprimer : le fichier est effacé du stockage et la ligne correspondante est effacée de la base de données. Ce n'est pas une simple mise en « archive ».",
          "Les sauvegardes de la base de données et des fichiers contiennent encore les données effacées jusqu'à ce qu'elles-mêmes soient supprimées. [Durée de conservation des sauvegardes à fixer par l'avocat.]",
        ],
      },
      {
        h: "6. Sécurité",
        p: [
          "Les documents d'identité sont chiffrés et ne sont accessibles qu'à des administrateurs désignés, par un lien personnel et temporaire ; chaque consultation est enregistrée. Les codes de connexion et les jetons de session sont stockés sous forme d'empreinte. Les échanges avec le site sont chiffrés (HTTPS). L'accès administrateur est limité à une liste d'adresses e-mail définie côté serveur.",
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
          "Suppression : demander l'effacement de tes données, directement depuis « Mon compte » (section 3), y compris tes documents d'identité.",
          "Opposition : t'opposer, pour un motif légitime, à un traitement.",
          "Retrait du consentement : à tout moment, sans que cela remette en cause ce qui a été fait avant. Pour un élève mineur, le parent retire son accord depuis son espace parent. Retirer ton consentement à la vérification (en supprimant ton compte ou en nous écrivant) signifie que ta page de prof ne peut plus être publiée.",
          "Réclamation : saisir l'Instance Nationale de Protection des Données Personnelles (INPDP) si tu estimes que tes droits ne sont pas respectés.",
        ],
        after: [
          `Pour exercer un autre droit, écris à ${PRIVACY_CONTACT_EMAIL} depuis l'adresse associée à ton compte. Nous pouvons devoir vérifier ton identité (sans te demander de nouveaux documents inutiles). Nous répondons au plus tard dans un délai d'un mois. [Délai à confirmer par l'avocat.]`,
          "Pour un élève mineur, ces droits sont exercés par le parent ou le tuteur qui a donné l'accord.",
        ],
      },
      {
        h: "8. Les mineurs",
        p: [
          `Tnajem est utilisé par des collégiens et des lycéens. Un élève de moins de ${MINOR_AGE_YEARS} ans ne peut réserver aucune séance sans l'accord d'un parent ou tuteur, dont nous conservons le nom, le téléphone, l'adresse e-mail, la version de cette politique et la date de l'accord. L'accord est saisi par l'élève au nom de son parent ; le parent le voit, et peut le retirer ou le redonner, depuis son propre compte. [À valider par l'avocat : un accord saisi par l'élève, sans vérification de l'identité du parent.]`,
          "Nous limitons volontairement ce que nous demandons à un mineur : une adresse e-mail, un nom, une année de naissance, et un téléphone facultatif. Un mineur ne nous envoie jamais de pièce d'identité — cette obligation ne concerne que les profs — et n'a jamais de photo.",
        ],
      },
      {
        h: "9. Cookies",
        p: [
          "Nous utilisons trois cookies, et aucun ne sert à te suivre : un cookie de session, indispensable, qui te garde connecté après la saisie de ton code ; un cookie qui retient ton rôle pour afficher le bon menu (il ne donne accès à rien) ; et un cookie qui retient la langue que tu as choisie.",
          "Pas de cookie publicitaire, pas de pixel de réseau social, pas de mesure d'audience tierce. Une vidéo YouTube n'est chargée que si tu la lances, depuis le domaine sans cookie de YouTube.",
        ],
      },
      {
        h: "10. Modifications de cette politique",
        p: [
          "Cette politique évoluera — notamment lors de l'activation des paiements, qui introduira de nouvelles données (transactions). La version applicable est celle publiée sur cette page ; la version sous laquelle un accord parental a été donné est enregistrée avec lui. [À compléter par l'avocat : comment les utilisateurs sont informés d'un changement important, et si un nouvel accord est nécessaire.]",
        ],
      },
      {
        h: "11. Nous contacter",
        p: [
          `Questions sur tes données, demande d'accès : ${PRIVACY_CONTACT_EMAIL}.`,
          "Autres questions : contact@tnajem.tn.",
        ],
      },
    ],
    seeAlso: "Voir aussi : conditions d'utilisation",
  },

  ar: {
    notice: "نموذج — لازم يقراه محامي قبل ما ينشر رسميًا.",
    noticeSub:
      `نسخة ${versionDate("ar")}. النصّ هذا مسودّة كتبها فريق المنتج. يوصف شنوّة تعمل الخدمة فعلاً في التاريخ هذا، أما ما هوش استشارة قانونية، ما زال ما صادقش عليه محامي، والإجراءات مع الهيئة الوطنية لحماية المعطيات الشخصية (INPDP) ما زالت ما كمّلتش. اللي بين معقّفات يكمّلو المحامي.`,
    eyebrow: "قانوني",
    title: "سياسة الخصوصية",
    updated: `نسخة ${versionDate("ar")}`,
    lead:
      "تنجّم تجمع معطيات قليلة، أما فمّا منها حسّاسة: باش يتوثّق الأستاذ، يبعثلنا وثيقة هوية، وبرشا تلامذة قاصرين. الصفحة هاذي تشرحلك بالضبط شنوّة نجمعو، علاش، شكون ينجّم يشوفو، قدّاش نحتافظو بيه، وكيفاش تنجّم تطلب حذفو.",
    sections: [
      {
        h: "1. شكون مسؤول على معطياتك",
        p: [
          "تنجّم (Tnajem)، منصّة تونسية تربط التلاميذ بالأساتذة الخصوصيين، هي المسؤولة على معالجة المعطيات الموصوفة هوني.",
          `الاتصال بخصوص المعطيات الشخصية: ${PRIVACY_CONTACT_EMAIL} — هذا هو العنوان لأيّ طلب نفاذ، تصحيح ولا حذف.`,
          "[يكمّلو المحامي: التسمية الاجتماعية الدقيقة، المقرّ، المعرّف الجبائي، ورقم التصريح/الترخيص لدى الهيئة الوطنية لحماية المعطيات الشخصية (INPDP) طبقًا للقانون الأساسي عدد 63 لسنة 2004 المؤرخ في 27 جويلية 2004 المتعلّق بحماية المعطيات الشخصية.]",
        ],
      },
      {
        h: "2. شنوّة نجمعو",
        p: ["ما نجمعو كان اللي يلزم باش الخدمة تمشي."],
        list: [
          "الحساب: الإيميل متاعك (بيه تدخل)، اسمك، دورك (تلميذ، وليّ ولا أستاذ)، لغتك، سنة ميلادك (كان باش نعرفو إذا لازمة موافقة وليّ)، نسخة شروط الاستعمال اللي كانت معمول بيها وقت عملت حسابك، وتاريخ آخر زيارة (باش نطبّقو مدّة الاحتفاظ متاع الفصل 5). رقم التليفون اختياري: يخدم باش نلقاوك، وعمرو ما يخدم للدخول.",
          "موافقة الوليّ (تلميذ قاصر): اسم الوليّ، تليفونو والإيميل متاعو، نصّ الموافقة، نسخة السياسة هاذي اللي تعطات تحتها، تاريخها، وكان تسحبت، تاريخ السحب.",
          "الصفحة العمومية متاع الأستاذ: الاسم، المادة، المستوى، التقديم، الصورة، سنوات الخبرة، المؤسسة، وروابط شبكاتك — كل شيء إنت اللي تنشرو وكل الناس تشوفو.",
          "ملف التوثيق (الأساتذة برك): وثيقة هوية (بطاقة تعريف وطنية ولا جواز سفر، وجه وظهر)، وأحيانًا صورة سيلفي وشهائد، وتصريحك إنّك ما تقرّيش في مؤسسة عمومية، مع تاريخو. وثائق الهوية هاذي أكثر معطيات حسّاسة عندنا.",
          "الحجوزات: أنهي حصص حجزت، مع أنهي أستاذ، في أنهي تاريخ، وشنوّة وضعيتها.",
          "الرسائل والتبليغات: الرسائل في محادثة الحصة، والتبليغات اللي تبعثهملنا (مع الإيميل متاعك كان تحب تعطيه برك).",
          "تقني: كوكي للجلسة باش تبقى داخل (السيرفر ما يحتفظ كان ببصمة منّو، عمرو ما يحتفظ بالرمز روحو)، رموز الدخول (محفوظين مشفّرين بـhash برك)، وسجلاّت تقنية ما فيهاش لا الإيميل متاعك لا نمرتك.",
        ],
        after: [
          "ما نجمعو حتى معطيات بنكية: الخلاص موش مفعّل في تنجّم. ما نجمعوش موقعك الجغرافي، لا جهات الاتصال متاعك، لا معطيات صحّية.",
        ],
      },
      {
        h: "3. علاش، وعلى أيّ أساس",
        p: [
          "كل معطى عندو سبب واضح.",
          "[يكمّلو المحامي: الأساس القانوني متاع كل معالجة حسب القانون عدد 63 لسنة 2004. اللي مكتوب بين قوسين اقتراحات من فريق المنتج.]",
        ],
        list: [
          "الإيميل ← نعملو حسابك ونتثبّتو منّك برمز وحيد (تنفيذ الخدمة اللي طلبتها). رقم التليفون، إذا عطيتو ← باش نلقاوك على خاطر حصّة، وخلاص.",
          "الاسم والدور ← الأستاذ يعرف شكون حجز، والتلميذ يعرف مع شكون باش يقرا.",
          `سنة الميلاد ← نطلبو موافقة الوليّ قبل أيّ حجز لتلميذ عمرو أقلّ من ${MINOR_AGE_YEARS} سنة (واجب قانوني وحماية للقاصرين). سنة ميلاد مجهولة تتحسب قاصر.`,
          "اسم ورقم الوليّ ← نجمعو موافقتو ونثبّتوها (الموافقة).",
          "إيميل الولي ← باش يتعمل حسابو ويترابط بولدو. بالحساب هذا الولي يشوف الحصص المحجوزة ويقرا محادثات ولدو — والولد يتعلم بيها في كل محادثة. الولي ما ينجّمش يكتب ولا يحجز في بلاصتو، ومعلومات الاتصال متاع الأساتذة عمرها ما تتعطالو. أما ينجّم يسحب موافقتو من فضاء الولي: ولدو ما عادش ينجّم يحجز، والحصص الجاية متاعو تتلغى بلا مصاريف. هو برك ينجّم يرجّع الموافقة هاذي.",
          `مسح حسابك ← تنجّم تطلبو من « حسابي ». ما ينجّمش يصير ما دام عندك حصة جاية: ألغيها الأول. نخلّيولك ${DELETION_GRACE_DAYS} يوم باش تبدّل رايك، والأجهزة الأخرى تخرج من توّا. من بعد، حسابك يولّي مجهول: إسمك، الإيميل، التليفون وسنة ميلادك يتمسحو، تخرج من الأجهزة الكل، الرسائل اللي كتبتهم يتمسحو، وإسمك يتنحّى من إشعارات الناس الأخرى. كان إنت أستاذ، صفحتك تتنحّى، عنوانها ما عادش ينجّم ياخذو حد آخر، ووثائق هويتك، الملفات اللي شاركتهم وتصويرتك يتمسحو من التخزين. اللي يبقى ما يعرّفش بيك: أثر البلايص المحجوزة (لتاريخ الأستاذ وسجل الإلغاءات)، التقييمات متاعك بلا إسمك، التبليغات، ورسالة بلّغ عليها حد، تتحفظ كدليل. [يثبّت المحامي: الاحتفاظ بالرسائل المبلّغ عليها بعد مسح الحساب.]`,
          "وثائق الهوية ← نتثبّتو إلّي الأستاذ هو فعلاً اللي يقول، قبل ما نعرّضوه لتلاميذ، وأغلبهم قاصرين (موافقة الأستاذ + مصلحة مشروعة في سلامة المجموعة). الأستاذ اللي يرفض ما ينجّمش يتوثّق، وبالتالي ما يظهرش للعموم.",
          "التصريح إنّك ما تقرّيش في العمومي ← نحترمو الأمر عدد 1619 لسنة 2015: تنجّم ما تعرضش أستاذ يخدم في مؤسسة تعليم عمومية. من غير التصريح هذا، ملف التوثيق ما يتبعثش، والإداري يقارنو بالمؤسسة المذكورة.",
          "الحجوزات ← تنظيم الحصص، الأماكن، قاعدة الإلغاء في 48 ساعة وسجل الإلغاءات.",
          "الرسائل في محادثة الحصة ← باش الأستاذ والتلميذ يتكلّمو بلا ما يتبادلو معلومات اتصال. حتى حد في Tnajem ما يقرا محادثة، كان رسالة مبلّغ عليها، توصل بنصّها لليستة المراقبة. معلومات الاتصال (نمرة، إيميل، رابط) تتنحّى آليًا قبل التسجيل — نحتفظو بنوع اللي تلقى، عمرنا ما نحتفظو بالنصّ. كي يتلغى الحجز، المحادثة تبقى تتقرا أما ما عادش ينجّم حد يكتب فيها.",
          "التبليغات ← نحميو المستعملين، بالخصوص القاصرين. كل واحد ينجّم يبلّغ على صفحة أستاذ، حصة، وثيقة ولا رسالة، بلا حساب؛ الإيميل اختياري. التبليغ ما ينحّي حتى شي آليًا: واحد من الفريق يقراه ويقرّر. صاحب الحقوق ينجّم يطلب نحّي وثيقة بنفس الزرّ.",
          "الوثائق والفيديوهات اللي ينشرهم الأستاذ ← باش تلامذتو يوصلولهم. الملفات تتخزّن برّة الويب العمومي وما تتقدّمش كان بعد ما نتثبّتو من حقّك (عمومي، تلميذ مسجّل، ولا الأستاذ روحو) — عمرها ما تكون بعنوان يتحزّر. الفيديو ما هوش مستضاف عندنا: نسجّلو برك المعرّف متاعو في يوتيوب ونعرضوه بلا كوكي تتبّع.",
          `تصويرة الأستاذ ← باش يكون فمّا وجه في صفحتو. تتشاف من طرف إنسان قبل ما تظهر. ما نحتفظوش بالملف الأصلي: التصويرة تتعاود ترمّز في ثلاث أحجام وتتمسح المعطيات المخبّية الكل، ومنها موقع الـGPS اللي يكتبو تليفونك. اللي عمرو أقلّ من ${MINOR_AGE_YEARS} سنة عمرو ما تكون عندو تصويرة، برك الحروف الأولى.`,
          "السجلاّت، الرموز المشفّرة وحدود التكرار ← الأمان ومقاومة الغشّ والتجاوزات. الحدّ المربوط بإيميل ما يحتفظ كان ببصمة منّو.",
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
          "إسمك الأوّل كتلميذ: يشوفو برك الأستاذ اللي حجزت عندو. التلاميذ الآخرين ما يشوفوش اسمك.",
          "للتلميذ القاصر: الوليّ المربوط بيه يشوف الحصص الجاية متاعو ويقرا محادثاتو.",
          "رقم تليفونك: عمرو ما يتعرض للعموم، وعمرو ما يتوّرى لأستاذ ولا لتلميذ.",
          "وثائق هويتك: عمرها ما تكون عمومية، ما تتشاركش مع التلاميذ، ما تتشاركش مع الأساتذة الآخرين، وما تتستعملش في حتى حاجة أخرى غير التوثيق.",
        ],
        after: [
          "بصفة ملموسة، وثائق الهوية تتشفّر قبل ما تتسجّل، برّة كل شيء يتقدّم للعموم: ملف يتنسخ من القرص ولا من نسخة احتياطية ما يتقراش من غير المفتاح. ما فمّا حتى رابط عمومي يفتحهم. الإداري المرخّص (قائمة محدودة من الإيميلات معرّفة في السيرفر) ياخذ، لكل وثيقة، رابط يخدم دقائق قليلة وما يستعملو كان هو. الوثيقة تتنزّل، عمرها ما تتخزّن في الكاش، وكل اطّلاع يتسجّل — شكون ووقتاش — قبل ما يتبعث الملفّ.",
          "المناولين: مستضيف السيرفر وقاعدة البيانات، خدمة تخزين الملفات إذا كانت خارجية، ومزوّد الإيميل اللي يبعثلك رمز الدخول (ياخذ الإيميل متاعك والرمز، وخلاص). يخدمو بتعليماتنا وما عندهمش الحقّ يستعملو معطياتك لروحهم. [يكمّلو المحامي: هوية المناولين هاذم، بلاد الاستضافة، وإذا كانت السيرفرات برّة تونس، الترخيص بالإحالة اللي يستوجبو القانون عدد 63 لسنة 2004.]",
          "ما نعطيوش معطيات لسلطة كان إذا القانون التونسي يلزمنا.",
        ],
      },
      {
        h: "5. قدّاش نحتافظو بمعطياتك",
        p: [
          "وثائق الهوية هي المعطيات اللي نحتافظو بيها أقلّ وقت. تخدم في قرار، موش باش نعملو بيها أرشيف.",
        ],
        list: [
          `وثائق الهوية والشهائد: نحتافظو بيهم وقت دراسة الملفّ برك، ومن بعد يتحذفو في أجل أقصاه ${ID_DOCUMENT_RETENTION_DAYS} يوم بعد القرار — سواء الأستاذ تقبل ولا تنرفض — ولا كي يتمسح الحساب. [يكمّلو المحامي: المدّة القصوى لملف عمرو ما خذا قرار.]`,
          "بعد الحذف، ما يبقى كان أثر بسيط بلا الملفّ روحو: نوع الوثيقة اللي تقدّمت، تاريخ إرسالها، القرار وتاريخو. هذا اللي يخلّينا نثبّتو إلّي التوثيق صار فعلاً. [مدّة الاحتفاظ بالأثر هذا يحدّدها المحامي.]",
          `الحساب والملفّ الشخصي: نحتافظو بيهم ما دامك تستعمل حسابك. حساب ما تستعملش ${YEARS_INACTIVE} سنين يتمسح كيف ما كان طلبت إنت (الفصل 3). ما نبعثو حتى إيميل تذكير قبل. [يثبّت المحامي: المدّة هاذي، وإذا لازم نعلمو قبل.]`,
          "الحجوزات وسجل الإلغاءات: نحتافظو بيهم، ويولّيو مجهولين كي يتمسح الحساب. [المدّة يحدّدها المحامي.]",
          "الرسائل: تتحفظ ما دام الحسابين موجودين؛ رسائل الحساب اللي يتمسح يتمسحو، كان رسالة مبلّغ عليها. [المدّة يحدّدها المحامي.]",
          "التبليغات وسجل أعمال الإداريين: يتحفظو. [المدّة يحدّدها المحامي.]",
          "رموز الدخول: مشفّرة، ما عادش تخدم بعد دقائق، ومن بعد تتحذف.",
          `جلسة الدخول: تتسكّر ${SESSION_DAYS} يوم بعد الدخول، ولا بعد ${SESSION_IDLE_DAYS} يوم بلا استعمال، ولا كي تخرج — ومنها « اخرج من حسابك في الأجهزة الكل ».`,
        ],
        after: [
          "الحذف يعني الحذف: الملفّ يتمسح من التخزين والسطر يتمسح من قاعدة البيانات. موش برك يتحطّ في « أرشيف ».",
          "النسخ الاحتياطية متاع قاعدة البيانات والملفات تبقى فيها المعطيات الممسوحة حتى تتمسح هي روحها. [مدّة الاحتفاظ بالنسخ الاحتياطية يحدّدها المحامي.]",
        ],
      },
      {
        h: "6. الأمان",
        p: [
          "وثائق الهوية مشفّرة وما يوصلّها كان إداريين معيّنين، برابط شخصي ومؤقت؛ وكل اطّلاع يتسجّل. رموز الدخول ورموز الجلسة يتحفظو كبصمة. الاتّصال بالموقع مشفّر (HTTPS). النفاذ الإداري محدود بقائمة إيميلات معرّفة في السيرفر.",
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
          "الحذف: تطلب مسح معطياتك، مباشرة من « حسابي » (الفصل 3)، بما فيها وثائق هويتك.",
          "الاعتراض: تعترض، لسبب مشروع، على معالجة.",
          "سحب الموافقة: وقت ما تحبّ، بلا ما يمسّ هذا اللي صار قبل. للتلميذ القاصر، الوليّ يسحب موافقتو من فضاء الولي. سحب موافقتك على التوثيق (كي تمسح حسابك ولا تكتبلنا) معناها صفحتك كأستاذ ما تبقاش منشورة.",
          "الشكاية: ترفع شكاية للهيئة الوطنية لحماية المعطيات الشخصية (INPDP) إذا شفت إلّي حقوقك ما تحترمتش.",
        ],
        after: [
          `باش تمارس حقّ آخر، اكتب لـ${PRIVACY_CONTACT_EMAIL} من العنوان المرتبط بحسابك. نجّمو نحتاجو نتثبّتو في هويتك (بلا ما نطلبو منّك وثائق جديدة بلا فايدة). نجاوبوك في أجل أقصاه شهر. [الأجل يثبّتو المحامي.]`,
          "للتلميذ القاصر، الحقوق هاذي يمارسها الوليّ اللي أعطى الموافقة.",
        ],
      },
      {
        h: "8. القاصرين",
        p: [
          `تنجّم يستعملوها تلاميذ إعدادي وثانوي. تلميذ عمرو أقلّ من ${MINOR_AGE_YEARS} سنة ما ينجّم يحجز حتى حصة من غير موافقة وليّ، ونحتافظو باسمو، تليفونو، الإيميل متاعو، نسخة السياسة هاذي وتاريخ الموافقة. الموافقة يعمّرها التلميذ باسم وليّو؛ الوليّ يشوفها، وينجّم يسحبها ولا يرجّعها، من حسابو هو. [يثبّت المحامي: موافقة يعمّرها التلميذ، بلا تثبّت من هوية الوليّ.]`,
          "نقلّلو بإرادتنا في اللي نطلبوه من القاصر: إيميل، اسم، سنة ميلاد، وتليفون اختياري. القاصر عمرو ما يبعثلنا وثيقة هوية — الواجب هذا يخصّ الأساتذة برك — وعمرو ما تكون عندو تصويرة.",
        ],
      },
      {
        h: "9. الكوكيز",
        p: [
          "نستعملو ثلاثة كوكيز، وحتى واحد ما يتبّعك: كوكي الجلسة، ضروري، يخلّيك داخل بعد ما تعمّر رمز الدخول؛ كوكي يتفكّر دورك باش يبان المنيو الصحيح (ما يعطي نفاذ لحتى شي)؛ وكوكي يتفكّر اللغة اللي اخترتها.",
          "ما فمّا كوكي إشهاري، ما فمّا بيكسل شبكات اجتماعية، ما فمّاش قياس جمهور خارجي. فيديو يوتيوب ما يتحمّلش كان كي تشغّلو، من دومين يوتيوب اللي بلا كوكيز.",
        ],
      },
      {
        h: "10. تغيير السياسة هاذي",
        p: [
          "السياسة هاذي باش تتطوّر — بالخصوص وقت تفعيل الخلاص، اللي باش يزيد معطيات جديدة (المعاملات). النسخة المعتمدة هي اللي منشورة في الصفحة هاذي؛ والنسخة اللي تعطات تحتها موافقة الوليّ تتسجّل معاها. [يكمّلو المحامي: كيفاش نعلمو المستعملين بتغيير مهمّ، وإذا لازمة موافقة جديدة.]",
        ],
      },
      {
        h: "11. اتصل بينا",
        p: [
          `أسئلة على معطياتك، طلب نفاذ: ${PRIVACY_CONTACT_EMAIL}.`,
          "أسئلة أخرى: contact@tnajem.tn.",
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
