/**
 * LLM provider wrapper (server-side only).
 *
 * Design goals:
 *  - The rest of the app depends on the `LLMProvider` interface, never on a
 *    vendor SDK, so the provider can be swapped without rewrites.
 *  - Credentials come exclusively from environment variables.
 *  - Timeouts + bounded retries for transient failures only (429 / 5xx /
 *    network). Non-retryable errors fail fast.
 *  - All provider errors are normalised into safe `AppError`s — raw stack
 *    traces, API keys and provider payloads never reach the client.
 *  - `mock` provider is deterministic, requires no key, and powers tests,
 *    CI and the demo fallback.
 */
import { AppError } from "@/lib/errors";

export type LLMTask = "faq" | "extract" | "summarize";

export interface LLMProvider {
  readonly name: string;
  complete(input: { task: LLMTask; system: string; user: string }): Promise<string>;
}

/* ------------------------------ mock provider ------------------------------ */
/**
 * Deterministic offline provider. It never fabricates facts: extraction
 * delegates to the same rule-based pass used as the live-LLM fallback, and
 * summarisation/FAQ return structured markers the callers already handle
 * deterministically.
 */
export class MockProvider implements LLMProvider {
  readonly name = "mock";
  async complete(input: { task: LLMTask; system: string; user: string }): Promise<string> {
    if (input.task === "extract") {
      return JSON.stringify({ task: "extract", passthrough: true, text: input.user });
    }
    if (input.task === "summarize") {
      return JSON.stringify({ task: "summarize", passthrough: true, text: input.user });
    }
    return JSON.stringify({ task: "faq", passthrough: true, text: input.user });
  }
}

/* --------------------- openai-compatible http provider --------------------- */

type OpenAIConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
};

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name = "openai";
  constructor(private readonly cfg: OpenAIConfig) {}

  async complete(input: { task: LLMTask; system: string; user: string }): Promise<string> {
    const url = `${this.cfg.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const body = {
      model: this.cfg.model,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
      temperature: input.task === "extract" ? 0 : 0.2,
      response_format: input.task === "extract" ? { type: "json_object" } : undefined,
    };

    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.cfg.maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.cfg.apiKey}`,
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Afiya Clinic",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.cfg.timeoutMs),
        });

        if (res.ok) {
          const json = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const content = json.choices?.[0]?.message?.content;
          if (typeof content !== "string" || content.length === 0) {
            throw new AppError("upstream_error", "The assistant returned an empty response.");
          }
          return content;
        }

        // Retry only transient statuses; everything else fails immediately.
        if (res.status === 429 || res.status >= 500) {
          lastErr = new AppError("provider_unavailable", "The assistant is temporarily unavailable.");
          await sleep(backoffMs(attempt));
          continue;
        }
        throw new AppError("upstream_error", "The assistant could not process that request.");
      } catch (err) {
        if (isTimeout(err)) {
          lastErr = new AppError("provider_timeout", "The assistant took too long to respond.");
          await sleep(backoffMs(attempt));
          continue;
        }
        if (isNetworkError(err)) {
          lastErr = new AppError("provider_unavailable", "The assistant is temporarily unavailable.");
          await sleep(backoffMs(attempt));
          continue;
        }
        throw err;
      }
    }
    throw lastErr instanceof AppError
      ? lastErr
      : new AppError("provider_unavailable", "The assistant is temporarily unavailable.");
  }
}

function isTimeout(err: unknown): boolean {
  return err instanceof DOMException && err.name === "TimeoutError";
}
function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError && err.message === "fetch failed";
}
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
function backoffMs(attempt: number): number {
  return Math.min(250 * 2 ** attempt, 1000);
}

/* --------------------------------- factory --------------------------------- */

let cached: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (cached) return cached;
  const kind = (process.env.AI_PROVIDER ?? "mock").toLowerCase();
  if (kind === "openai") {
    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) {
      throw new AppError(
        "provider_misconfigured",
        "assistant is not configured on this environment.",
      );
    }
    cached = new OpenAICompatibleProvider({
      apiKey,
      baseUrl: process.env.AI_BASE_URL ?? "https://api.openai.com/v1",
      model: process.env.AI_MODEL ?? "gpt-4o-mini",
      timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 15000),
      maxRetries: Number(process.env.AI_MAX_RETRIES ?? 2),
    });
  } else {
    cached = new MockProvider();
  }
  return cached;
}

/** Test hook: inject a stub provider and reset the singleton. */
export function setLLMProviderForTests(provider: LLMProvider | null): void {
  cached = provider;
}
