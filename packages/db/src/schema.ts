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
/* Who cancelled. "tutor" and "system" are not reachable yet (Step 11 gives the
   tutor a cancel path); the column exists now so the ledger never has to be
   back-filled with a guess about rows written before the option existed. */
export const cancelActor = pgEnum("cancel_actor", ["student", "tutor", "system"]);
/* MATERIALS (Step 10). Closed sets, because these are the columns access control
   and moderation branch on — a typo in a free-text "visibility" is an access
   control failure, and Postgres refusing the write is cheaper than discovering it. */
export const materialKind = pgEnum("material_kind", ["file", "youtube"]);
/* WHO CAN SEE IT. Ordered least to most restrictive, and the DEFAULT is the
   middle one, not "public": a tutor uploading a worksheet is far more likely to
   mean "for my students" than "for the internet", and the safe default is the one
   that cannot surprise them. */
export const materialVisibility = pgEnum("material_visibility", ["public", "students", "private"]);
export const takedownStatus = pgEnum("takedown_status", ["open", "upheld", "rejected"]);
/* PHOTO MODERATION (Step 13). A face on a public page that children browse is
   reviewed before anyone but its owner can see it. "pending" is the only state a
   fresh upload can be in — there is no path that publishes one directly. */
export const avatarStatus = pgEnum("avatar_status", ["pending", "approved", "rejected"]);
/* Where the text was written. Not a free string: this is the column a moderator
   filters on, and "review" vs "reviews" vs "Review" would quietly split it. */
export const leakSurface = pgEnum("leak_surface", [
  "tutor_bio", "tutor_name", "tutor_subject",
  "class_title", "class_description",
  "pack_title", "review", "message",
]);
/* What the author's text hit. MIRRORS ContactKind in
   packages/shared/src/contact-info.ts — add there and here together. */
export const leakKind = pgEnum("leak_kind", [
  "phone", "email", "url", "social-handle", "social-platform", "spelled-digits",
]);
/* What we did about it. Rejected: the write was refused and the author re-edits.
   Masked: the text was stored with the details removed. */
