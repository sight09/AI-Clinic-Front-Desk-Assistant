# Architecture

## Component overview

```
┌──────────────────────── Next.js 16 (App Router) ────────────────────────┐
│                                                                          │
│  Patient portal (RSC)        Staff console (RSC gate + client)           │
│  /, /login                   /staff                                      │
│       │                          │                                       │
│       ▼ fetch                    ▼ fetch                                 │
│  ┌──────────────────────── Route handlers (/api/*) ──────────────────┐   │
│  │  auth/[action]  assistant/chat  availability  appointments(+cancel)│  │
│  │  summaries(+review)  waitlist(+respond)  reminders/dispatch        │  │
│  │  faqs  staff/overview  eval/run  health                            │  │
│  └──────┬───────────────────────────────────────────────────────────┘    │
│         ▼                                                                │
│  ┌── assistant/pipeline ── fixed request flow ─┐                         │
│  │ rate limit → validate → injection guard →   │                         │
│  │ SAFETY SCAN (deterministic, pre-LLM) →      │                         │
│  │ intent routing → FAQ / intake / booking     │                         │
│  └──┬────────┬─────────┬──────────┬────────────┘                         │
│     ▼        ▼         ▼          ▼                                        │
│  faq/     intake/   booking/  llm/provider (server-side only)             │
│  service  extract   service   mock | openai-compatible                    │
│     │        │      + waitlist/reminders                                   │
│     └────────┴─────────┴──────────────────┐                                │
│                                           ▼                                │
│                            Drizzle ORM ── PostgreSQL                       │
└──────────────────────────────────────────────────────────────────────────┘
```

## Request flow (assistant chat)

1. `POST /api/assistant/chat` — session user resolved (guests allowed for pure FAQ).
2. `checkRateLimit` — 20 msgs/min per user in-memory bucket.
3. `inspectMessage` — zod-free but strict: type, non-empty, ≤2000 chars; regex-based injection flags.
4. Injection flags → deterministic refusal + minimal audit (hash only, never the body).
5. `scanForRedFlags` — deterministic matcher over `red_flag_rules` (30 s cache). Match → configured escalation message + audit; **bypasses all other stages**.
6. `classifyIntent` — deterministic keyword routing (`booking` | `intake` | `faq`).
   - booking → auth required → `listAvailability` (live DB rows only; the assistant cannot invent slots).
   - intake → auth required → `extractIntake` (LLM strict JSON, or rule-based fallback) → store extraction (not the raw text) → deterministic **DRAFT** summary.
   - faq → `answerFromCorpus` (approved+active rows only) → grounded answer or safe fallback.
7. Response shape is one of 8 typed variants (`AssistantResponse`), each with a `requestId`.

## Trust boundaries

- **Browser ↔ server**: all business rules live server-side. UI confirmation UX is a convenience; the transaction in `bookAppointment` is the authority.
- **LLM is untrusted**: model output passes strict zod validation; computed fields (missing info, clarification) are recomputed deterministically; model text is treated as data wrapped in `<patient_message>` delimiters.
- **User input is untrusted**: size-capped, scanned for injection, never logged in full (sha256 hash only for correlation).
- **Secrets**: only `process.env` server-side; nothing `NEXT_PUBLIC_*`; `.env` git-ignored.

## Failure paths

| Failure | Behaviour |
|---|---|
| LLM timeout/unavailable/misconfigured | `AppError` normalisation → intake falls back to deterministic rule pass; chat keeps working |
| LLM malformed JSON / wrong schema | rejected → rule-based fallback (never trusted) |
| DB unique violation (race on slot) | 409 safe message; idempotency key returns original booking |
| Provider key missing | `provider_misconfigured` → safe fallback, no crash |
| Oversized / empty / non-string input | 400 with safe message |
| Rate limit | 429 with safe message |
| Cancelled appointment with pending reminder | reminder `skipped` before send |
| Waitlist offer expiry / slot taken | transition rejected, state corrected |

## Data model (PostgreSQL via Drizzle)

`users`, `sessions`, `clinic_info`, `faqs`, `red_flag_rules` (policy config), `departments`, `providers`, `slots`, `appointments` (unique `slot_id` + unique `idempotency_key`), `intake_sessions` (structured JSON + hash), `summaries` (draft/approved/rejected), `waitlist`, `reminders` (unique `event_key`), `audit_logs` (minimal meta only).
