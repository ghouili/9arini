import { pgTable, pgEnum, uuid, text, integer, numeric, boolean, timestamp, unique, index } from "drizzle-orm/pg-core";

/* Tnajem DB schema (local Postgres + Drizzle). Plain Postgres — no Supabase auth.users,
   no RLS. Authorization is enforced in the server data layer (lib/data.ts, app/actions.ts).
   Money tables (payments/payouts) exist but stay unused until legal sign-off. */

/* ── INDEXES ──────────────────────────────────────────────────────────────────
   Every index below is here because a query in lib/auth.ts, lib/data.ts or
   app/actions.ts runs it — none are speculative. The rule of thumb applied:

     • A UNIQUE constraint (or a PRIMARY KEY) already creates a btree index.
       We do NOT add a second index on the same leading columns. Already covered
       for free, and NOT re-declared below:
         profiles.phone            .unique()  → every login (verifyOtp)
         tutors.slug               .unique()  → every storefront hit
         sessions.token            PK         → every authenticated request
         bookings (class_id, student_id) unique → also serves lookups by class_id
         reviews  (student_id, class_id) unique → also serves lookups by student_id
         referrals.code            .unique()

     • Composite indexes are ordered so the leading column alone is still useful
       (btree prefix rule), which is why e.g. classes has ONE index on
       (tutor_id, scheduled_at) rather than two.

     • No DESC indexes: Postgres scans a btree backwards at the same cost, so
       (tutor_id, created_at) serves `ORDER BY created_at DESC` fine.

   All of this is additive — `drizzle-kit push` emits CREATE INDEX only. No data
   is touched. On a large table prefer `CREATE INDEX CONCURRENTLY` by hand; at
   pilot size (hundreds of rows) push is instant.
   ─────────────────────────────────────────────────────────────────────────── */

