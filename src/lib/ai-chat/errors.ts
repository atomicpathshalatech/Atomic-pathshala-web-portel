export class ChatApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public cause?: unknown
  ) {
    super(message);
    this.name = "ChatApiError";
  }
}

function redactSensitive(value: string) {
  return value
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "<redacted-key>")
    .replace(/(api[_-]?key=)[^&\s"]+/gi, "$1<redacted>");
}

function stringifyUnknown(value: unknown, seen = new WeakSet<object>()): string {
  if (value instanceof Error) {
    const details = [
      value.name,
      value.message,
      stringifyErrorProperty(value, "status", seen),
      stringifyErrorProperty(value, "statusCode", seen),
      stringifyErrorProperty(value, "code", seen),
      stringifyErrorProperty(value, "details", seen),
      stringifyErrorProperty(value, "errorDetails", seen),
      stringifyErrorProperty(value, "cause", seen),
    ].filter(Boolean);

    return details.join(" ");
  }

  if (!value || typeof value !== "object") {
    return String(value);
  }

  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function stringifyErrorProperty(
  error: Error,
  property: string,
  seen: WeakSet<object>
) {
  const value = (error as unknown as Record<string, unknown>)[property];
  if (value === undefined || value === null) return "";

  return `${property}: ${stringifyUnknown(value, seen)}`;
}

export function getGeminiErrorDetails(error: unknown): string {
  return redactSensitive(stringifyUnknown(error));
}

/**
 * Errors worth retrying automatically (transient): rate limits, daily
 * quota bursts, and "model overloaded" (503) responses. Everything else
 * (bad API key, safety block, invalid request) fails fast instead.
 */
export function isRetryableGeminiError(error: unknown): boolean {
  const lower = getGeminiErrorDetails(error).toLowerCase();

  return (
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("429") ||
    lower.includes("503") ||
    lower.includes("overloaded") ||
    lower.includes("unavailable")
  );
}

export function mapGeminiError(error: unknown): ChatApiError {
  const lower = getGeminiErrorDetails(error).toLowerCase();

  if (lower.includes("api_key") || lower.includes("api key") || lower.includes("invalid key")) {
    return new ChatApiError(
      "Invalid Gemini API key. Check GEMINI_API_KEY in .env.local.",
      401,
      error
    );
  }

  if (lower.includes("quota") || lower.includes("rate limit") || lower.includes("429")) {
    return new ChatApiError(
      "AI is receiving too many requests right now. Please wait a minute and try again.",
      429,
      error
    );
  }

  if (lower.includes("safety") || lower.includes("blocked")) {
    return new ChatApiError(
      "Response was blocked for safety reasons. Please rephrase your question.",
      400,
      error
    );
  }

  if (
    (lower.includes("not found") && lower.includes("model")) ||
    (lower.includes("404") && lower.includes("model")) ||
    lower.includes("no longer available") ||
    lower.includes("503") ||
    lower.includes("overloaded") ||
    lower.includes("unavailable")
  ) {
    return new ChatApiError(
      "The configured Gemini model is unavailable. Update the model name and try again.",
      503,
      error
    );
  }

  if (lower.includes("timeout") || lower.includes("deadline")) {
    return new ChatApiError("Request timed out. Please try again.", 504, error);
  }

  if (
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("enotfound") ||
    lower.includes("econnreset") ||
    lower.includes("socket") ||
    lower.includes("certificate")
  ) {
    return new ChatApiError(
      "Could not reach Gemini. Check your internet connection and try again.",
      503,
      error
    );
  }

  if (
    lower.includes("permission_denied") ||
    lower.includes("forbidden") ||
    lower.includes("unauthorized") ||
    lower.includes("location is not supported") ||
    lower.includes("api has not been used") ||
    lower.includes("disabled")
  ) {
    return new ChatApiError(
      "Gemini API access is not enabled for this key/project. Check the API key, project, and region settings.",
      403,
      error
    );
  }

  if (
    lower.includes("bad request") ||
    lower.includes("invalid argument") ||
    lower.includes("400")
  ) {
    return new ChatApiError(
      "Gemini rejected the request. Try a shorter message or remove unsupported attachments.",
      400,
      error
    );
  }

  return new ChatApiError(
    "Failed to get AI response. Please try again.",
    500,
    error
  );
}
