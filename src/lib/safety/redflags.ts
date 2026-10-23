/**
 * Deterministic red-flag safety engine.
 *
 * Runs BEFORE any LLM call for health-related messages. Rules come from the
 * `red_flag_rules` table (owner-approved configuration, kept out of business
 * code). A match interrupts the routine flow and surfaces the *configured*
 * escalation message. A non-match is NEVER treated as proof of safety.
 *
 * Matching is deliberately tolerant: normalisation, synonym expansion,
 * word-edit-distance up to 2 (misspellings like "bretahing"), and ordered
 * multi-word proximity matching ("chest ... pain").
 */

export interface RedFlagRule {
  id: string;
  phrase: string;
  category: string;
  severity: string;
  escalationMessage: string;
}

export interface SafetyScanResult {
  matched: boolean;
  rule: RedFlagRule | null;
  /** Always present: explicitly states what a scan does and does not mean. */
  disclaimer: string;
}

export const SCAN_DISCLAIMER =
  "Automated keyword screening only: no match does NOT mean a person is safe.";

/* ------------------------------ normalisation ------------------------------ */

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Small owner-tunable synonym map for the seeded demo policy. */
const SYNONYMS: Record<string, string[]> = {
  chest: ["chest", "torso"],
  pain: ["pain", "ache", "hurts", "hurt", "pressure"],
  breathing: ["breathing", "breathe", "breath", "breaths"],
  trouble: ["trouble", "difficulty", "hard", "cant", "cannot", "struggling"],
  severe: ["severe", "terrible", "extreme", "worst", "unbearable", "intense"],
  bleeding: ["bleeding", "bleed", "blood"],
  heavy: ["heavy", "heavy", "lots", "lot", "gushing", "pouring"],
  suicidal: ["suicidal", "suicide"],
  kill: ["kill", "end", "hurt"],
  myself: ["myself", "me"],
  unconscious: ["unconscious", "unresponsive", "fainted", "collapsed", "passed"],
  overdose: ["overdose", "overdosed", "pills"],
  stroke: ["stroke", "face", "drooping", "slurred"],
  numbness: ["numbness", "numb", "tingling", "weakness"],
  sudden: ["sudden", "suddenly", "abrupt"],
};

function synonymForms(token: string): string[] {
  return SYNONYMS[token] ?? [token];
}

/* ------------------------------- fuzzy match ------------------------------- */

/**
 * Optimal String Alignment distance — Levenshtein plus adjacent-transposition
 * cost 1, so "bretah" ≈ "breath". Small strings only (bounded by word length).
 */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 2) return Math.abs(la - lb);
  const d: number[][] = Array.from({ length: la + 1 }, (_, i) =>
    Array.from({ length: lb + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      d[i]![j] = Math.min(
        d[i - 1]![j]! + 1,
        d[i]![j - 1]! + 1,
        d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
      }
    }
  }
  return d[la]![lb]!;
}

function tokenMatches(word: string, target: string): boolean {
  for (const form of synonymForms(target)) {
    if (word === form) return true;
    // allow small misspellings on words of length >= 5
    if (form.length >= 5 && word.length >= 4 && editDistance(word, form) <= 1) return true;
    if (form.length >= 7 && editDistance(word, form) <= 2) return true;
  }
  return false;
}

/**
 * Negation/benign tokens appearing BETWEEN partially-matched phrase words
 * abort the match ("chest looks fine and pain was never an issue" ≠ chest pain).
 * Negations before the phrase do not abort — conservative over-screening is
 * safer than under-screening (documented in docs/safety-and-privacy.md).
 */
const NEGATION_TOKENS = new Set([
  "no", "not", "never", "without", "fine", "gone", "resolved", "stopped", "wont", "dont",
]);

/**
 * Ordered multi-word match: each phrase token must appear (in order) among
 * the message tokens, tolerating filler words between them and misspellings.
 */
export function phraseMatches(normalizedMessage: string, phrase: string): boolean {
  const msgTokens = normalizedMessage.split(" ").filter(Boolean);
  const phraseTokens = normalizeText(phrase).split(" ").filter(Boolean);
  if (phraseTokens.length === 0 || msgTokens.length === 0) return false;

  let pi = 0;
  let gapSinceLast = 0;
  for (const token of msgTokens) {
    const target = phraseTokens[pi]!;
    if (tokenMatches(token, target)) {
      pi += 1;
      gapSinceLast = 0;
      if (pi === phraseTokens.length) return true;
    } else {
      if (pi > 0 && NEGATION_TOKENS.has(token)) {
        // "chest … fine … pain" — abandon the partial match.
        pi = 0;
        gapSinceLast = 0;
        continue;
      }
      gapSinceLast += 1;
      // Allow at most 4 filler tokens between matched phrase words so
      // "chest really bad pain" still matches, but unrelated text does not.
      if (pi > 0 && gapSinceLast > 4) {
        pi = 0;
        gapSinceLast = 0;
      }
    }
  }
  return false;
}

/* --------------------------------- scanner --------------------------------- */

export function scanForRedFlags(message: string, rules: RedFlagRule[]): SafetyScanResult {
  const normalized = normalizeText(message);
  for (const rule of rules) {
    if (phraseMatches(normalized, rule.phrase)) {
      return { matched: true, rule, disclaimer: SCAN_DISCLAIMER };
    }
  }
  return { matched: false, rule: null, disclaimer: SCAN_DISCLAIMER };
}
