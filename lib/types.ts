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

// Real dashboard payload for the signed-in tutor (see getDashboard in app/actions.ts).
export type DashboardData = {
  name: string | null;       // tutor display name (for the greeting)
  slug: string | null;       // storefront slug; null until they publish a page
  has_storefront: boolean;
  balance_tnd: number;       // 0 until payments are wired
  students: number;
  sessions: number;          // number of classes created
  rating: number;
  status: TutorVerifStatus;   // verification state (draft until submitted)
  classes: DashboardClass[];
  packs: DashboardPack[];
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
