export type Locale = "fr" | "ar";
export type Role = "tutor" | "student" | "guardian";
export type Rail = "flouci" | "konnect" | "d17";
export type PayoutMethod = "flouci_wallet" | "bank_rib";

export type Tutor = {
  id: string;
  slug: string;
  full_name: string;
  subject: string;       // e.g. "Prof de Maths · Bac"
  level: string;         // "Bac"
  bio: string;
  avatar_initials: string;
  rating: number;
  students_count: number;
  verified: boolean;
  /* TRUE only when an APPROVED photo exists on a public tutor. The URL is derived
     from the slug, so no path or timestamp leaks into a public payload — and a
     false here means "render the monogram", which is what every avatar slot did
     before Step 13 and still does for most tutors. */
  has_photo: boolean;
  /* Opt-in, per tutor, default false. The storefront needs it separately from
     ClassItem.is_free_first because tutor-level copy ("Première séance offerte"
     as a badge on the profile, the JSON-LD Offer) is rendered even when the
     tutor has published no class at all — which is exactly how a claim ended up
     on every storefront in the catalogue. */
  offers_free_first_session: boolean;
};

export type ClassItem = {
  id: string;
  tutor_id: string;
  tutor_name?: string;
  title: string;
  description?: string;
  day: string;           // "23"
  month: string;         // localized short month, e.g. "JUIN"
  time: string;          // "18:00"
  duration_min: number;
  price_tnd: number;
  seats: number;
  seats_left: number;
  /* EFFECTIVE, not raw. This is already
     tutors.offers_free_first_session AND classes.is_free_first — see
     isEffectivelyFreeFirst(). Every producer of a ClassItem applies it, so no
     consumer has to remember to, and a UI that renders this alone cannot
     over-promise. */
  is_free_first: boolean;
  meet_url?: string;        // Jitsi/Meet room
  whiteboard_url?: string;  // Bitpaper / Excalidraw
  quiz_url?: string;        // Wooclap / Quizizz
  replay_url?: string;      // recorded session
  status?: "scheduled" | "live" | "done" | "cancelled";
};

export type Pack = {
  id: string;
  tutor_id: string;
  title: string;
  meta: string;          // "42 pages · 6 vidéos"
  price_tnd: number;
  kind?: "pdf" | "video";
};

export type Booking = {
  id: string;
  class: ClassItem;
  is_free: boolean;
  status: "reserved" | "paid" | "attended" | "cancelled";
};

export type ActivityItem = {
  id: string;
  kind: "class" | "pack" | "payout";
  title: string;
  sub: string;           // "Aujourd'hui · 18 élèves"
  amount_tnd: number;    // +264, etc.
};

export type Storefront = { tutor: Tutor; classes: ClassItem[]; packs: Pack[] };

export type TutorStats = {
  balance_tnd: number;
  students: number;
  sessions: number;
  rating: number;
  trend_pct: number;     // +38
  spark: number[];       // sparkline points
  recent: ActivityItem[];
};

// A class as shown on the logged-in tutor's dashboard.
export type DashboardClass = {
  id: string;
  title: string;
  day: string;           // "23"
  month: string;         // localized short month
  time: string;          // "18:00"
  price_tnd: number;
  seats: number;
  seats_left: number;
  status: ClassItem["status"];
};

// A pack (downloadable revision material) as shown on the dashboard.
export type DashboardPack = {
  id: string;
  title: string;
  meta: string;              // "42 pages · 6 vidéos"
  price_tnd: number;
};

// One student who booked one of the tutor's classes (see getDashboard).
export type DashboardBooking = {
  bookingId: string;
  classId: string;
  classTitle: string;
  /* FIRST NAME ONLY, via publicProfile(). Step 8: zero contact exchange.

     This field used to be the full name, and it sat beside studentPhone and
     studentEmail — which the dashboard rendered as a `tel:` link and a `mailto:`
     link with the address as the visible label. That was the product's largest
     counterparty-PII surface, and its own copy promised the opposite ("Ton
     numéro reste privé"). Both contact fields are GONE from this type, not
     nulled: a type that still declares them invites the next person to fill them
     back in. */
  studentName: string | null;
  /** Monogram from the first name. Never the surname initial. */
  studentInitials: string;
  bookedAt: string;              // ISO
  classTs: number;               // epoch ms of the class start (sort/upcoming)
  isFree: boolean;
  status: "reserved" | "paid" | "attended" | "cancelled";
};

// Real dashboard payload for the signed-in tutor (see getDashboard in app/actions.ts).
export type DashboardPlan = {
  code: string;
  /** null = unlimited. */
  maxClasses: number | null;
  /** Upcoming, non-cancelled classes — what the limit actually counts. */
  openClasses: number;
  /** true while payments are off and the tutor has no explicit grant. */
  isPilot: boolean;
  /** true when an admin has granted this plan, rather than it being the default. */
  granted: boolean;
  /** ISO, or null for an open-ended grant / the default plan. */
  expiresAt: string | null;
};

