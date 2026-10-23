/**
 * Input hardening: prompt-injection detection, size limits, lightweight
 * per-user rate limiting and log-safe redaction.
 *
 * Injection flags never *grant* or *deny* permissions by themselves — user
 * text is always treated as data. Detection only routes the conversation to
 * a safe, deterministic reply.
 */
import { AppError } from "@/lib/errors";

export const MAX_MESSAGE_CHARS = 2000;

const INJECTION_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "ignore_instructions", re: /\bignore\b.{0,40}\b(instructions?|rules?|prompts?)\b/i },
  { name: "reveal_prompt", re: /\b(show|reveal|print|display|leak)\b.{0,40}\b(system|prompt|instructions?)\b/i },
  { name: "system_prompt_word", re: /\bsystem\s*prompt\b/i },
  { name: "jailbreak", re: /\b(jailbreak|DAN|do anything now)\b/i },
  { name: "role_override", re: /\byou are now\b.{0,40}\b(doctor|physician|admin|developer)\b/i },
  { name: "act_as_override", re: /\bact as\b.{0,40}\b(doctor|physician|root|admin)\b/i },
  { name: "grant_access", re: /\bgrant\b.{0,30}\b(access|permission|records?)\b/i },
  { name: "impersonation", re: /\bon behalf of (another|someone else|a different patient)\b/i },
];

export interface GuardResult {
  ok: boolean;
  flags: string[];
}

export function inspectMessage(raw: unknown): { text: string; guard: GuardResult } {
  if (typeof raw !== "string") {
    throw new AppError("bad_request", "Message must be text.");
  }
  const text = raw.trim();
  if (text.length === 0) {
    throw new AppError("bad_request", "Please enter a message.");
  }
  if (text.length > MAX_MESSAGE_CHARS) {
    throw new AppError(
      "bad_request",
      `Messages are limited to ${MAX_MESSAGE_CHARS} characters.`,
    );
  }
  const flags = INJECTION_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.name);
  return { text, guard: { ok: flags.length === 0, flags } };
}

/** Strip strings that must never land in operational logs. */
export function redactForLog(input: string): string {
  return input
    .replace(/[A-Za-z0-9+/]{24,}={0,2}/g, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 120);
}

/* ------------------------------ rate limiting ------------------------------ */

const buckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const LIMIT = 20;

export function checkRateLimit(key: string): void {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  bucket.count += 1;
  if (bucket.count > LIMIT) {
    throw new AppError("rate_limited", "Too many messages. Please wait a moment and try again.");
  }
}

/** Test hook. */
export function resetRateLimits(): void {
  buckets.clear();
}
