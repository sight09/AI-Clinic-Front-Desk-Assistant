# Project scope — Clinic & Appointment Management System

_Brolf Tech Remote Internship Challenge 2026 · AI & Automation track · PROJECT 3_

## User Problem

Clinic operations are burdened by fragmented workflows: front-desk receptionist staff balance phone triage and manual check-ins, doctors need structured intake and clinical documentation, patients need real-time appointment booking and access to their visit records and billing, and administrators need operational dashboards and throughput analytics.

## Supported Roles & Capabilities

| Role | Core Capabilities (Enforced Server-Side) |
|---|---|
| `patient` | Self-registration, front-desk AI assistant, appointment booking, live appointment status tracking, personal medical profile management, visit history & doctor diagnoses, billing & digital receipts, in-app notifications |
| `receptionist` | Patient check-in upon arrival, appointment status lifecycle management, doctor schedule management, front-desk billing and payment collection (cash/card/insurance), operational queue management |
| `clinician` (doctor) | Clinical documentation: consultation records, physician diagnoses (strictly human, non-AI), vitals tracking, prescriptions, review/approval of AI intake summary drafts, doctor schedule management |
| `admin` | Full clinic administrative control: operational KPI dashboards, printable executive reports, red-flag safety policy configuration, doctor and department management |

## Core Features Implemented

1. **Patient Registration & Medical Profiles**
   - Public self-registration API and UI (`/login` registration tab).
   - Structured `patient_profiles` table: DOB, gender, phone, address, blood group, drug/food allergies, emergency contacts, insurance provider and policy number.
   - Patient-editable profile with immediate database synchronization.

2. **Professional Profiles & Schedule Management**
   - Detailed provider profiles: specialties, clinical biographies, room/suite numbers, direct contact details, consultation fees, and working hours.
   - Dynamic schedule management: staff can add doctor availability slots directly from the dashboard.

3. **Appointment Booking & Status Lifecycle**
   - Live availability lookup, transactional booking with PostgreSQL row-level locks (`FOR UPDATE`), idempotency key deduplication, and active-slot uniqueness.
   - Comprehensive status lifecycle: `confirmed` → `checked_in` (patient arrives) → `in_consultation` (with physician) → `completed` (finished) → `cancelled` / `no_show`.

4. **Visit History & Clinical Records Management**
   - Structured `visit_records` table linking patient, provider, and appointment.
   - Records include: chief complaint, objective vitals (blood pressure, heart rate, temperature, respiratory rate, SpO2), clinical examination notes, **official physician diagnosis** (strictly human-made, non-AI), prescription medications, and follow-up guidance.
   - Full chronological visit history accessible to patients in their portal and clinicians in their console.

5. **Billing & Payment Records**
   - Structured `invoices` table with unique invoice numbers (`INV-YYYY-XXXX`).
   - Line items, consultation fees, and payment statuses (`pending`, `paid`, `waived`, `insurance_pending`).
   - Patient online payment simulator with digital receipt generation.
   - Reception staff cash/card/insurance payment recording and revenue tracking.

6. **Operational Dashboards & Daily Reports**
   - Executive KPIs: Total appointments, checked-in count, in-consultation count, completed visits, revenue collected, outstanding accounts receivable, and slot utilization rate (%).
   - Live patient queue visualization with one-click status transitions.
   - Printable / exportable **Daily Clinic Operations Summary Report** modal.

7. **AI & Automation (Safety-Compliant)**
   - **Approved FAQ assistant**: answers strictly grounded in clinic-approved FAQs with safe fallbacks.
   - **Structured intake extraction**: Zod schema extracting only patient-stated facts; missing details flagged.
   - **Deterministic safety escalation**: DB-configured red-flag rules run before any LLM call; instant escalation for urgent symptoms with disclaimer.
   - **Clinician summary drafts**: DRAFT tag enforced; human review and approval required.
   - **Cancellation-aware reminders**: mock channel with unique event keys.
   - **Consent-aware waitlist**: expiring 15-minute slot offers upon cancellation.

## Non-Goals & Strict Safety Guardrails

- **No AI Diagnosis or Medical Treatment**: The assistant never presents itself as a doctor, diagnoses illnesses, or recommends drug dosages.
- **Data Minimization**: Free-text intake chat messages are not persisted raw; only validated structured extractions are stored.
- **Synthetic Data Guard**: All seeded accounts, providers, and patient profiles are synthetic demo identities.

## Acceptance Criteria & Verification

| Requirement Area | Implementation & Evidence | Status |
|---|---|---|
| User Roles & Auth | `src/lib/auth/service.ts`, `patient`, `clinician`, `admin`, `receptionist` | PASS |
| Patient Registration & Profiles | `src/app/api/auth/[action]/route.ts`, `patient_profiles` table | PASS |
| Professional Profiles & Schedules | `src/app/api/providers/route.ts`, `providers` table, schedule manager | PASS |
| Appointment Lifecycle | `src/app/api/appointments/[id]/status/route.ts`, lifecycle statuses | PASS |
| Clinical Visit Records | `src/app/api/records/route.ts`, `visit_records` table, vitals & prescriptions | PASS |
| Billing & Payments | `src/app/api/billing/route.ts`, `invoices` table, payment processing | PASS |
| Operational Dashboards | `src/app/api/staff/overview/route.ts`, KPI metrics, daily report printer | PASS |
| AI Safety & Red Flags | `src/lib/safety/redflags.ts`, 44/44 eval suite passing (100%) | PASS |
| Automated Unit Tests | 42 unit tests passing via Vitest (`tests/*.test.ts`) | PASS |