export const userRole = pgEnum("user_role", ["tutor", "student", "guardian"]);
export const classStatus = pgEnum("class_status", ["scheduled", "live", "done", "cancelled"]);
export const bookingStatus = pgEnum("booking_status", ["reserved", "paid", "attended", "cancelled"]);
export const payRail = pgEnum("pay_rail", ["flouci", "konnect", "d17"]);
export const payStatus = pgEnum("pay_status", ["pending", "paid", "failed", "refunded"]);
export const payoutMethod = pgEnum("payout_method", ["flouci_wallet", "bank_rib"]);
export const tutorStatus = pgEnum("tutor_status", ["draft", "pending", "verified", "rejected"]);
export const docKind = pgEnum("doc_kind", ["id_front", "id_back", "selfie", "diploma", "certificate", "role_proof", "other"]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  role: userRole("role").notNull().default("student"),
  fullName: text("full_name"),
  phone: text("phone").unique(),
  locale: text("locale").notNull().default("fr"),
  birthYear: integer("birth_year"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tutors = pgTable("tutors", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id").references(() => profiles.id, { onDelete: "set null" }),
  slug: text("slug").notNull().unique(),
  fullName: text("full_name").notNull(),
  subject: text("subject").notNull(),
  level: text("level").default("Bac"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  introVideoUrl: text("intro_video_url"),
  rating: numeric("rating", { precision: 2, scale: 1 }).default("0"),
  studentsCount: integer("students_count").default(0),
  verified: boolean("verified").default(false),
  // ---- Verification (identity required; diploma/experience optional trust boosters) ----
  status: tutorStatus("status").notNull().default("draft"),
  experienceYears: integer("experience_years"),
  institution: text("institution"),
  languages: text("languages"),
  pitch: text("pitch"),
  linkedinUrl: text("linkedin_url"),
  instagramUrl: text("instagram_url"),
  tiktokUrl: text("tiktok_url"),
  youtubeUrl: text("youtube_url"),
  facebookUrl: text("facebook_url"),
  websiteUrl: text("website_url"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewNote: text("review_note"),
  payoutMethod: payoutMethod("payout_method"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  /* /explore: `where status = 'verified' order by rating desc` (getExploreTutors),
     the sitemap's `where status = 'verified'`, and the admin queue's
     `where status = 'pending'` (getPendingVerifications) all lead with status.
     One composite serves all three: status filters on the leading column, rating
     gives the planner a pre-sorted read for the Explore ordering. */
  statusRatingIdx: index("tutors_status_rating_idx").on(t.status, t.rating),
  /* `where profile_id = <me>` — the single hottest authenticated tutor query:
     getDashboard, createTutor, createClass, createPack, submitVerification and
     getMyVerification all run it. Without this it is a seq scan on every
     dashboard render. (Not unique: a duplicate row would be a bug, but making it
     unique could fail `db:push` on existing data — see SCALABILITY.md.) */
  profileIdIdx: index("tutors_profile_id_idx").on(t.profileId),
}));

// Uploaded verification documents (sensitive — INPDP: access-restricted, retained per policy).
export const verificationDocs = pgTable("verification_docs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tutorId: uuid("tutor_id").notNull().references(() => tutors.id, { onDelete: "cascade" }),
  kind: docKind("kind").notNull(),
  fileName: text("file_name").notNull(),
  storagePath: text("storage_path").notNull(),
  mime: text("mime"),
  sizeBytes: integer("size_bytes"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  /* getMyVerification + the admin queue's per-tutor doc fetch (an N+1 loop over
     pending tutors) + the retention purge join in lib/retention.ts. Also makes
     the ON DELETE CASCADE from tutors an index scan instead of a seq scan. */
  tutorIdIdx: index("verification_docs_tutor_id_idx").on(t.tutorId),
}));

export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  tutorId: uuid("tutor_id").notNull().references(() => tutors.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  durationMin: integer("duration_min").default(90),
  priceTnd: numeric("price_tnd", { precision: 7, scale: 2 }).notNull().default("0"),
  seats: integer("seats").default(20),
  seatsTaken: integer("seats_taken").default(0),
  isFreeFirst: boolean("is_free_first").default(true),
  meetUrl: text("meet_url"),
  whiteboardUrl: text("whiteboard_url"),
  quizUrl: text("quiz_url"),
  replayUrl: text("replay_url"),
  status: classStatus("status").default("scheduled"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  /* THE storefront query: getStorefront() does `where tutor_id = ?` on every
     viral page hit; getDashboard does the same; getExploreTutors aggregates
     min(price) grouped by tutor_id. scheduled_at rides along as the second
     column so "this tutor's classes, in date order" (and any future
     upcoming-only filter) is served by the same index — a plain tutor_id index
     would be a redundant prefix of this one. */
  tutorScheduledIdx: index("classes_tutor_id_scheduled_at_idx").on(t.tutorId, t.scheduledAt),
  /* Global time-ordered scan: the class_reminder notification job (and any
     "starting soon" sweep) asks for classes across ALL tutors in a time window. */
  scheduledAtIdx: index("classes_scheduled_at_idx").on(t.scheduledAt),
}));

export const packs = pgTable("packs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tutorId: uuid("tutor_id").notNull().references(() => tutors.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  priceTnd: numeric("price_tnd", { precision: 7, scale: 2 }).notNull().default("0"),
  fileUrl: text("file_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // getStorefront() + getDashboard(): `where tutor_id = ?`. Same hot path as classes.
  tutorIdIdx: index("packs_tutor_id_idx").on(t.tutorId),
}));

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  isFree: boolean("is_free").default(false),
  status: bookingStatus("status").default("reserved"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  /* Correctness first: one booking per (class, student). reserveSeat() relies on
     this to be idempotent — it catches the insert conflict and returns
     { already: true } rather than double-booking a seat under a race.
     Performance bonus: the unique constraint's btree also serves
     `where class_id = ?` and `where class_id = ? and student_id = ?`
     (reserveSeat, createReview, canJoinClass) — so NO separate class_id index. */
  uniqClassStudent: unique().on(t.classId, t.studentId),
  /* student_id is NOT the leading column above, so it needs its own index:
     getStudentDashboard does `where student_id = ? and status <> 'cancelled'`.
     status rides along so the cancelled rows are filtered in the index. */
  studentStatusIdx: index("bookings_student_id_status_idx").on(t.studentId, t.status),
}));

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
  packId: uuid("pack_id").references(() => packs.id, { onDelete: "set null" }),
  payerId: uuid("payer_id").references(() => profiles.id, { onDelete: "set null" }),
  amountTnd: numeric("amount_tnd", { precision: 7, scale: 2 }).notNull(),
  platformFeeTnd: numeric("platform_fee_tnd", { precision: 7, scale: 2 }).notNull().default("0"),
  rail: payRail("rail"),
  status: payStatus("status").default("pending"),
  providerRef: text("provider_ref"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payouts = pgTable("payouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tutorId: uuid("tutor_id").notNull().references(() => tutors.id, { onDelete: "cascade" }),
  amountTnd: numeric("amount_tnd", { precision: 7, scale: 2 }).notNull(),
  method: payoutMethod("method").notNull(),
  status: payStatus("status").default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const referrals = pgTable("referrals", {
  id: uuid("id").primaryKey().defaultRandom(),
  inviterId: uuid("inviter_id").references(() => profiles.id, { onDelete: "set null" }),
  inviteeId: uuid("invitee_id").references(() => profiles.id, { onDelete: "set null" }),
  code: text("code").notNull().unique(),
  rewarded: boolean("rewarded").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const consents = pgTable("consents", {
  id: uuid("id").primaryKey().defaultRandom(),
  minorId: uuid("minor_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  guardianName: text("guardian_name").notNull(),
  guardianPhone: text("guardian_phone").notNull(),
  consentText: text("consent_text").notNull(),
  signedAt: timestamp("signed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  /* verifyOtp() does `where minor_id = ?` on EVERY student login to decide
     needsConsent. That is on the critical path of the signup funnel. */
  minorIdIdx: index("consents_minor_id_idx").on(t.minorId),
}));

/* Reviews: one per (student, class). Written only after the class has started and
   only by a student who actually booked it (enforced in app/actions.ts → createReview).
   tutors.rating / tutors.students_count are recomputed from this table, so the
   storefront stars are real. rating is 1–5 — validated in lib/validation.ts. */
export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  tutorId: uuid("tutor_id").notNull().references(() => tutors.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  classId: uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
  rating: integer("rating").notNull(),
  text: text("text"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  /* Correctness: one review per (student, class). createReview() catches the
     conflict and returns "already-reviewed" — this constraint IS the check.
     Its btree also serves lookups by student_id (leading column). */
  uniqStudentClass: unique().on(t.studentId, t.classId),
  /* tutor_id is not the leading column above, and it is read on every public
     storefront: getTutorReviews (`where tutor_id = ? order by created_at desc
     limit 50`), recomputeTutorStats (avg/count per tutor) and getExploreTutors
     (`where tutor_id in (...) group by tutor_id`). created_at second → the
     ORDER BY ... LIMIT 50 is a backward index scan, no sort. */
  tutorCreatedIdx: index("reviews_tutor_id_created_at_idx").on(t.tutorId, t.createdAt),
}));

/* In-app notifications (the always-on channel; SMS is best-effort on top — see lib/notify.ts).
   `kind` is plain text on purpose: adding a kind must not require a DB migration.
   Allowed values are typed as NotificationKind in lib/types.ts. */
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // booking_confirmed | booking_cancelled | class_reminder | verification_approved | verification_rejected | new_booking
  title: text("title").notNull(),
  body: text("body").notNull(),
  href: text("href"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  /* getNotifications(): `where profile_id = ? order by created_at desc limit 50`
     → backward index scan, no sort, no heap scan of other users' rows. */
  profileCreatedIdx: index("notifications_profile_id_created_at_idx").on(t.profileId, t.createdAt),
  /* markNotificationsRead(): `where profile_id = ? and read_at is null`.
     btree indexes NULLs, so IS NULL is a real index condition here. This is also
     the index a future unread-badge count would use. */
  profileReadIdx: index("notifications_profile_id_read_at_idx").on(t.profileId, t.readAt),
}));

// ---- Auth ----
export const sessions = pgTable("sessions", {
  /* PRIMARY KEY = unique btree on token. This is the index hit on EVERY
     authenticated request (getSession → `where token = ?` joined to profiles),
     and the uniqueness is a correctness property: two rows with the same token
     would be two identities behind one cookie. Nothing more to add here. */
  token: text("token").primaryKey(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  /* The retention sweep this table needs: `delete from sessions where
     expires_at < now()`. Without it, the purge is a full scan of a table that
     grows by one row per login, forever (see SCALABILITY.md §Housekeeping). */
  expiresAtIdx: index("sessions_expires_at_idx").on(t.expiresAt),
  /* ON DELETE CASCADE from profiles, and "log out all my devices" later.
     An unindexed FK turns every profile delete into a seq scan of sessions. */
  profileIdIdx: index("sessions_profile_id_idx").on(t.profileId),
}));

/* Durable, cross-instance rate limiting (SCALABILITY.md). One row per
   (endpoint, subject) key; checkRateLimit() in lib/auth.ts does a single atomic
   INSERT ... ON CONFLICT DO UPDATE against it so every instance shares one
   fixed-window counter instead of each Node process keeping its own in-memory Map.
   Created by scripts/sql/0002_rate_limits.sql. */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
}, (t) => ({
  /* The retention sweep: `delete from rate_limits where reset_at < now()`.
     Without it, a key hit once and never again lingers forever. */
  resetAtIdx: index("rate_limits_reset_at_idx").on(t.resetAt),
}));

export const otpCodes = pgTable("otp_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: text("phone").notNull(),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  /* Every step of the login funnel scans this by phone: otpCooldownRemaining
     (select), createOtp (delete + insert), verifyOtpCode (select, then delete).
     Four phone lookups per successful login — today all of them are seq scans.
     NOTE: this is deliberately a plain index, not unique. createOtp's
     delete-then-insert means at most one live row per phone, so unique WOULD be
     the correct constraint — but `db:push` would fail if two rows already exist
     from a concurrent send. Dedupe first, then upgrade (SQL in SCALABILITY.md). */
  phoneIdx: index("otp_codes_phone_idx").on(t.phone),
  /* Retention sweep: `delete from otp_codes where expires_at < now()`. */
  expiresAtIdx: index("otp_codes_expires_at_idx").on(t.expiresAt),
}));