export type DashboardData = {
  name: string | null;       // tutor display name (for the greeting)
  slug: string | null;       // storefront slug; null until they publish a page
  has_storefront: boolean;
  balance_tnd: number;       // real withdrawable balance — 0 while payments are OFF
  paymentsEnabled: boolean;  // false → the UI must not promise earnings/payouts
  students: number;
  sessions: number;          // number of classes created
  rating: number;
  reviewCount: number;       // how many reviews back that rating
  status: TutorVerifStatus;   // verification state (draft until submitted)
  /* The tutor's own opt-in for the free first session. Surfaced on the dashboard
     so they can turn it on — without it the policy change would leave the
     feature permanently off for everyone, which is not "opt-in", it is
     "removed". */
  offersFreeFirstSession: boolean;
  /* The tutor's own photo state, or null when they have none. Only THEY see this
     — it is on the dashboard payload, not the public storefront, which reports a
     plain has_photo and only for an approved one. */
  avatarStatus: "pending" | "approved" | "rejected" | null;
  /* THE TUTOR'S OWN PLAN (Step 16). On the dashboard because a limit a person
     cannot see is a limit they hit by surprise, at the moment they are trying to
     do something. `openClasses` is what counts against `maxClasses`, and
     `isPilot` is what lets the UI say the true thing today: everyone has the
     full offer and nothing is billed. */
  plan: DashboardPlan;
  classes: DashboardClass[];
  packs: DashboardPack[];
  bookings: DashboardBooking[]; // who actually booked (across all their classes)
};

// A booked class as shown on the student's dashboard.
export type StudentClass = {
  bookingId: string;
  classId: string;
  title: string;
  tutorName: string;
  day: string;
  month: string;
  time: string;
  ts: number;            // epoch ms of the scheduled start (for countdown/sort)
  isFree: boolean;
  status: string;        // class status (scheduled/live/done/cancelled)
  meetUrl?: string;
  replayUrl?: string;
};

// Real student dashboard payload (see getStudentDashboard in app/actions.ts).
export type StudentDashboard = {
  upcoming: StudentClass[];
  past: StudentClass[];
};

/* ---- Parent accounts (Step 14) ----
   A guardian's view of THEIR OWN child. The child's full name is theirs to see —
   this is not a counterparty surface. Every TUTOR name in here is
   publicDisplayName'd like everywhere else: a guardian is not a contact bridge. */
export type GuardianChild = {
  id: string;
  name: string | null;
  isMinor: boolean;
  /** How many conversations exist, so the parent knows there is something to read. */
  threadCount: number;
  upcoming: {
    classId: string;
    title: string;
    day: string;
    month: string;
    time: string;
    tutorName: string | null;   // first name only
  }[];
};

/* ---- Materials (Step 10) ----
   A material the CURRENT VIEWER is allowed to see. The API filters the list per
   viewer, so the mere presence of an item is already the access decision — a
   client never has to reproduce the rule, and cannot get it wrong. */
export type MaterialItem = {
  id: string;
  kind: "file" | "youtube";
  visibility: "public" | "students" | "private";
  title: string;
  description?: string;
  classId?: string;
  fileName?: string;
  /** The SNIFFED type, never the uploader's claim. */
  mime?: string;
  sizeBytes?: number;
  /** 11 characters. Rendered ONLY through youtube-nocookie. */
  youtubeId?: string;
  createdAt: string;
};

/* ---- Messaging (Step 8b) ----
   The counterparty name is ALREADY publicDisplayName'd by the API. A thread list
   is a counterparty surface like any other, and Step 8's allow-list does not stop
   applying because this feature is new. */
export type MessageThreadSummary = {
  id: string;
  classId: string;
  classTitle: string;
  classTs: number;              // epoch ms of the class start
  withName: string | null;      // first name only
  lastMessageAt: string | null; // ISO, null until someone writes
  studentIsMinor: boolean;
  iAm: "tutor" | "student" | "guardian";
};

export type MessageItem = {
  id: string;
  mine: boolean;
  /* Guardian view only (Step 14): whose message this is, so a parent can follow
     a conversation they are not in. `mine` is false for every message there —
     none of them are the guardian's — which is exactly why this second flag is
     needed rather than reusing it. */
  fromChild?: boolean;
  /** PLAIN TEXT. Never render through dangerouslySetInnerHTML. */
  body: string;
  /** True when contact details were removed from it before storage. */
  masked: boolean;
  at: string;                   // ISO
};

export type MessageThreadDetail = {
  id: string;
  classTitle: string;
  withName: string | null;
  /* "guardian" is a READER, not a participant. The UI hides the composer on it:
     a read-only view that still renders a text box invites a feature that does
     not exist, and a guardian must never be able to write as their child. */
  iAm: "tutor" | "student" | "guardian";
  studentIsMinor: boolean;
  messages: MessageItem[];
};

/* ---- Wrong-role result ----
   /dashboard serves tutors and /student serves students, but nothing stopped a
   signed-in student loading /dashboard (they got the tutor shell with a "create
   your storefront" prompt — an invitation to the exact silent role conversion we
   just closed) or a tutor loading /student (an empty bookings list that reads like
   a bug). Both actions now return this instead of data when the session's role is
   not the one the page serves, so each page can say WHICH account you are signed
   in as and link to the right place.

   Discriminated by the presence of the key, so callers narrow with
   `"wrongRole" in d` — no extra tag field on the happy-path payloads. */
