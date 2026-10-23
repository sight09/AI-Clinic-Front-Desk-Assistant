/**
 * Approved-FAQ grounding.
 *
 * Answers are selected from clinic-owner-approved FAQ rows (and clinic_info
 * facts) only. If the approved corpus cannot support an answer, we return a
 * safe fallback directing the user to clinic staff — the assistant never
 * invents hours, prices, services, policies or emergency numbers.
 */
import { normalizeText } from "@/lib/safety/redflags";

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
  keywords: string[];
}

export interface FaqAnswer {
  grounded: boolean;
  faqId: string | null;
  answer: string;
  score: number;
}

export const FALLBACK_ANSWER =
  "I don't have approved clinic information that answers that. Please contact our front desk and a team member will help you. " +
  "If this is about a medical concern or an emergency, please contact a qualified healthcare professional.";

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "i", "you", "we", "do", "does", "can", "what",
  "when", "where", "how", "my", "your", "our", "to", "of", "in", "on", "for",
  "and", "or", "at", "me", "it", "this", "that", "be", "with", "if",
]);

/** Patient-language synonyms used ONLY to widen question-side matching. */
const FAQ_SYNONYMS: Record<string, string[]> = {
  jab: ["shot"], jabs: ["shot"], shot: ["jab"],
  gp: ["doctor"], doc: ["doctor"],
  meds: ["medication"], medicine: ["medication"],
  ill: ["sick"], cancellation: ["cancel"], cancelling: ["cancel"],
  directions: ["address"], located: ["address"],
};

function contentTokens(text: string, expand = false): string[] {
  const base = normalizeText(text)
    .split(" ")
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
  if (!expand) return base;
  const expanded = new Set(base);
  for (const t of base) for (const s of FAQ_SYNONYMS[t] ?? []) expanded.add(s);
  return [...expanded];
}

/** Score: keyword-weighted token overlap, range 0..1. */
export function scoreFaq(question: string, faq: FaqEntry): number {
  const qTokens = new Set(contentTokens(question, true));
  if (qTokens.size === 0) return 0;

  const faqTokens = new Set([
    ...contentTokens(faq.question),
    ...contentTokens(faq.answer),
    ...faq.keywords.flatMap((k) => contentTokens(k)),
  ]);

  let hits = 0;
  for (const t of qTokens) if (faqTokens.has(t)) hits += 1;

  // Keyword exact hits are strong signals.
  const lower = normalizeText(question);
  const keywordHit = faq.keywords.some((k) => k && lower.includes(normalizeText(k)));

  const overlap = hits / qTokens.size;
  return Math.min(1, overlap * 0.8 + (keywordHit ? 0.35 : 0));
}

export const GROUNDING_THRESHOLD = 0.45;

export function answerFromCorpus(question: string, corpus: FaqEntry[]): FaqAnswer {
  let best: FaqEntry | null = null;
  let bestScore = 0;
  for (const faq of corpus) {
    const s = scoreFaq(question, faq);
    if (s > bestScore) {
      best = faq;
      bestScore = s;
    }
  }
  if (best && bestScore >= GROUNDING_THRESHOLD) {
    return { grounded: true, faqId: best.id, answer: best.answer, score: bestScore };
  }
  return { grounded: false, faqId: null, answer: FALLBACK_ANSWER, score: bestScore };
}
