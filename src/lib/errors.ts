/**
 * Application error model. Providers, DB drivers and the LLM wrapper all
 * normalise into `AppError` so route handlers can return user-safe payloads
 * without leaking stack traces, secrets, or provider internals.
 */
export type AppErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "provider_unavailable"
  | "provider_timeout"
  | "provider_misconfigured"
  | "upstream_error"
  | "internal";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  /** Safe, user-facing detail. Never contains internals. */
  readonly safeMessage: string;

  constructor(code: AppErrorCode, safeMessage: string, status?: number) {
    super(`${code}: ${safeMessage}`);
    this.code = code;
    this.safeMessage = safeMessage;
    this.status = status ?? statusForCode(code);
  }
}

function statusForCode(code: AppErrorCode): number {
  switch (code) {
    case "bad_request":
      return 400;
    case "unauthorized":
      return 401;
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
    case "conflict":
      return 409;
    case "rate_limited":
      return 429;
    case "provider_unavailable":
    case "provider_timeout":
    case "provider_misconfigured":
    case "upstream_error":
      return 503;
    default:
      return 500;
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

/** Map any thrown value to a JSON-safe `{ error }` body + status. */
export function toSafeErrorPayload(err: unknown): {
  body: { error: { code: AppErrorCode; message: string } };
  status: number;
} {
  if (isAppError(err)) {
    return {
      body: { error: { code: err.code, message: err.safeMessage } },
      status: err.status,
    };
  }
  // Unknown errors: log nothing sensitive, return a generic message.
  return {
    body: {
      error: {
        code: "internal",
        message: "Something went wrong on our side. Please try again.",
      },
    },
    status: 500,
  };
}
