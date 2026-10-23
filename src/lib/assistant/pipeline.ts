/**
 * Front-desk assistant pipeline.
 *
 * Request flow (fixed, documented in docs/architecture.md):
 *   auth (optional for pure FAQ) → rate limit → input validation →
 *   injection inspection → deterministic safety scan → intent routing →
 *   approved FAQ / intake extraction / real availability → strict output →
 *   audit (minimal) → response.
 *
 * The LLM is never the source of truth for clinic policy, availability,
 * permissions, or clinical decisions.
 */
import { db } from "@/db";
import { auditLogs, faqs, redFlagRules, intakeSessions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { SessionUser } from "@/lib/auth/service";
import { sha256 } from "@/lib/auth/service";
import { checkRateLimit, inspectMessage } from "@/lib/safety/guard";
import { scanForRedFlags, type RedFlagRule } from "@/lib/safety/redflags";
import { answerFromCorpus, type FaqEntry } from "@/lib/faq/service";
import { extractIntake } from "@/lib/intake/extract";
import { createSummary } from "@/lib/summary/service";
import { listAvailability } from "@/lib/booking/service";
import { normalizeText } from "@/lib/safety/redflags";

export type AssistantResponse =
  | {
      type: "faq";
      message: string;
      grounded: boolean;
      faqId: string | null;
      score: number;
    }
  | { type: "fallback"; message: string; grounded: false }
  | {
      type: "escalation";
      message: string;
      rule: { phrase: string; category: string; approvalNote: string };
      disclaimer: string;
    }
  | { type: "refusal"; message: string; flags: string[] }
  | { type: "auth_required"; message: string; intent: "intake" | "booking" }
  | {
      type: "intake";
      message: string;
      intakeId: string;
      summaryId: string;
      extraction: unknown;
      summaryDraft: string;
      engine: "llm" | "rule_fallback";
    }
  | {
      type: "booking";
      message: string;
      slots: { slotId: string; startAt: string; providerName: string; departmentName: string }[];
    }
  | { type: "booking_help"; message: string };

const REFUSAL_MESSAGE =
  "I can help with clinic questions, intake and appointments, but I can't act " +
  "on instructions that try to change how I work. How can I help with your visit today?";

/* --------------------------- cached policy loading -------------------------- */

let ruleCache: { at: number; rules: RedFlagRule[] } | null = null;
const RULE_CACHE_MS = 30_000;

export async function loadActiveRules(): Promise<RedFlagRule[]> {
  if (ruleCache && Date.now() - ruleCache.at < RULE_CACHE_MS) return ruleCache.rules;
  const rows = await db
    .select({
      id: redFlagRules.id,
      phrase: redFlagRules.phrase,
      category: redFlagRules.category,
      severity: redFlagRules.severity,
      escalationMessage: redFlagRules.escalationMessage,
    })
    .from(redFlagRules)
    .where(eq(redFlagRules.active, true));
  ruleCache = { at: Date.now(), rules: rows };
  return rows;
}

/** Test/seed hook. */
export function invalidateRuleCache(): void {
  ruleCache = null;
}

async function loadApprovedFaqs(): Promise<FaqEntry[]> {
  const rows = await db
    .select({
      id: faqs.id,
      question: faqs.question,
      answer: faqs.answer,
      category: faqs.category,
      keywords: faqs.keywords,
    })
    .from(faqs)
    .where(and(eq(faqs.active, true), eq(faqs.approval, "approved")));
  return rows;
}

/* ------------------------------- intent routing ----------------------------- */

type Intent = "booking" | "intake" | "faq";

export function classifyIntent(text: string): Intent {
  const t = normalizeText(text);
  const bookingSignals = [
    "book", "appointment", "schedule", "slot", "available", "availability",
    "reschedule", "cancel my appointment", "see a doctor", "see the doctor",
    "earliest",
  ];
  const intakeSignals = [
    "i have", "i feel", "i've been", "i am experiencing", "suffering",
    "pain", "symptom", "sick", "unwell", "fever", "hurts", "ache",
  ];
  if (bookingSignals.some((s) => t.includes(s))) return "booking";
  if (intakeSignals.some((s) => t.includes(s))) return "intake";
  return "faq";
}

/* --------------------------------- pipeline --------------------------------- */

export async function handleAssistantMessage(opts: {
  message: unknown;
  user: SessionUser | null;
}): Promise<{ status: number; body: AssistantResponse & { requestId: string } }> {
  const requestId = crypto.randomUUID();
  const rateKey = opts.user?.id ?? "anonymous";
  checkRateLimit(`assistant:${rateKey}`);

  const { text, guard } = inspectMessage(opts.message);

  // 1) Injection attempts route to a deterministic safe reply. The flagged
  //    text is never passed to the LLM. Minimal audit only (keeps hash).
  if (!guard.ok) {
    await db.insert(auditLogs).values({
      actorId: opts.user?.id ?? null,
      actorRole: opts.user?.role ?? "anonymous",
      action: "injection_attempt",
      entityType: "assistant",
      entityId: requestId,
      meta: { flags: guard.flags, messageHash: sha256(text) },
    });
    return {
      status: 200,
      body: { type: "refusal", message: REFUSAL_MESSAGE, flags: guard.flags, requestId },
    };
  }

  // 2) Deterministic safety scan BEFORE any LLM action.
  const rules = await loadActiveRules();
  const scan = scanForRedFlags(text, rules);
  if (scan.matched && scan.rule) {
    await db.insert(auditLogs).values({
      actorId: opts.user?.id ?? null,
      actorRole: opts.user?.role ?? "anonymous",
      action: "safety_escalation",
      entityType: "red_flag_rule",
      entityId: scan.rule.id,
      meta: { category: scan.rule.category, messageHash: sha256(text) },
    });
    return {
      status: 200,
      body: {
        type: "escalation",
        message: scan.rule.escalationMessage,
        rule: {
          phrase: scan.rule.phrase,
          category: scan.rule.category,
          approvalNote:
            "Escalation wording is clinic-owner-configured policy; demo rules are pending owner approval.",
        },
        disclaimer: scan.disclaimer,
        requestId,
      },
    };
  }

  // 3) Intent routing (deterministic).
  const intent = classifyIntent(text);

  if (intent === "booking") {
    if (!opts.user) {
      return {
        status: 200,
        body: {
          type: "auth_required",
          intent: "booking",
          message:
            "I can show you real appointment availability and book it for you — please sign in first so I can attach the booking to your record.",
          requestId,
        },
      };
    }
    const slots = await listAvailability({ limit: 8 });
    if (slots.length === 0) {
      return {
        status: 200,
        body: {
          type: "booking_help",
          message:
            "There are no open slots in the next two weeks. Please contact the front desk, or ask me to add you to the waitlist.",
          requestId,
        },
      };
    }
    return {
      status: 200,
      body: {
        type: "booking",
        message:
          "Here are the next available appointments pulled live from our schedule. Pick a time that suits you and I'll confirm it.",
        slots: slots.map((s) => ({
          slotId: s.slotId,
          startAt: s.startAt,
          providerName: s.providerName,
          departmentName: s.departmentName,
        })),
        requestId,
      },
    };
  }

  if (intent === "intake") {
    if (!opts.user) {
      return {
        status: 200,
        body: {
          type: "auth_required",
          intent: "intake",
          message:
            "I'd like to help you with intake — please sign in first so the summary is attached to the right record.",
          requestId,
        },
      };
    }
    const { extraction, engine } = await extractIntake(text);
    const [intake] = await db
      .insert(intakeSessions)
      .values({
        patientId: opts.user.id,
        extraction,
        messageHash: sha256(text),
        flags: [],
      })
      .returning({ id: intakeSessions.id });
    const summary = await createSummary({
      intakeId: intake!.id,
      patientId: opts.user.id,
      extraction,
      patientName: opts.user.name,
    });
    await db.insert(auditLogs).values({
      actorId: opts.user.id,
      actorRole: opts.user.role,
      action: "intake_recorded",
      entityType: "summary",
      entityId: summary.summaryId,
      meta: { engine, missingCount: extraction.missing_information.length },
    });
    return {
      status: 200,
      body: {
        type: "intake",
        message: extraction.needs_clarification
          ? extraction.clarification_question ??
            "Thank you — a few details are still missing for our team."
          : "Thank you, that's everything our front desk needs for now. A draft summary has been prepared for clinician review.",
        intakeId: intake!.id,
        summaryId: summary.summaryId,
        extraction,
        summaryDraft: summary.draft,
        engine,
        requestId,
      },
    };
  }

  // 4) Default: grounded FAQ.
  const corpus = await loadApprovedFaqs();
  const result = answerFromCorpus(text, corpus);
  if (!result.grounded) {
    return {
      status: 200,
      body: { type: "fallback", message: result.answer, grounded: false, requestId },
    };
  }
  return {
    status: 200,
    body: {
      type: "faq",
      message: result.answer,
      grounded: true,
      faqId: result.faqId,
      score: result.score,
      requestId,
    },
  };
}
