/**
 * AI Clinic Front-Desk Assistant — database schema (Drizzle / PostgreSQL).
 *
 * Data-minimisation notes:
 *  - Raw free-text intake messages are NOT persisted by default. Only the
 *    validated, structured extraction is stored (see docs/safety-and-privacy.md).
 *  - Audit rows store ids/actions/timestamps plus a small, non-sensitive meta
 *    blob — never message bodies or credentials.
 *  - All seeded people are synthetic demo identities.
 */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/* ---------------------------------- enums --------------------------------- */

export const userRoleEnum = pgEnum("user_role", [
  "patient",
  "clinician",
  "admin",
  "receptionist",
]);
export const slotStatusEnum = pgEnum("slot_status", ["open", "booked"]);
export const appointmentStatusEnum = pgEnum("appointment_status", [
  "confirmed",
  "checked_in",
  "in_consultation",
  "completed",
  "cancelled",
  "no_show",
  "cancellation_requested",
  "reschedule_requested",
]);
export const summaryStatusEnum = pgEnum("summary_status", [
  "draft",
  "approved",
  "rejected",
]);
export const policyApprovalEnum = pgEnum("policy_approval", [
  "approved",
  "pending_owner_approval",
]);
export const waitlistStatusEnum = pgEnum("waitlist_status", [
  "waiting",
  "offered",
  "accepted",
  "declined",
  "expired",
]);
export const reminderStatusEnum = pgEnum("reminder_status", [
  "pending",
  "sent",
  "failed",
  "skipped",
]);
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "pending",
  "paid",
  "partially_paid",
  "waived",
  "insurance_pending",
]);

/* --------------------------------- identity -------------------------------- */

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: userRoleEnum("role").notNull().default("patient"),
    passwordHash: text("password_hash").notNull(),
    // Synthetic-data guard: every seeded account is a demo identity.
    isSynthetic: boolean("is_synthetic").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    token: text("token").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/* --------------------------- approved clinic content ----------------------- */

/** Key/value facts about the clinic (hours, phone, address, services…). */
export const clinicInfo = pgTable("clinic_info", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  approval: policyApprovalEnum("approval").notNull().default("pending_owner_approval"),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

/** Approved FAQ entries. Unapproved rows are never served to patients. */
export const faqs = pgTable(
  "faqs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    category: text("category").notNull().default("general"),
    keywords: text("keywords").array().notNull().default([]),
    approval: policyApprovalEnum("approval").notNull().default("pending_owner_approval"),
    active: boolean("active").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("faqs_category_idx").on(t.category)],
);

/**
 * Deterministic safety policy. Rules are owner-approved configuration, kept
 * separate from business code on purpose. `approval` marks whether the rule
 * wording has clinic-owner sign-off; seeded demo rules are clearly
 * `pending_owner_approval`.
 */
export const redFlagRules = pgTable("red_flag_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  phrase: text("phrase").notNull(),
  category: text("category").notNull(),
  severity: text("severity").notNull().default("high"),
  escalationMessage: text("escalation_message").notNull(),
  approval: policyApprovalEnum("approval").notNull().default("pending_owner_approval"),
  active: boolean("active").notNull().default(true),
});

/* ------------------------------ clinic schedule ---------------------------- */

export const departments = pgTable("departments", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
});

export const providers = pgTable(
  "providers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    title: text("title").notNull().default(""),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
    specialty: text("specialty").notNull().default("General Medicine"),
    bio: text("bio").notNull().default(""),
    consultationFee: integer("consultation_fee").notNull().default(75),
    roomNumber: text("room_number").notNull().default("Consultation Room 1"),
    contactPhone: text("contact_phone").notNull().default("+1 (555) 010-4477"),
    contactEmail: text("contact_email").notNull().default("clinic@demo.clinic"),
    workingHours: text("working_hours").notNull().default("Mon–Fri 09:00–17:00"),
  },
  (t) => [index("providers_department_idx").on(t.departmentId)],
);

export const slots = pgTable(
  "slots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    startAt: timestamp("start_at", { withTimezone: true, mode: "date" }).notNull(),
    durationMin: integer("duration_min").notNull().default(30),
    status: slotStatusEnum("status").notNull().default("open"),
  },
  (t) => [
    index("slots_start_idx").on(t.startAt),
    index("slots_provider_idx").on(t.providerId),
  ],
);

/* ------------------------------- appointments ------------------------------ */

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id),
    slotId: uuid("slot_id")
      .notNull()
      .references(() => slots.id),
    reason: text("reason").notNull().default(""),
    status: appointmentStatusEnum("status").notNull().default("confirmed"),
    // Client-supplied idempotency key: duplicate submits return the original
    // booking instead of creating a second one.
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: "date" }),
    cancellationReason: text("cancellation_reason"),
    cancellationRequestedBy: text("cancellation_requested_by"),
    cancellationRequestedAt: timestamp("cancellation_requested_at", { withTimezone: true, mode: "date" }),
    cancellationReviewedBy: uuid("cancellation_reviewed_by").references(() => users.id),
    cancellationReviewedAt: timestamp("cancellation_reviewed_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [
    index("appointments_patient_idx").on(t.patientId),
    uniqueIndex("appointments_idempotency_idx").on(t.idempotencyKey),
    // One ACTIVE appointment per slot, enforced by the DB (cancelled rows
    // keep history without blocking re-booking of the slot).
    uniqueIndex("appointments_active_slot_idx")
      .on(t.slotId)
      .where(sql`status = 'confirmed'`),
  ],
);

