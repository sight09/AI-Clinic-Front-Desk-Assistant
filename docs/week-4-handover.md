# Final handover (Week 4) — AI Clinic Front-Desk Assistant

## 1. Repository state

- Branch: `main` (no git history in the sandbox; suggested single final commit below).
- Environment: Next.js 16 + PostgreSQL (Drizzle) + zod + Vitest. No extra infrastructure.

## 2. What works (executed, not assumed)

| Feature | Where | Proof |
|---|---|---|
| Approved FAQ + safe fallback | `src/lib/faq/service.ts`, chat UI tags | eval FAQ-01…06 (6/6) |
| Structured intake, missing stays missing | `src/lib/intake/extract.ts` | eval INT-01…06 (6/6), unit tests |
| Deterministic safety escalation pre-LLM | `src/lib/safety/redflags.ts` + pipeline | eval RF-01…08 (8/8) |
| Real booking: lock, revalidate, idempotent, conflict 409 | `src/lib/booking/service.ts` | eval BKG-01…06 (6/6) + DB constraints |
| Clinician DRAFT summaries + enforced human review | `src/lib/summary/service.ts`, review route | AUT-01/02, SEC-03; UI review queue |
| Failure fallbacks (timeout, malformed, misconfig) | `src/lib/llm/provider.ts` | eval PRV-01…05 (5/5) |
| Injection resistance | `src/lib/safety/guard.ts` | eval INJ-01…06 (6/6) |
| Auth/roles/ownership | `src/lib/auth/service.ts` | eval AUT-01…04 (4/4) |
| Privacy/logging hygiene | guard + audit design | eval SEC-01…03 (3/3) |
| Automation: mock reminders + consent waitlist | booking service | unit + manual flows |

**Unit tests: 42/42. Evaluation suite: 44/44 (100%), 0 critical failures.** Commands in `docs/test-plan.md`.

## 3. API contracts

See `docs/api-contracts.md` — all routes implemented exactly as documented; no PROPOSED contracts remain.

## 4. Safety items AWAITING OWNER APPROVAL (blocks production)

1. Red-flag phrase list + escalation wording (demo placeholder, visibly labelled `pending_owner_approval`).
2. `clinic_info.emergency_guidance` — no real emergency number configured (deliberately).
3. Demo FAQ corpus approval for a real clinic.
4. Real notification channel + consent wording.

## 5. Environment variable NAMES (values never shared)

`DATABASE_URL`, `AI_PROVIDER`, `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `AI_TIMEOUT_MS`, `AI_MAX_RETRIES`, `SEED_DEMO_PASSWORD`.

## 6. Deferred / known risks

1. Real reminder delivery (mock channel only — by design until a channel is approved).
2. Demo-grade auth (no MFA/password reset/SSO).
3. Keyword screening recall limit — disclosed in UI/docs/eval (no-match ≠ safe).
4. Chat history not persisted (minimisation choice).
5. Rule config cache (30 s TTL).

### Post-release auth hardening (found via user report, verified & fixed)

- **Symptom**: sign-in "did nothing" for all roles in the hosted preview.
- **Root causes found**: (a) `Secure` cookies keyed off `NODE_ENV=production` are silently dropped over plain-http production runs; (b) `SameSite=Lax` cookies are blocked when the preview runs inside a third-party iframe (hosted sandboxes), so no session ever persisted; (c) the app server cannot see the external scheme behind the preview proxy.
- **Fix**: cookie issuance now follows the protocol the *browser* reports from the login page: https → `SameSite=None; Secure; Partitioned` (CHIPS, survives iframe embedding); http → `SameSite=Lax` (localhost-safe). Hard navigation after login. Client-side sign-out (no more raw JSON page). Iframe detection banner with an "open in a new tab" escape hatch (covers Safari's strict third-party cookie blocking).
- **Self-healing boot** (`src/instrumentation.ts` + `src/lib/bootstrap.ts`): if a fresh/empty database ever comes up, the server applies `drizzle/*.sql` and the synthetic demo seed at startup so demo accounts always exist. Idempotent, never blocks boot.
- Verified: login + staff access over http, https-forwarded, and public preview URL; logout invalidates; regression 36/36 unit + 44/44 eval still green.

## 7. Three highest-priority next tasks

1. Get clinic-owner sign-off on safety policy + FAQ corpus; replace placeholder wording; re-run eval.
2. Wire an approved notification provider behind the existing reminder state machine; add cron dispatch.
3. Harden auth for production (login rate limiting, reset flow, optionally SSO for staff).

## 8. Suggested final commit message

```
feat: AI Clinic Front-Desk Assistant — final submission

- Approved-FAQ grounding with safe fallback
- Strict-schema intake extraction (missing stays missing) + deterministic
  clinician summary drafts with enforced human review
- Deterministic, owner-configurable red-flag escalation running pre-LLM
- Transactional booking with idempotency + conflict safety; waitlist offers
  with expiry; cancellation-aware mock reminders
- LLM provider wrapper (mock default, OpenAI-compatible live mode) with
  timeouts, bounded retries and safe error normalisation
- Injection guards, role/ownership enforcement, minimal audit, log redaction
- 42 unit tests + 44-case executed evaluation suite (100% pass, 0 critical)
- Full docs: scope, architecture, API contracts, prompts, safety & privacy,
  test plan, evaluation results, decisions
```

## 9. Demo script (2–3 minutes)

1. State up-front: administrative assistant, not a doctor.
2. FAQ grounded answer → FAQ fallback → explain the grounding tag.
3. Intake: full message then partial message — missing info stays missing; show DRAFT summary.
4. Booking from live slots; show idempotent double-submit; then a conflict as second patient.
5. Staff console: approve/reject the draft; reject an unauthorized attempt as patient2.
6. Red-flag message → escalation interrupt + disclaimer + (visible) pending-approval note.
7. Run the evaluation suite live in the dashboard; show 44/44 and one limitation (e.g., keyword recall).

## 10. What I (the participant) should be able to explain

- **Pipeline order matters**: safety scan *before* the LLM `→` intent routing `→` grounded FAQ/intake/booking; nothing user-controlled can skip a stage.
- **Why summaries are deterministic templates**: fidelity + zero hallucination surface; the DRAFT label and one-way review transitions are enforced by the database, not the prompt.
- **How booking is race-safe**: `SELECT … FOR UPDATE` + unique constraints + idempotency keys; retried submissions return the original appointment.
- **How the provider wrapper isolates the LLM**: timeout + bounded transient retries + `AppError` normalisation + mock provider for tests; business logic never imports a vendor SDK.
- **Safety model**: keyword policy is owner configuration; non-match is disclosed as not-proof-of-safety; false negatives are a documented, accepted limitation — not hidden.
- **Testing honesty**: eval cases execute real functions; critical failures fail the script; results were regenerated after the two defects found (transposition matching, FAQ synonym scoring) were fixed.
