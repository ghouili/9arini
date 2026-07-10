import { pgTable, pgEnum, uuid, text, integer, numeric, boolean, timestamp, unique } from "drizzle-orm/pg-core";

/* 9arini DB schema (local Postgres + Drizzle). Plain Postgres — no Supabase auth.users,
   no RLS. Authorization is enforced in the server data layer (lib/data.ts, app/actions.ts).
   Money tables (payments/payouts) exist but stay unused until legal sign-off. */

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
});

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
});

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
});

export const packs = pgTable("packs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tutorId: uuid("tutor_id").notNull().references(() => tutors.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  priceTnd: numeric("price_tnd", { precision: 7, scale: 2 }).notNull().default("0"),
  fileUrl: text("file_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  isFree: boolean("is_free").default(false),
  status: bookingStatus("status").default("reserved"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ uniqClassStudent: unique().on(t.classId, t.studentId) }));

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
});

// ---- Auth ----
export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const otpCodes = pgTable("otp_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: text("phone").notNull(),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