export const leakAction = pgEnum("leak_action", ["rejected", "masked"]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  role: userRole("role").notNull().default("student"),
  fullName: text("full_name"),
  /* ---- Login identity ----
     `email` is what a login code is sent to (lib/auth.ts::otpChannel); `phone` was,
     and still is under OTP_CHANNEL=sms. Both are nullable-but-unique: Postgres does
     not conflict NULLs, so exactly one of them is populated at signup and the other
     is filled in later — phone is now an OPTIONAL CONTACT collected during
     onboarding, which is what keeps the tutor's call button and notify()'s SMS
     side-channel working. Added by scripts/sql/0005_email_identity.sql. */
  email: text("email").unique(),
  phone: text("phone").unique(),
  locale: text("locale").notNull().default("fr"),
  birthYear: integer("birth_year"),
  /* ---- Student profile (collected at /student/welcome) ----
     Nullable on purpose: the welcome screen is skippable, and every profile
     written before scripts/sql/0004_student_profile.sql predates these columns.
     `subjects` is a comma-joined list, matching tutors.languages rather than
     inventing a second convention for "a short list of tags" in one schema. */
  level: text("level"),
  subjects: text("subjects"),
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
  /* THE PHOTO. Renamed from the dead `avatar_url` column, which was declared and
     never once written or read — a URL is the wrong shape for this: nothing is
     served statically, and the bytes live under STORAGE_DIR with an endpoint in
     front. Holding a storage path in a column called "url" would mislead the next
     reader on the most privacy-sensitive field the table has. */
  avatarPath: text("avatar_path"),
  /* Every upload lands as `pending` and stays invisible to everyone but its owner
     until a human approves it. There is deliberately no "publish immediately"
     path: this is a photograph, on a public page, in a product used by minors. */
  avatarStatus: avatarStatus("avatar_status"),
  avatarUpdatedAt: timestamp("avatar_updated_at", { withTimezone: true }),
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
  /* THE FREE FIRST SESSION IS OPT-IN, PER TUTOR, AND DEFAULT OFF.
     notNull + default false, both deliberate:
       • nullable would make "not set" and "declined" indistinguishable, and every
         read site would have to pick a meaning for null — which is how
         classes.is_free_first ended up nullable-with-default-true, i.e. a claim
         nobody chose to make.
       • default FALSE because this is a promise to a student about money. A
         default that promises on the tutor's behalf is the thing being fixed.
     Terms §5 already says a tutor "peut choisir"; until now the product did not
     let them. */
  offersFreeFirstSession: boolean("offers_free_first_session").notNull().default(false),
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
  /* Per-class, and it is only ever HALF the answer: the effective rule is
     tutors.offers_free_first_session AND classes.is_free_first. See
     isEffectivelyFreeFirst() in @tnajem/shared. Default flipped from true to
     false in 0008 — the old default made the platform promise a free session on
     behalf of every tutor who never touched the checkbox. */
  isFreeFirst: boolean("is_free_first").notNull().default(false),
  /* WHEN THE TUTOR LAST MOVED THIS CLASS (Step 11), or null.

     A student who booked BEFORE this timestamp agreed to a time that no longer
     exists, so they may cancel free whatever the 48h window says — the window is
     measured against a time they never chose. Comparing bookings.created_at to
     this is the whole rule; a per-booking flag would need writing to every row on
     every reschedule and would drift the first time one write failed. */
  rescheduledAt: timestamp("rescheduled_at", { withTimezone: true }),
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

/* THE CANCELLATION LEDGER.

   One row per cancellation, written in the SAME transaction as the status change
   and the seat release. Not a log: it is the record of what each party is owed
   under the 48h/40% rule, and it is what a dispute gets settled from.

   NOTHING IS CHARGED TODAY. Payments are off, so retained_tnd is what WOULD be
   retained. payments_enabled records the state at write time precisely so a
   future reader can tell a "would have been" row from a real one — without it,
   the day payments open, every historical row becomes indistinguishable from a
   real debit. Do not drop that column.

   retained_pct is stored per row rather than read from the constant. If the rate
   ever changes, history must keep the rate that was actually applied; a ledger
   that recomputes itself from today's constant is not a ledger. */
export const cancellations = pgTable("cancellations", {
  id: uuid("id").primaryKey().defaultRandom(),
  /* UNIQUE. A booking is cancelled once. The endpoint is idempotent and the
     status flip is atomic, but two concurrent cancels racing past the ledger
     insert would otherwise write two rows and double the retained amount — the
     same class of bug as the missing unique index on bookings (see 0007). */
  bookingId: uuid("booking_id").notNull().unique().references(() => bookings.id, { onDelete: "cascade" }),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  /* Nullable + set null: a deleted account must not take the tutor's record of
     what happened with it, and Step 15 deletes accounts. */
  actorProfileId: uuid("actor_profile_id").references(() => profiles.id, { onDelete: "set null" }),
  actor: cancelActor("actor").notNull(),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }).notNull().defaultNow(),
  /** Class start minus cancellation time. Signed — negative means it had started. */
  hoursBeforeStart: numeric("hours_before_start", { precision: 10, scale: 2 }).notNull(),
  late: boolean("late").notNull(),
  /* numeric(7,2) throughout, matching classes.price_tnd exactly. Money in a float
     column is how ledgers stop balancing. */
  amountTnd: numeric("amount_tnd", { precision: 7, scale: 2 }).notNull().default("0"),
  retainedTnd: numeric("retained_tnd", { precision: 7, scale: 2 }).notNull().default("0"),
  releasedTnd: numeric("released_tnd", { precision: 7, scale: 2 }).notNull().default("0"),
  retainedPct: numeric("retained_pct", { precision: 4, scale: 3 }).notNull().default("0"),
  /** False for every row written during the pilot. See the note above. */
  paymentsEnabled: boolean("payments_enabled").notNull().default(false),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // The tutor's "what do I get for the no-shows" view is per class.
  classIdx: index("cancellations_class_id_idx").on(t.classId),
  // And the student's own history is per actor.
  actorIdx: index("cancellations_actor_profile_id_idx").on(t.actorProfileId),
}));

/* CONTACT-LEAK FLAGS — moderation signal, not evidence storage.

   ⚠ THE RAW MATCH IS NEVER STORED. Only the pattern CLASS (phone / email / url /
   …) and where it happened. The entire point of Step 8 is to stop contact
   details moving between people; a moderation table that keeps the phone number
   it caught has copied that number into a second place, made it reachable by
   every admin, and given the retention job something new to promise about. If
   you find yourself adding a `matched_text` column, the feature has inverted.

   No unique constraint: repeated attempts are the signal. One flag is a typo,
   eleven in an evening is a person working around the filter, and that pattern is
   only visible if every attempt is a row. */
export const contactLeakFlags = pgTable("contact_leak_flags", {
  id: uuid("id").primaryKey().defaultRandom(),
  /* Nullable + set null: Step 15 deletes accounts, and a moderation history must
     not vanish because the account it describes closed. */
  profileId: uuid("profile_id").references(() => profiles.id, { onDelete: "set null" }),
  surface: leakSurface("surface").notNull(),
  kind: leakKind("kind").notNull(),
  action: leakAction("action").notNull(),
  /** How many matches of this kind were in the text. A count, never the text. */
  hits: integer("hits").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // "show me everything this person tried" — the only query a moderator runs.
  profileIdx: index("contact_leak_flags_profile_id_created_at_idx").on(t.profileId, t.createdAt),
}));

