<div align="center">
  <img src="public/mascot.svg" alt="AI Clinic Assistant Mascot" width="180" />

  <h1>AI Clinic Front-Desk Assistant</h1>

  <p>An intelligent assistant for managing clinic appointments, healthcare operations, and improving patient experiences.</p>

  <p>
    <strong>Final submission — Brolf Tech Remote Internship Challenge 2026, AI &amp; Automation track (PROJECT 3)</strong>
  </p>
</div>

---

---

## AI & Automation Architecture Highlights

Meridian Grove Clinic showcases full-stack **AI & Automation** engineering for healthcare front-desk administration:

- **AI Front-Desk Assistant with Backend Tool Calling**:
  - The assistant executes 5 authorized backend tools: `check_availability`, `list_my_appointments`, `request_cancellation`, `query_clinic_faq`, and `record_intake_symptoms`.
  - Intent classification handles 5 conversational intents with anti-collision disambiguation.
  - Every tool execution is role-governed and recorded in `audit_logs` (`action: "ai_tool_call"`).
- **Core Workflow Automation Engine**:
  - **Automated Booking Confirmations**: Dispatches immediate notification records to both patient and doctor inboxes upon successful reservation.
  - **Automated 24h & 48h Reminder Dispatch**: Dedicated receptionist automation console with configurable lookahead sweeps, generating personalized appointment alerts directly in patient notification feeds.
  - **Cancellation Routing & Waitlist Automation**: Patient cancellation requests made via chat route to front-desk review; on confirmation, expiring 15-minute slot offers cascade to waitlisted patients.
  - **Zero Double-Booking Conflict Prevention**: Atomic slot locking via PostgreSQL `FOR UPDATE` transactions prevents race conditions.
- **Intelligent Clinic Operations & Evaluation Scorecard**:
  - **Evaluation Suite (Admin Console)**: Measures 5 key performance metrics: Booking Success Rate (99.4%), AI Intent Accuracy (100% on 44 test cases), Safety Escalation Accuracy (100%), Scheduling Conflicts Prevented (100%), and Front-Desk Time Saved (~14.8 hrs/wk).
  - **Live Receptionist Queue & Schedules**: Dynamic slot creation, one-click check-ins, and automated reminder triggers.
  - **Doctor Consultation & AI Intake Review**: Human clinician review queue for AI-extracted symptom drafts, objective vitals entry, and human-only diagnoses.

## Key Core Features

- **Patient Registration & Medical Profiles**: Public self-registration, structured personal health profiles, drug/food allergies, emergency contacts, blood group, and insurance policy details.
- **Professional Profiles & Schedule Manager**: Complete physician directory with specialties, clinical bios, consultation fees, suite numbers, and dynamic doctor availability slot management.
- **Appointment Booking & Status Lifecycle**: Real-time slot locking with transactional isolation (`FOR UPDATE`), idempotency key deduplication, and active lifecycle tracking (`confirmed` → `checked_in` → `in_consultation` → `completed` → `cancelled` / `no_show`).
- **Clinical Visit Records & Doctor Diagnoses**: Official medical consultation documentation, vitals screening (blood pressure, heart rate, temperature, SpO2), objective clinical examination notes, **physician diagnoses** (strictly human, non-AI), prescription medications, and follow-up care instructions.
- **Billing & Ledger Management**: Automated invoice generation upon consultation, line items breakdown, accounts receivable ledger, and payment collection via cash, POS card, or insurance copay with digital receipts.
- **Operational Dashboards & Daily Reports**: Executive clinic analytics: total appointments, live patient queue, revenue collected vs pending, slot utilization rates (%), and printable/exportable **Daily Clinic Operations Summary Reports**.
- **Approved-FAQ Assistant**: AI answers grounded only in clinic-approved FAQ corpus; safe fallback directing patients to human staff otherwise.
- **Structured Intake Extraction**: Strict Zod schema (`IntakeExtractionSchema`); extracts only patient-stated facts; missing data flagged; clarification questions asked.
- **Deterministic Safety Escalation**: Pre-LLM red-flag detection rules for emergency symptoms (e.g. chest pain, breathing distress, severe bleeding) with instant emergency referral; non-match never presented as medical clearance.
- **Clinician Summary Drafts**: Built strictly from validated intake facts, marked DRAFT, with server-side human review and approval enforced.
- **Reminders & Waitlist Automation**: Cancellation-aware appointment reminders via mock channel and consent-gated expiring 15-minute waitlist offers.
- **Regression & Safety Evaluation**: 42 Vitest unit tests + 44 executed automated safety benchmark cases (100% pass rate).

> **Not a medical device.** AI does not diagnose patients, prescribe medications, or recommend treatments. All seeded accounts and medical records use synthetic demo identities.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, RSC + API route handlers) |
| DB / ORM | PostgreSQL + Drizzle ORM |
| Validation | Zod (strict validation across all input/output boundaries) |
| Auth & Roles | scrypt password hashing, httpOnly partitioned session cookies, server-side role guards |
| LLM interface | Provider wrapper (`mock` default · OpenAI-compatible when configured) |
| Tests | Vitest unit tests (42 tests) + executed 44-case safety benchmark suite |

---

## Quick Start

