/**
 * Typed YouTube Data API errors and the retry policy that goes with each
 * kind. Deliberately free of "server-only" and of any I/O so it can be unit
 * tested directly.
 *
 * Why this exists: every YouTube call used to throw a plain Error and the
 * callers regex-matched its message. That made it impossible to treat
 * quotaExceeded (never retry — retrying burns ~50 units per insert) any
 * differently from a 503 (retry with backoff), and it's how the 4-tier
 * broadcast-insert fallback ended up retrying quota errors four times.
 */

export type YoutubeErrorKind =
  | "QUOTA" // quotaExceeded, dailyLimitExceeded — never retry
  | "RATE_LIMIT" // rateLimitExceeded, userRateLimitExceeded, HTTP 429 — backoff
  | "AUTH_EXPIRED" // 401 on an API call — refresh the access token once
  | "AUTH_REVOKED" // invalid_grant on the token endpoint — admin must re-authorize
  | "PERMISSION" // insufficientLivePermissions, liveStreamingNotEnabled, scope problems
  | "BINDING_NOT_ALLOWED" // liveBroadcastBindingNotAllowed
  | "INVALID_BROADCAST" // invalidBroadcast / liveBroadcastNotFound
  | "STREAM_NOT_ACTIVE" // errorStreamInactive — the encoder isn't sending yet; poll, don't retry
  | "REDUNDANT_TRANSITION" // already in (or moving to) the requested state
  | "INVALID_TRANSITION" // e.g. complete → live
  | "NOT_FOUND"
  | "INVALID_REQUEST" // other 400s (validation) — a different request may succeed
  | "BACKEND" // 5xx / backendError — backoff
  | "NETWORK" // fetch failure or timeout — backoff
  | "CONFIG" // credentials missing / channel identity mismatch
  | "UNKNOWN";

export class YoutubeApiError extends Error {
  readonly kind: YoutubeErrorKind;
  readonly status: number | null;
  readonly reason: string | null;
  readonly operation: string;

  constructor(opts: { kind: YoutubeErrorKind; status: number | null; reason: string | null; operation: string; detail?: string }) {
    const where = opts.status !== null ? ` (${opts.status}${opts.reason ? ` ${opts.reason}` : ""})` : opts.reason ? ` (${opts.reason})` : "";
    super(`YouTube ${opts.operation} failed${where}${opts.detail ? `: ${opts.detail.slice(0, 500)}` : ""}`);
    this.name = "YoutubeApiError";
    this.kind = opts.kind;
    this.status = opts.status;
    this.reason = opts.reason;
    this.operation = opts.operation;
  }
}

const REASON_KINDS: Record<string, YoutubeErrorKind> = {
  quotaExceeded: "QUOTA",
  dailyLimitExceeded: "QUOTA",
  dailyLimitExceededUnreg: "QUOTA",
  rateLimitExceeded: "RATE_LIMIT",
  userRateLimitExceeded: "RATE_LIMIT",
  insufficientLivePermissions: "PERMISSION",
  liveStreamingNotEnabled: "PERMISSION",
  insufficientPermissions: "PERMISSION",
  ACCESS_TOKEN_SCOPE_INSUFFICIENT: "PERMISSION",
  forbidden: "PERMISSION",
  liveBroadcastBindingNotAllowed: "BINDING_NOT_ALLOWED",
  invalidBroadcast: "INVALID_BROADCAST",
  liveBroadcastNotFound: "INVALID_BROADCAST",
  errorStreamInactive: "STREAM_NOT_ACTIVE",
  streamInactive: "STREAM_NOT_ACTIVE",
  redundantTransition: "REDUNDANT_TRANSITION",
  invalidTransition: "INVALID_TRANSITION",
  videoNotFound: "NOT_FOUND",
  liveStreamNotFound: "NOT_FOUND",
  notFound: "NOT_FOUND",
  backendError: "BACKEND",
  internalError: "BACKEND",
  invalid_grant: "AUTH_REVOKED",
  authError: "AUTH_EXPIRED",
};

/** Pulls Google's machine-readable reason out of an error body. Handles both
 * the Data API shape ({error:{errors:[{reason}], status, details}}) and the
 * OAuth token endpoint shape ({error:"invalid_grant"}). */
