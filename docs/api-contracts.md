# API contracts

All routes communicate over JSON. Errors share one consistent shape:

```json
{ "error": { "code": "conflict", "message": "user-safe message" } }
```

Auth = httpOnly `clinic_session` cookie. Role and ownership guards are strictly enforced server-side.

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /api/auth/login` | public | `{email, password}` → `{user}`; sets session cookie |
| `POST /api/auth/register` | public | Self-registration for new patients + profile initialization |
| `POST /api/auth/logout` | session | Destroys session and clears cookie |
| `GET  /api/auth/me` | session | Returns current `{user}` or `{user: null}` |
| `GET  /api/patient/profile` | session | Get patient medical profile (self or staff querying patientId) |
| `POST /api/patient/profile` | session | Update personal details, allergies, emergency contacts, insurance |
| `POST /api/assistant/chat` | guest OK* | Front-desk AI assistant pipeline (grounded FAQ, triage, booking) |
| `GET  /api/health` | public | `{ok: true}` DB probe |
| `GET  /api/faqs` | public | Approved and active FAQs only |
| `POST /api/faqs` | admin | Create FAQ → starts as `pending_owner_approval` |
| `GET  /api/availability?departmentId=` | session | Live open slots + departments |
| `GET  /api/providers` | session | Provider directory with specialties, fees, and slot counts |
| `POST /api/providers/[id]/schedule` | staff | Add new doctor availability slot |
| `GET  /api/appointments` | session | Own appointments for patients; full queue for staff |
| `POST /api/appointments` | patient | Book `{slotId, reason, idempotencyKey}` |
| `POST /api/appointments/[id]/status` | staff | Update appointment status (`checked_in`, `in_consultation`, `completed`, `cancelled`, `no_show`) |
| `POST /api/appointments/[id]/cancel` | owner/staff | Cancel; reopens slot; offers waitlist |
| `GET  /api/records` | session | Clinical visit records (patient views own; staff views all/by patient) |
| `POST /api/records` | staff | Document clinical consultation, vitals, doctor diagnosis, and prescriptions |
| `GET  /api/billing` | session | Invoices list; staff gets clinic-wide accounts receivable summary |
| `POST /api/billing` | staff | Generate clinic invoice for services/consultations |
| `POST /api/billing/[id]/pay` | owner/staff | Record payment (Cash, POS Card, Digital Wallet, Insurance) |
| `GET  /api/notifications` | session | Fetch in-app notifications and unread count |
| `POST /api/notifications` | session | Mark notification(s) as read |
| `GET  /api/summaries?status=` | clinician/admin | Review queue for AI-generated intake drafts |
| `POST /api/summaries/[id]/review` | clinician/admin | `{decision: approved\|rejected, note?}` |
| `GET  /api/waitlist` | session | Own (or all for staff) waitlist entries |
| `POST /api/waitlist` | patient | Join waitlist `{departmentId, contactConsent}` |
| `POST /api/waitlist/[id]/respond` | patient (owner) | Respond to offer `{accept, idempotencyKey}` |
| `POST /api/reminders/dispatch` | staff | Dispatch due reminders (mock channel) |
| `GET  /api/staff/overview` | staff | Operational KPI dashboard metrics, revenue, audit log |
| `POST /api/eval/run` | staff | Run the 44-case automated safety regression suite |

\* Guests can only receive grounded FAQ/fallback/escalation responses; structured intake and booking require sign-in (response type `auth_required` signals this to the UI).

---

## `POST /api/assistant/chat`

Request:

```json
{ "message": "I'd like to book an appointment" }
```

Response variants:

```jsonc
// Grounded FAQ
{ "type": "faq", "message": "…answer…", "grounded": true, "faqId": "…", "score": 0.82, "requestId": "…" }

// Safe fallback
{ "type": "fallback", "message": "…safe fallback…", "grounded": false, "requestId": "…" }

// Safety escalation (interrupts routine flow immediately)
{
  "type": "escalation",
  "message": "…configured message…",
  "rule": { "phrase": "chest pain", "category": "cardiac", "approvalNote": "…" },
  "disclaimer": "Automated keyword screening only: no match does NOT mean a person is safe.",
  "requestId": "…"
}

// Intake extraction card
{
  "type": "intake",
  "message": "…",
  "intakeId": "…",
  "summaryId": "…",
  "extraction": {
    "reason_for_visit": "headache",
    "symptoms_as_reported": ["headache", "mild pressure"],
    "duration_as_reported": "3 days",
    "severity_as_reported": "mild",
    "missing_information": []
  },
  "summaryDraft": "PATIENT INTAKE SUMMARY (DRAFT)…"
}

// Live availability slot cards
{
  "type": "booking",
  "slots": [
    { "slotId": "uuid", "startAt": "2026-10-24T09:00:00Z", "providerName": "Dr. Ada Okoro", "departmentName": "General Practice" }
  ],
  "idempotencySeed": "idem-uuid"
}
```