export type WrongRole = { wrongRole: Role };

/* null still means "no session / no DB" on both — the signed-out panels already
   depend on that and it is a different message from "wrong role". */
export type DashboardResult = DashboardData | WrongRole | null;
export type StudentDashboardResult = StudentDashboard | WrongRole | null;

/* ---- Student profile (/student/welcome) ----
   School level. A closed set because it is written to the DB from a public action
   and read back into UI copy; `autre` is the escape hatch so the list never blocks
   someone. Order is the Tunisian school ladder, not alphabetical. */
export const STUDENT_LEVELS = ["primaire", "college", "lycee", "bac", "superieur", "autre"] as const;
export type StudentLevel = (typeof STUDENT_LEVELS)[number];

// What /student/welcome pre-fills from, and what saveStudentProfile writes.
export type StudentProfile = {
  fullName: string | null;
  level: StudentLevel | null;
  subjects: string[];        // stored comma-joined, exposed as a list
  /* Optional CONTACT number — not a credential. Email is the login identity, so
     this is where a student's phone is collected, and it is what keeps the tutor's
     call button and notify()'s SMS side-channel meaningful. */
  phone: string | null;
};

// ---- Tutor verification ----
export type TutorVerifStatus = "draft" | "pending" | "verified" | "rejected";
export type VerificationLinks = {
  linkedin: string | null;
  instagram: string | null;
  tiktok: string | null;
  youtube: string | null;
  facebook: string | null;
  website: string | null;
  introVideo: string | null;
};
// The signed-in tutor's own verification state (getMyVerification).
export type TutorVerification = {
  status: TutorVerifStatus;
  experienceYears: number | null;
  institution: string | null;
  languages: string | null;
  pitch: string | null;
  links: VerificationLinks;
  reviewNote: string | null;
  docKinds: string[];
};
/* ---- Tutor onboarding state (getOnboardingState) ----
   What /onboarding and /onboarding/verify need on the server: where the tutor is in
   the ladder (structurally the TutorProgress that lib/onboarding-steps.ts consumes)
   plus the storefront values to pre-fill the form with.

   `draft` is why revisiting /onboarding is now an edit rather than a blank slate:
   createTutor() has always UPDATED an existing storefront in place, but the form
   opened empty every time, so a tutor coming back to fix a typo was retyping their
   whole page from memory. */
export type OnboardingState = {
  hasStorefront: boolean;
  status: TutorVerifStatus;
  hasClass: boolean;
  hasSlug: boolean;
  draft: { fullName: string; subject: string; bio: string; slug: string; phone: string } | null;
};

// ---- Explore feed ----
// A verified tutor card on /explore. rating/review_count are computed from the
// reviews table — an empty feed returns [] (we never ship demo tutors as real).
export type ExploreTutor = {
  slug: string;
  full_name: string;
  subject: string;
  level: string;
  bio: string;
  avatar_initials: string;
  rating: number;          // 0 when nobody has reviewed yet
  review_count: number;
  students_count: number;
  price_from_tnd: number | null; // cheapest upcoming class; null if none published
  /* Step 16. This tutor is on a plan that buys a higher position in the list.
     The card MUST mark it: an ordering somebody paid for and the reader cannot
     see is an advertisement disguised as a recommendation. False for everyone
     during the pilot. */
  featured: boolean;
};

// ---- Reviews ----
export type Review = {
  id: string;
  rating: number;              // 1–5
  text: string | null;
  studentName: string | null;  // "Amine K." — never the phone
  classTitle: string | null;
  createdAt: string;           // ISO
};

export type TutorReviews = {
  items: Review[];
  average: number;             // 0 when there are none
  count: number;
};

// ---- Notifications ----
export type NotificationKind =
  | "booking_confirmed"
  | "class_reminder"
  | "verification_approved"
  | "verification_rejected"
  | "new_booking"
  | "booking_cancelled"   // student pulled out — the tutor needs to know a seat freed up
  | "message";            // Step 8b: someone wrote in a booking thread

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;           // ISO
};

// A pending application as seen by an admin reviewer (getPendingVerifications).
export type PendingTutor = {
  tutorId: string;
  slug: string;
  name: string;
  subject: string;
  experienceYears: number | null;
  institution: string | null;
  languages: string | null;
  pitch: string | null;
  links: VerificationLinks;
  submittedAt: string | null;
  docs: { id: string; kind: string; fileName: string }[];
};

/** What getMe() returns: the caller's OWN profile summary.

    email and phone are present here and that is correct even under the Step 8
    zero-contact rule — this is self-view, not a counterparty view. /account
    renders your own address. The rule Step 8 enforces is that a TUTOR never sees
    a STUDENT's contact and vice versa; it has never meant hiding your own. */
export type Me = {
  id: string;
  name: string | null;
  role: string;
  email: string | null;
  phone: string | null;
};

/** One public storefront reference, for app/sitemap.ts. */
export type PublicTutorRef = { slug: string; lastModified: Date };