/* ══════════════════════════════════════════════════════════════════════════════
   MESSAGING (Step 8b) — the replacement channel for the contact details Step 8
   closed. Without it, "we removed the phone number" is just a removal.

   SCOPED TO A BOOKING. There are no cold DMs and no way to address a stranger:
   a thread exists only where a student has actually taken a seat in that tutor's
   class. That single rule removes the entire class of abuse a marketplace inbox
   normally invites, and it is enforced by the UNIQUE booking_id below rather than
   by a check somebody can forget.
   ══════════════════════════════════════════════════════════════════════════════ */
export const messageThreads = pgTable("message_threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  /* ONE THREAD PER BOOKING, enforced by the database. The alternative — a thread
     per (tutor, student) pair — would silently outlive the booking that justified
     it, so a single cancelled seat would leave a permanent channel to a minor. */
  bookingId: uuid("booking_id").notNull().unique().references(() => bookings.id, { onDelete: "cascade" }),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  tutorProfileId: uuid("tutor_profile_id").references(() => profiles.id, { onDelete: "set null" }),
  studentProfileId: uuid("student_profile_id").references(() => profiles.id, { onDelete: "set null" }),
  /* Snapshotted at creation, not recomputed. A thread that started with a minor
     stays a minor's thread for its whole retention life even after they turn 18 —
     the messages in it were still written to a child. */
  studentIsMinor: boolean("student_is_minor").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** Denormalised so the thread LIST does not need a per-row subquery. */
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
}, (t) => ({
  // "my conversations, most recent first" — the only list query there is.
  tutorIdx: index("message_threads_tutor_profile_id_idx").on(t.tutorProfileId, t.lastMessageAt),
  studentIdx: index("message_threads_student_profile_id_idx").on(t.studentProfileId, t.lastMessageAt),
}));

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id").notNull().references(() => messageThreads.id, { onDelete: "cascade" }),
  /* set null, not cascade: deleting an account must not silently rewrite the
     other side's conversation into a monologue. Step 15 anonymises rather than
     erases, for the same reason it anonymises reviews. */
  senderProfileId: uuid("sender_profile_id").references(() => profiles.id, { onDelete: "set null" }),
  /* PLAIN TEXT, always. Stripped of markup on the way IN (apps/api) and escaped
     by React on the way OUT. This column is the product's only stored-XSS
     surface: it is user-authored, rendered to another user, and persisted. It
     must never be fed to dangerouslySetInnerHTML. */
  body: text("body").notNull(),
  /** True when detectContactInfo found something and it was masked out. */
  masked: boolean("masked").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  threadIdx: index("messages_thread_id_created_at_idx").on(t.threadId, t.createdAt),
}));

/* Reports. Deliberately minimal here — Step 15 builds the moderation queue this
   feeds. What matters now is that the button exists and the row is durable: a
   Report button that does nothing is worse than none, because it teaches people
   that reporting does not work. */
export const messageReports = pgTable("message_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  reporterProfileId: uuid("reporter_profile_id").references(() => profiles.id, { onDelete: "set null" }),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // One report per person per message; pressing twice is not two reports.
  uniqReporterMessage: unique().on(t.messageId, t.reporterProfileId),
}));

/* ══════════════════════════════════════════════════════════════════════════════
   MATERIALS (Step 10) — worksheets, corrections and videos a tutor attaches.

   FILES NEVER GO IN public/. They land under STORAGE_DIR, exactly like identity
   documents, and the ONLY reader is an endpoint that makes an access decision
   first. A static directory cannot ask "did this student book the class?", so
   putting a "students only" worksheet there would make the visibility column a
   decoration.

   VIDEOS STORE AN ID, NOT A URL (see parseYouTubeId in @tnajem/shared). A stored
   URL is a stored redirect that some future surface renders as a link; an id can
   only ever be embedded, and only through youtube-nocookie.
   ══════════════════════════════════════════════════════════════════════════════ */
