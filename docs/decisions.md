# Key decisions

| # | Decision | Alternatives considered | Why |
|---|---|---|---|
| 1 | Deterministic red-flag engine before any LLM | LLM-based "safety classification" | Safety must be auditable, replayable and owner-configurable; a probabilistic classifier is none of those. |
| 2 | FAQ = retrieval + scoring, not generation | LLM-answered FAQs with the corpus in context | Generation can paraphrase wrong facts; retrieval guarantees grounded, citable answers and cheap fallbacks. |
| 3 | Deterministic clinician summary | Model-written summary | Guarantees source fidelity (only validated intake facts appear) and removes a hallucination surface. Labelled DRAFT either way. |
| 4 | LLM provider wrapper with `mock` default | Direct vendor SDK in routes | Swappable provider, deterministic tests/CI without keys, centralised timeouts/retries/error normalisation. OpenAI-compatible HTTP keeps the vendor surface tiny. |
| 5 | Session-cookie auth with scrypt | next-auth / JWT | Single-clinic demo scope, zero extra deps, server-side revocation, ownership checks. Documented as demo-grade. |
| 6 | Unique constraints as the booking authority | App-level "check then insert" | `SELECT … FOR UPDATE` + unique `slot_id`/`idempotency_key` make races impossible regardless of bugs above. |
| 7 | Mock notification channel | Real email/SMS provider | No approved channel/credentials exist; the state machine (pending/sent/skipped/failed, idempotency, consent) is fully built + tested against the mock. |
| 8 | zod strict schemas at every boundary | TypeScript types only | TS types vanish at runtime; zod `.strict()` rejects fabricated fields from both users and models. |
| 9 | No vector DB / agents / fine-tuning | RAG stack | Unnecessary for an 8-FAQ administrative corpus; adds failure modes. Documented as a Week-1 requirement. |
| 10 | Minimal audit rows (no message bodies) | Full conversation logging | Data minimisation; sha256 hashes still allow correlation. |
| 11 | Negation-aware matcher | Pure keyword matching | Cuts benign-context false positives ("chest looks fine and pain was never an issue") while keeping recall on emergencies. |

## Open questions for the team/owner

1. **Clinic owner**: approve/replace demo FAQ corpus, red-flag rules and escalation wording (includes real emergency guidance)? ← **blocks production**
2. Notification channel for real reminders (SMS vs email vs push) + consent wording?
3. Is this repository the shared team app (assumed yes)? Any naming conventions to align?
4. Production deployment target + secret management?
5. Should intake keep the raw message for clinicians (defaults to NO for minimisation)?
