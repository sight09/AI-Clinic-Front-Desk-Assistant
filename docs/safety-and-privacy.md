# Safety & privacy

## Non-negotiable product rules

1. The assistant is **administrative only** — no diagnosis, prescriptions, dosing or treatment advice, ever.
2. **No-match is never clearance.** Every safety scan result carries the disclaimer: *"Automated keyword screening only: no match does NOT mean a person is safe."*
3. Red-flag matches **interrupt** the routine flow (FAQ/intake/booking) with the configured escalation message; they never quietly continue.
4. Clinical-looking AI content (intake summaries) is a **draft** until an authorised clinician approves it — enforced server-side with one-way state transitions.
5. Synthetic data only. No real patient records may be entered or seeded.

## Red-flag system

- **Configuration, not code**: rules live in `red_flag_rules` (`phrase`, `category`, `severity`, `escalationMessage`, `approval`, `active`). Business code only executes the matcher.
- **Matcher** (`src/lib/safety/redflags.ts`): normalisation (case/diacritics/punctuation), synonym map, transposition-aware fuzzy matching (edit distance ≤ 1–2 for longer words — catches "bretahing"), ordered multi-word matching with a bounded filler gap, and negation aborts for benign phrasing ("chest looks fine and pain was never an issue").
- **Runs before the LLM**: the scan executes before any model call and before intent routing.
- **False negatives are disclosed**, not hidden: keyword systems miss things; the limitation is stated in the UI, README, eval report and this document.

## ⚠ Content requiring CLINIC-OWNER approval before production use

| Item | Current state |
|---|---|
| Escalation message wording | **DEMO placeholder** — seeded rules carry `approval = pending_owner_approval`; the prefix "[DEMO POLICY — PENDING CLINIC-OWNER APPROVAL]" is intentional and visible |
| Red-flag phrase list & synonyms | Demo set only (cardiac, respiratory, trauma, mental-health, neuro) |
| `clinic_info.emergency_guidance` | No real emergency number configured — deliberately not invented |
| FAQ corpus | Demo set marked `approved` **for the fictional demo clinic**; a real clinic must re-approve |
| `SEED_DEMO_PASSWORD` | Demo credential for synthetic accounts |

Policy-dependent flows are **blocked for production** until the owner signs off. This is exactly the "configurable placeholder" posture required — nothing clinical was invented.

## Privacy & data minimisation

- **Raw intake/chat text is not persisted.** We store the validated structured extraction + a sha256 hash of the message for correlation, plus derived audit rows.
- **Audit rows are minimal**: actor id/role, action, entity id, timestamp, small structured meta (slot id, flags, counts) — never message bodies or credentials.
- **Logs**: `redactForLog` strips bearer-like tokens and caps length; errors normalised to safe codes without stack traces/secrets.
- **Record ownership**: `assertOwnership` — patients read/modify only their own records; staff roles checked per route.
- **Sessions**: httpOnly, `sameSite=lax`, `secure` in production, 7-day expiry, server-side revocation.
- **Secrets**: `.env` git-ignored; `.env.example` holds placeholders only; no `NEXT_PUBLIC` secrets.

## Consent & automation

- Waitlist offers are only handed to patients with `contactConsent = true`.
- Reminders are skipped when the appointment was cancelled and are idempotent by unique `eventKey`.
- The notification channel is a **mock** — no real messages leave the system in this build.

## Threat model (summary)

| Threat | Mitigation |
|---|---|
| Prompt injection (system-prompt theft, role override, "book for another patient") | regex guard → deterministic refusal; input never acts as instructions; authz is in code |
| LLM hallucination in intake | strict zod; computed fields recomputed; deterministic fallback |
| Malicious FAQ tampering | content is DB-stored; only `approved + active` served; admin-only creation enters as pending |
| Booking race / double-book | row lock `FOR UPDATE` + unique constraints + idempotency key |
| Patient record snooping | ownership checks server-side |
| Secret leakage | env-only config, redaction, safe error model |

## Known residual risks (honest)

1. Keyword screening misses some real emergencies (accepted + disclosed; owner must approve the policy and tune the list).
2. The demo's session auth lacks MFA/rate-limited login.
3. Rule cache (30 s) means owner edits take up to 30 s to take effect.