/* ----------------------------- intake & summaries -------------------------- */

export const intakeSessions = pgTable(
  "intake_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    patientId: uuid("patient_id").references(() => users.id),
    // Validated structured extraction only (see IntakeExtraction zod schema).
    extraction: jsonb("extraction").notNull(),
    // short sha256 of the message for correlation without storing the body
    messageHash: text("message_hash").notNull(),
    flags: text("flags").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("intake_patient_idx").on(t.patientId)],
);

export const summaries = pgTable(
  "summaries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    intakeId: uuid("intake_id")
      .notNull()
      .references(() => intakeSessions.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id").references(() => users.id),
    draft: text("draft").notNull(),
    structured: jsonb("structured").notNull(),
    status: summaryStatusEnum("status").notNull().default("draft"),
    reviewerId: uuid("reviewer_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("summaries_status_idx").on(t.status)],
);

/* --------------------------- waitlist & reminders -------------------------- */

export const waitlist = pgTable(
  "waitlist",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id),
    status: waitlistStatusEnum("status").notNull().default("waiting"),
    offerSlotId: uuid("offer_slot_id").references(() => slots.id),
    offerExpiresAt: timestamp("offer_expires_at", { withTimezone: true, mode: "date" }),
    // Consent flag required before any notification workflow may contact them.
    contactConsent: boolean("contact_consent").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("waitlist_status_idx").on(t.status)],
);

export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    // Deterministic unique key prevents duplicate sends.
    eventKey: text("event_key").notNull(),
    channel: text("channel").notNull().default("mock"),
    status: reminderStatusEnum("status").notNull().default("pending"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true, mode: "date" }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [uniqueIndex("reminders_event_key_idx").on(t.eventKey)],
);

/* --------------------------------- auditing -------------------------------- */

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id"),
    actorRole: text("actor_role").notNull().default("system"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull().default(""),
    entityId: text("entity_id").notNull().default(""),
    // Small, non-sensitive structured context only — never message bodies.
    meta: jsonb("meta").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("audit_action_idx").on(t.action), index("audit_created_idx").on(t.createdAt)],
);

/* -------------------------- patient profiles ------------------------------- */

export const patientProfiles = pgTable(
  "patient_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dateOfBirth: text("date_of_birth").notNull().default(""),
    gender: text("gender").notNull().default("unspecified"),
    phone: text("phone").notNull().default(""),
    address: text("address").notNull().default(""),
    bloodGroup: text("blood_group").notNull().default(""),
    allergies: text("allergies").notNull().default("None reported"),
    emergencyContactName: text("emergency_contact_name").notNull().default(""),
    emergencyContactPhone: text("emergency_contact_phone").notNull().default(""),
    insuranceProvider: text("insurance_provider").notNull().default(""),
    insurancePolicyNumber: text("insurance_policy_number").notNull().default(""),
    medicalHistory: text("medical_history").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("patient_profiles_user_idx").on(t.userId)],
);

/* ----------------------- clinical visits & records ------------------------- */

export const visitRecords = pgTable(
  "visit_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id").references(() => appointments.id, {
      onDelete: "set null",
    }),
    visitDate: timestamp("visit_date", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    chiefComplaint: text("chief_complaint").notNull().default(""),
    vitals: jsonb("vitals").notNull().default({
      bloodPressure: "120/80",
      heartRate: "72 bpm",
      temperature: "98.6 °F",
      respiratoryRate: "16",
    }),
    clinicalNotes: text("clinical_notes").notNull().default(""),
    // Diagnosis is strictly rendered by human clinicians, never AI
    diagnosis: text("diagnosis").notNull().default(""),
    treatmentPlan: text("treatment_plan").notNull().default(""),
    prescriptions: jsonb("prescriptions").notNull().default([]),
    followUpInstructions: text("follow_up_instructions")
      .notNull()
      .default("Return as needed or if symptoms persist."),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("visit_records_patient_idx").on(t.patientId),
    index("visit_records_provider_idx").on(t.providerId),
  ],
);

/* --------------------------- billing & invoices --------------------------- */

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceNumber: text("invoice_number").notNull(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id").references(() => appointments.id, {
      onDelete: "set null",
    }),
    visitRecordId: uuid("visit_record_id").references(() => visitRecords.id, {
      onDelete: "set null",
    }),
    items: jsonb("items").notNull().default([]),
    totalAmount: integer("total_amount").notNull().default(0),
    status: invoiceStatusEnum("status").notNull().default("pending"),
    paymentMethod: text("payment_method").notNull().default("Unpaid"),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("invoices_number_idx").on(t.invoiceNumber),
    index("invoices_patient_idx").on(t.patientId),
  ],
);

/* -------------------------- in-app notifications --------------------------- */

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    message: text("message").notNull(),
    type: text("type").notNull().default("general"),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId)],
);