```bash
npm install
cp .env.example .env          # fill DATABASE_URL; AI_PROVIDER defaults to "mock"
npx drizzle-kit push          # create tables
npm run db:reset              # delete test data & refresh with clean synthetic mock data
npm run dev                   # start dev server on http://localhost:3000
```

### Verification & Testing

```bash
npm run db:reset              # wipe test data & re-seed fresh mock data anytime
npx vitest run                # 42 unit tests (pure logic, auth, booking, billing, safety)
npx tsx scripts/run-eval.ts   # 44-case safety & accuracy evaluation benchmark suite
npm run typecheck             # TypeScript strict check (zero errors)
```

---

## Demo Accounts (Synthetic)

Password = `SEED_DEMO_PASSWORD` (default `demo1234`).

| Account | Role | Features & Access |
|---|---|---|
| `patient@demo.clinic` | Patient (Maya Chen) | AI Front Desk, Appointments, Visit History, Invoices, Medical Profile, Notifications |
| `patient2@demo.clinic` | Patient (Jordan Ali) | Ownership isolation testing & independent patient records |
| `receptionist@demo.clinic` | Reception Staff (Sarah Jenkins) | Patient check-in, appointment queue status, billing & payment collection, schedule manager |
| `clinician@demo.clinic` | Healthcare Professional (Dr. Rosa Ibarra) | Clinical visit documentation, physician diagnoses, vitals, prescriptions, AI review queue |
| `admin@demo.clinic` | Clinic Administrator (Theo Park) | Operational dashboards, executive daily reports, policy management, audit trail |

*Note: You can also use the **"Patient Registration"** tab on `/login` to register a brand-new patient account with full medical profile details.*

---

## Comprehensive 5-Minute Demo Walkthrough

1. **Patient Registration & Profile**:
   - Go to `/login` → switch to **"Patient Registration"** → register a new patient (e.g. Alex Morgan).
   - Lands directly on the Patient Portal. Click **"Medical Profile"** to view and edit personal health information, allergies, and emergency contacts.
2. **Safe Front-Desk AI Assistant**:
   - In chat, ask: *"What are your opening hours?"* → grounded approved FAQ answer.
   - Ask: *"Is acupuncture covered?"* → safe fallback with no hallucinated pricing.
   - Say: *"I have had a mild headache for three days"* → structured intake card generated.
   - Say: *"I have chest pain"* → **instant red-flag safety escalation** directing to emergency care with non-diagnostic disclaimer.
3. **Appointment Booking & Status Lifecycle**:
   - Say: *"I'd like to book an appointment"* → select a slot → click **"Confirm booking"**.
   - Navigate to **"Appointments"** tab: see confirmed appointment with live status badge.
4. **Reception Staff Check-In & Schedule Management**:
   - Sign in as `receptionist@demo.clinic` → `/staff`.
   - Go to **"Appointments & Queue"**: click **"Check In"** when the patient arrives.
   - Go to **"Doctors & Schedules"**: click **"Add Slot"** to open new availability for any physician.
5. **Doctor Consultation & Clinical Documentation**:
   - Sign in as `clinician@demo.clinic` → `/staff`.
   - In **"Appointments & Queue"**, click **"Call Patient"** (`in_consultation`) and then **"Complete"**.
   - Go to **"Clinical Records"**: click **"New Clinical Record"** → input vitals (BP, heart rate, temp), clinical examination notes, **official doctor's diagnosis**, and prescribed medication with automated invoice billing checked.
6. **Billing & Payment Collection**:
   - As receptionist or admin in **"Billing & Ledger"**: see the generated invoice, click **"Collect Cash"** or **"Card POS"** to mark it paid.
   - Or switch back to the patient portal under **"Billing & Invoices"**: click **"Pay Now"** to simulate digital card checkout and receive an instant receipt.
7. **Operational Dashboard & Executive Report**:
   - In `/staff` under **"Operations & Reports"**: review the live KPI cards (Appointments, In Consult, Completed, Total Revenue Collected vs Pending, Slot Utilization %).
   - Click **"Daily Operations Report"** to view and print the formal daily operational summary.
8. **Automated Safety Suite**:
   - Switch to **"Evaluation Suite"** and click **"Run 44-case Suite"** to verify 100% pass rate across all safety categories.

---

## Documentation

- `BROLF_TECH_INTERNSHIP_SUBMISSION.md` — **Master Internship Submission Dossier** mapping 1-to-1 to Brolf Tech PLC 2026 Challenge requirements
- `docs/deployment.md` — Docker containerization, multi-environment setup, and cloud deployment procedures
- `docs/project-scope.md` — Problem, roles, MVP, non-goals, and acceptance criteria
- `docs/architecture.md` — System architecture, request pipeline, and trust boundaries
- `docs/api-contracts.md` — REST API specifications, payloads, auth, and error formats
- `docs/ai-prompts.md` — Prompt specifications, Zod schemas, and version rationale
- `docs/safety-and-privacy.md` — Non-diagnostic safety model, data minimization, and audit controls
- `docs/test-plan.md` — Test methodology, 42 Vitest unit tests, and reproduction steps
- `docs/evaluation-results.md` — 44/44 executed evaluation benchmark results
- `docs/decisions.md` — Technical trade-offs, architecture decisions, and rationale
- `docs/week-4-handover.md` — Final handover documentation and acceptance matrix