export function extractYoutubeErrorReason(body: string): string | null {
  if (!body) return null;
  try {
    const json = JSON.parse(body);
    if (typeof json?.error === "string") return json.error;
    const first = json?.error?.errors?.[0]?.reason;
    if (typeof first === "string") return first;
    const detailReason = json?.error?.details?.find?.((d: any) => typeof d?.reason === "string")?.reason;
    if (typeof detailReason === "string") return detailReason;
    if (typeof json?.error?.status === "string") return json.error.status;
  } catch {
    // Not JSON — fall through to a textual scan below.
  }
  const known = Object.keys(REASON_KINDS).find((reason) => body.includes(reason));
  return known ?? null;
}

export function classifyYoutubeResponse(status: number, reason: string | null): YoutubeErrorKind {
  if (reason && REASON_KINDS[reason]) return REASON_KINDS[reason];
  if (status === 401) return "AUTH_EXPIRED";
  if (status === 429) return "RATE_LIMIT";
  if (status === 404) return "NOT_FOUND";
  if (status === 403) return "PERMISSION";
  if (status >= 500) return "BACKEND";
  if (status === 400) return "INVALID_REQUEST";
  return "UNKNOWN";
}

/**
 * Classifies anything thrown by a YouTube call. YoutubeApiError carries its
 * kind; anything else (older plain-Error call sites, network failures) is
 * classified from its message so the retry policy stays consistent.
 */
export function classifyYoutubeError(err: unknown): YoutubeErrorKind {
  if (err instanceof YoutubeApiError) return err.kind;
  const msg = err instanceof Error ? err.message : String(err);
  const reason = extractYoutubeErrorReason(msg);
  if (reason && REASON_KINDS[reason]) return REASON_KINDS[reason];
  if (/credentials are not configured|channel identity/i.test(msg)) return "CONFIG";
  if (/timeout|timed out|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|fetch failed|network|aborted/i.test(msg)) return "NETWORK";
  const statusMatch = msg.match(/\((\d{3})\)|\((\d{3}) /);
  const status = statusMatch ? Number(statusMatch[1] ?? statusMatch[2]) : null;
  return status !== null ? classifyYoutubeResponse(status, null) : "UNKNOWN";
}

/** Kinds worth retrying the SAME request for, with exponential backoff. */
export function isTransientYoutubeError(err: unknown): boolean {
  const kind = classifyYoutubeError(err);
  return kind === "RATE_LIMIT" || kind === "BACKEND" || kind === "NETWORK";
}

/** Kinds that no retry and no request variation can fix. */
export function isTerminalYoutubeError(err: unknown): boolean {
  const kind = classifyYoutubeError(err);
  return (
    kind === "QUOTA" ||
    kind === "PERMISSION" ||
    kind === "AUTH_REVOKED" ||
    kind === "CONFIG" ||
    kind === "BINDING_NOT_ALLOWED" ||
    kind === "INVALID_BROADCAST"
  );
}

/** Exponential backoff with full jitter: attempt 0 → up to base, 1 → up to 2×base, … capped. */
export function backoffDelayMs(attempt: number, baseMs = 800, capMs = 8_000, random: () => number = Math.random): number {
  const ceiling = Math.min(capMs, baseMs * 2 ** attempt);
  return Math.round(ceiling / 2 + random() * (ceiling / 2));
}

/** One short, teacher/admin-facing sentence per kind — no raw Google JSON in the UI. */
export function describeYoutubeError(err: unknown): string {
  switch (classifyYoutubeError(err)) {
    case "QUOTA":
      return "YouTube's daily API quota is used up. Classes can't be created on YouTube until it resets (midnight Pacific time).";
    case "RATE_LIMIT":
      return "YouTube is rate-limiting requests right now. Please try again in a minute.";
    case "AUTH_REVOKED":
    case "AUTH_EXPIRED":
      return "YouTube authorization has expired or was revoked. An admin needs to re-authorize the channel.";
    case "PERMISSION":
      return "The YouTube channel isn't allowed to do this (live streaming may not be enabled, or the authorization is missing a permission).";
    case "CONFIG":
      return "YouTube isn't configured correctly on this server.";
    case "BINDING_NOT_ALLOWED":
    case "INVALID_BROADCAST":
      return "The YouTube broadcast for this class is no longer valid.";
    case "STREAM_NOT_ACTIVE":
      return "YouTube isn't receiving video from the encoder yet.";
    case "NETWORK":
    case "BACKEND":
      return "Couldn't reach YouTube. Please try again.";
    default:
      return "YouTube returned an unexpected error.";
  }
}