export const materials = pgTable("materials", {
  id: uuid("id").primaryKey().defaultRandom(),
  tutorId: uuid("tutor_id").notNull().references(() => tutors.id, { onDelete: "cascade" }),
  /* Optional. A material can belong to one class ("corrections for Tuesday") or
     to the tutor's library. set null, not cascade: deleting a finished class must
     not destroy the worksheet, which is the thing students keep. */
  classId: uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
  kind: materialKind("kind").notNull(),
  visibility: materialVisibility("visibility").notNull().default("students"),
  title: text("title").notNull(),
  description: text("description"),
  /* Files only. POSIX separators always — see storage.ts on why a backslash in
     here does not resolve on Linux. */
  storagePath: text("storage_path"),
  fileName: text("file_name"),
  /** The SNIFFED type. Never the client's claim: this is served as Content-Type. */
  mime: text("mime"),
  sizeBytes: integer("size_bytes"),
  /** Videos only. 11 characters, validated by parseYouTubeId. */
  youtubeId: text("youtube_id"),
  /* TAKEDOWN. Soft removal, not a DELETE: a copyright dispute needs a record that
     the thing existed and was acted on, and an upheld claim that leaves no trace
     is indistinguishable from one that was never made. Every read path filters on
     removedAt IS NULL. */
  removedAt: timestamp("removed_at", { withTimezone: true }),
  removedReason: text("removed_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // "this tutor's library" and "this class's attachments" are the only listings.
  tutorIdx: index("materials_tutor_id_idx").on(t.tutorId, t.createdAt),
  classIdx: index("materials_class_id_idx").on(t.classId),
}));

/* COPYRIGHT TAKEDOWN. Ships WITH the upload, not after it — a platform hosting
   other people's teaching material without a way to complain about it is one that
   discovers its process during the first dispute.

   reporter_profile_id is NULLABLE and there is no auth on the write path. A
   rights-holder is almost never a user of this site, and requiring them to sign
   up to file a claim is the same as not having a process. */
export const materialTakedowns = pgTable("material_takedowns", {
  id: uuid("id").primaryKey().defaultRandom(),
  materialId: uuid("material_id").notNull().references(() => materials.id, { onDelete: "cascade" }),
  reporterProfileId: uuid("reporter_profile_id").references(() => profiles.id, { onDelete: "set null" }),
  /** Who is complaining. Free text — a rights-holder is not a row in our tables. */
  claimantName: text("claimant_name").notNull(),
  claimantEmail: text("claimant_email").notNull(),
  reason: text("reason").notNull(),
  status: takedownStatus("status").notNull().default("open"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedBy: uuid("resolved_by").references(() => profiles.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  materialIdx: index("material_takedowns_material_id_idx").on(t.materialId),
  statusIdx: index("material_takedowns_status_created_at_idx").on(t.status, t.createdAt),
}));

/* STRIKES. One row per upheld claim, against the TUTOR rather than the file.

   Counted, not enforced automatically. A threshold that suspends an account on
   its own would be a system nobody can argue with, and a wrong strike would take
   a livelihood off the platform with no human in the loop. Step 15 builds the
   moderation surface that acts on these. */
export const tutorStrikes = pgTable("tutor_strikes", {
  id: uuid("id").primaryKey().defaultRandom(),
  tutorId: uuid("tutor_id").notNull().references(() => tutors.id, { onDelete: "cascade" }),
  /* One strike per upheld takedown. Without this a moderator refreshing the queue
     twice doubles a tutor's count — and a count that can be wrong upward is one
     nobody can act on. */
  takedownId: uuid("takedown_id").unique().references(() => materialTakedowns.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tutorIdx: index("tutor_strikes_tutor_id_idx").on(t.tutorId, t.createdAt),
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
  /* Free text, not an enum, so a new kind needs no migration. The closed set
     lives in NotificationKind (@tnajem/shared) and is what the UI switches on:
     booking_confirmed | booking_cancelled | class_reminder |
     verification_approved | verification_rejected | new_booking | message */
  kind: text("kind").notNull(),
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
  /* An email address under OTP_CHANNEL=email, a phone number under =sms. One
     column for both, so flipping the channel needs no migration (renamed from
     `phone` by scripts/sql/0005_email_identity.sql). */
  identifier: text("identifier").notNull(),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  /* Every step of the login funnel scans this by identity: otpCooldownRemaining
     (select), createOtp (delete + insert), verifyOtpCode (select, then delete).
     Four lookups per successful login — without this, all of them are seq scans.
     NOTE: this is deliberately a plain index, not unique. createOtp's
     delete-then-insert under an advisory lock means at most one live row per
     identity, so unique WOULD be the correct constraint — but `db:push` would fail
     if two rows already exist from a concurrent send. Dedupe first, then upgrade
     (SQL in SCALABILITY.md). */
  identifierIdx: index("otp_codes_identifier_idx").on(t.identifier),
  /* Retention sweep: `delete from otp_codes where expires_at < now()`. */
  expiresAtIdx: index("otp_codes_expires_at_idx").on(t.expiresAt),
}));
