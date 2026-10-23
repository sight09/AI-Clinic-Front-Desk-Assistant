ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'receptionist';
--> statement-breakpoint
ALTER TYPE "public"."appointment_status" ADD VALUE IF NOT EXISTS 'checked_in';
--> statement-breakpoint
ALTER TYPE "public"."appointment_status" ADD VALUE IF NOT EXISTS 'in_consultation';
--> statement-breakpoint
ALTER TYPE "public"."appointment_status" ADD VALUE IF NOT EXISTS 'completed';
--> statement-breakpoint
ALTER TYPE "public"."appointment_status" ADD VALUE IF NOT EXISTS 'no_show';
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."invoice_status" AS ENUM('pending', 'paid', 'partially_paid', 'waived', 'insurance_pending');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "specialty" text DEFAULT 'General Medicine' NOT NULL;
--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "bio" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "consultation_fee" integer DEFAULT 75 NOT NULL;
--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "room_number" text DEFAULT 'Consultation Room 1' NOT NULL;
--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "contact_phone" text DEFAULT '+1 (555) 010-4477' NOT NULL;
--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "contact_email" text DEFAULT 'clinic@demo.clinic' NOT NULL;
--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "working_hours" text DEFAULT 'Mon–Fri 09:00–17:00' NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "patient_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"date_of_birth" text DEFAULT '' NOT NULL,
	"gender" text DEFAULT 'unspecified' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"blood_group" text DEFAULT '' NOT NULL,
	"allergies" text DEFAULT 'None reported' NOT NULL,
	"emergency_contact_name" text DEFAULT '' NOT NULL,
	"emergency_contact_phone" text DEFAULT '' NOT NULL,
	"insurance_provider" text DEFAULT '' NOT NULL,
	"insurance_policy_number" text DEFAULT '' NOT NULL,
	"medical_history" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "patient_profiles_user_idx" ON "patient_profiles" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visit_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"provider_id" uuid NOT NULL REFERENCES "providers"("id") ON DELETE CASCADE,
	"appointment_id" uuid REFERENCES "appointments"("id") ON DELETE SET NULL,
	"visit_date" timestamp with time zone DEFAULT now() NOT NULL,
	"chief_complaint" text DEFAULT '' NOT NULL,
	"vitals" jsonb DEFAULT '{"bloodPressure":"120/80","heartRate":"72 bpm","temperature":"98.6 °F","respiratoryRate":"16"}'::jsonb NOT NULL,
	"clinical_notes" text DEFAULT '' NOT NULL,
	"diagnosis" text DEFAULT '' NOT NULL,
	"treatment_plan" text DEFAULT '' NOT NULL,
	"prescriptions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"follow_up_instructions" text DEFAULT 'Return as needed or if symptoms persist.' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visit_records_patient_idx" ON "visit_records" ("patient_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visit_records_provider_idx" ON "visit_records" ("provider_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"patient_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"appointment_id" uuid REFERENCES "appointments"("id") ON DELETE SET NULL,
	"visit_record_id" uuid REFERENCES "visit_records"("id") ON DELETE SET NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_amount" integer DEFAULT 0 NOT NULL,
	"status" "invoice_status" DEFAULT 'pending' NOT NULL,
	"payment_method" text DEFAULT 'Unpaid' NOT NULL,
	"paid_at" timestamp with time zone,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_number_idx" ON "invoices" ("invoice_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_patient_idx" ON "invoices" ("patient_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" text DEFAULT 'general' NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_idx" ON "notifications" ("user_id");
