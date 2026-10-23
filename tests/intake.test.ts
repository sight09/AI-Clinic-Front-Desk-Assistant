import { describe, it, expect, afterEach } from "vitest";
import {
  extractIntake,
  extractRuleBased,
  IntakeExtractionSchema,
} from "@/lib/intake/extract";
import { buildSummaryDraft, DRAFT_HEADER, DRAFT_FOOTER } from "@/lib/summary/service";
import { answerFromCorpus, FALLBACK_ANSWER, type FaqEntry } from "@/lib/faq/service";
import { setLLMProviderForTests, MockProvider, type LLMProvider } from "@/lib/llm/provider";
import { AppError } from "@/lib/errors";

afterEach(() => setLLMProviderForTests(null));

describe("intake extraction", () => {
  it("extracts only stated facts", () => {
    const e = extractRuleBased("I have had a headache for three days, it feels mild");
    expect(e.symptoms_as_reported).toContain("headache");
    expect(e.duration_as_reported).toBeTruthy();
    expect(e.severity_as_reported).toBe("mild");
    expect(e.missing_information).toHaveLength(0);
  });

  it("keeps missing information missing", () => {
    const e = extractRuleBased("I have a fever");
    expect(e.duration_as_reported).toBeNull();
    expect(e.severity_as_reported).toBeNull();
    expect(e.missing_information.length).toBeGreaterThanOrEqual(2);
    expect(e.needs_clarification).toBe(true);
    expect(e.clarification_question).toBeTruthy();
  });

  it("derives age band only from explicitly stated age", () => {
    expect(extractRuleBased("I'm 42 and feel dizzy").age_band).toBe("40-49");
    expect(extractRuleBased("I feel dizzy").age_band).toBeNull();
  });

  it("schema rejects unexpected fields and wrong types", () => {
    const base = {
      reason_for_visit: null,
      symptoms_as_reported: [],
      duration_as_reported: null,
      severity_as_reported: null,
      age_band: null,
      missing_information: [],
      needs_clarification: true,
      clarification_question: null,
    };
    expect(IntakeExtractionSchema.safeParse({ ...base, hack: true }).success).toBe(false);
    expect(
      IntakeExtractionSchema.safeParse({ ...base, symptoms_as_reported: "nope" }).success,
    ).toBe(false);
  });

  it("falls back deterministically when the provider fails", async () => {
    const failing: LLMProvider = {
      name: "f",
      complete: async () => {
        throw new AppError("provider_timeout", "t");
      },
    };
    setLLMProviderForTests(failing);
    const { extraction, engine } = await extractIntake("I have a cough for two weeks");
    expect(engine).toBe("rule_fallback");
    expect(extraction.symptoms_as_reported).toContain("cough");
  });

  it("falls back when the model returns malformed JSON", async () => {
    setLLMProviderForTests({ name: "bad", complete: async () => "<<not json>>" });
    const { engine } = await extractIntake("I feel nauseous");
    expect(engine).toBe("rule_fallback");
  });

  it("mock provider round-trips through the rule engine", async () => {
    setLLMProviderForTests(new MockProvider());
    const { extraction } = await extractIntake("I've had back pain for 5 days, moderate");
    expect(extraction.symptoms_as_reported).toContain("back pain");
    expect(extraction.missing_information).toHaveLength(0);
  });
});

describe("summary draft", () => {
  it("contains only intake facts and is clearly a draft", () => {
    const e = extractRuleBased("I have a headache for two days, mild");
    const draft = buildSummaryDraft(e, "Demo Patient");
    expect(draft.startsWith(DRAFT_HEADER)).toBe(true);
    expect(draft).toContain("headache");
    expect(draft).toContain("two days");
    expect(draft).toContain(DRAFT_FOOTER);
  });

  it("marks unknowns explicitly", () => {
    const e = extractRuleBased("I have a fever");
    const draft = buildSummaryDraft(e, "Demo Patient");
    expect(draft).toContain("UNKNOWN");
    expect(draft).toContain("Not provided");
  });
});

describe("faq grounding", () => {
  const corpus: FaqEntry[] = [
    {
      id: "a",
      question: "What are your opening hours?",
      answer: "Mon–Fri 8–18, Sat 9–13.",
      category: "hours",
      keywords: ["hours", "open"],
    },
  ];

  it("answers from the approved corpus", () => {
    const r = answerFromCorpus("when are you open?", corpus);
    expect(r.grounded).toBe(true);
    expect(r.faqId).toBe("a");
  });

  it("falls back for unknown questions", () => {
    const r = answerFromCorpus("do you offer dental implants?", corpus);
    expect(r.grounded).toBe(false);
    expect(r.answer).toBe(FALLBACK_ANSWER);
  });

  it("falls back on an empty corpus", () => {
    expect(answerFromCorpus("hours?", []).grounded).toBe(false);
  });
});
