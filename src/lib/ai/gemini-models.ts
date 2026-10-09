/**
 * One place for "which Gemini model, which key" — every Gemini caller in the
 * app (question engine, extraction, chat, doubt solver, module studio,
 * CamDraw) uses this list and these checks, so a model Google retires or a
 * key whose project is blocked is handled the same way everywhere.
 *
 * Model order (checked against the live API, Oct 2026): 3.6-flash answers
 * reliably and fast; 3.8-flash is the newest but often returns 503 "high
 * demand"; flash-latest / 3.5-flash / 3-flash-preview are good fallbacks;
 * 3.1-flash-lite is the fast last resort. The 2.5 family is retired for these
 * keys (404 "no longer available"), and the pro models have no quota (429).
 */
import { GoogleGenerativeAI } from "@google/generative-ai";

export const GEMINI_TEXT_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
] as const;

/** A fast model for small, simple jobs (translation checks, short replies). */
export const GEMINI_FAST_MODELS = ["gemini-3.1-flash-lite", "gemini-3.6-flash", "gemini-flash-lite-latest", "gemini-3.8-flash"] as const;

const DEAD_KEY_MS = 6 * 60 * 60 * 1000;
const RETIRED_MODEL_MS = 24 * 60 * 60 * 1000;
const deadKeys = new Map<string, number>();
const retiredModels = new Map<string, number>();
// A model answering 503 "high demand" is busy for every key — skip it for a
// short while instead of trying it again on each key (2–4 s per try).
const busyModels = new Map<string, number>();
const BUSY_MODEL_MS = 45_000;

export function markModelBusy(model: string) {
  busyModels.set(model, Date.now() + BUSY_MODEL_MS);
}

function message(err: unknown): string {
  const e = err as { message?: string; status?: number } | null;
  return `${e?.status ?? ""} ${e?.message ?? String(err)}`.toLowerCase();
}

/**
 * The key itself can't be used at all — its Google project is blocked
 * ("Your project has been denied access"), the key is invalid or revoked.
 * Trying other models with it is pointless; move to the next key.
 */
export function isDeadKeyError(err: unknown): boolean {
  const m = message(err);
  return (
    m.includes("denied access") ||
    m.includes("api key not valid") ||
    m.includes("api_key_invalid") ||
    m.includes("api key expired") ||
    m.includes("permission_denied") ||
    m.includes("unauthenticated") ||
    m.includes("[401") ||
    m.includes("[403")
  );
}

/** The model is gone / not offered (404) — skip it, for every key. */
export function isRetiredModelError(err: unknown): boolean {
  const m = message(err);
  return m.includes("[404") || m.includes("no longer available") || (m.includes("model") && m.includes("not found"));
}

/** Temporary overload of a model (503 / high demand) — try another model. */
export function isOverloadError(err: unknown): boolean {
  const m = message(err);
  return m.includes("[503") || m.includes("high demand") || m.includes("overloaded") || m.includes("unavailable");
}

export function markKeyDead(key: string) {
  if (!deadKeys.has(key)) console.warn(`[gemini] key ${key.slice(0, 4)}…${key.slice(-4)} is blocked/invalid — skipping it for 6 h`);
  deadKeys.set(key, Date.now() + DEAD_KEY_MS);
}

export function isKeyDead(key: string): boolean {
  const until = deadKeys.get(key);
  return !!until && until > Date.now();
}

export function markModelRetired(model: string) {
  if (!retiredModels.has(model)) console.warn(`[gemini] model ${model} is unavailable (404) — skipping it`);
  retiredModels.set(model, Date.now() + RETIRED_MODEL_MS);
}

/**
 * Quota is counted per key AND per model: a key that has used up its daily
 * requests on one model still works on the others. Remembering the pair (not
 * resting the whole key) keeps good keys in use and stops the same refused
 * request being repeated on every attempt.
 */
const quotaOut = new Map<string, number>();
const QUOTA_OUT_MS = 30 * 60 * 1000;

export function isQuotaError(err: unknown): boolean {
  const m = message(err);
  return m.includes("429") || m.includes("quota") || m.includes("resourceexhausted") || m.includes("resource_exhausted");
}

export function markQuotaOut(key: string, model: string, ms: number = QUOTA_OUT_MS) {
  quotaOut.set(`${key}|${model}`, Date.now() + Math.max(60_000, Math.min(ms, 6 * 60 * 60 * 1000)));
}

export function isQuotaOut(key: string, model: string): boolean {
  return (quotaOut.get(`${key}|${model}`) ?? 0) > Date.now();
}

/** The model list without models already found to be retired. Never empty. */
export function usableModels(models: readonly string[] = GEMINI_TEXT_MODELS): string[] {
  const now = Date.now();
  const notRetired = models.filter((m) => (retiredModels.get(m) ?? 0) <= now);
  const free = notRetired.filter((m) => (busyModels.get(m) ?? 0) <= now);
  // Busy models go last (still tried if nothing else works), retired ones never.
  const ordered = [...free, ...notRetired.filter((m) => !free.includes(m))];
  return ordered.length ? ordered : [...models];
}

/** The keys without ones found to be blocked/invalid. Never empty if keys exist. */
export function usableKeys(keys: string[]): string[] {
  const live = keys.filter((k) => !isKeyDead(k));
  return live.length ? live : keys;
}

/** Book-keeping after a failed call: returns what the caller should do next. */
export function classifyGeminiFailure(err: unknown, key: string, model: string): "next-key" | "next-model" {
  if (isDeadKeyError(err)) {
    markKeyDead(key);
    return "next-key";
  }
  if (isRetiredModelError(err)) {
    markModelRetired(model);
    return "next-model";
  }
  if (isOverloadError(err)) markModelBusy(model);
  return "next-model";
}

/**
 * Every configured Gemini key, read the same way everywhere. Both
 * GEMINI_API_KEYS and GEMINI_API_KEY may hold one key or a comma / newline /
 * space separated list (production keeps most keys in GEMINI_API_KEY), so
 * both are split — a caller that treated a whole list as one key got 401
 * "invalid authentication credentials" on every request.
 */
export function readGeminiKeys(): string[] {
  const raw = [process.env.GEMINI_API_KEYS, process.env.GEMINI_API_KEY]
    .filter(Boolean)
    .join(",")
    .split(/[\s,;]+/)
    .map((k) => k.trim().replace(/^["']|["']$/g, ""))
    .filter((k) => k.length > 20 && k.length <= 120 && !k.includes("your_gemini_api_key") && !k.includes("_gemini_api_key"));
  return Array.from(new Set(raw));
}

/**
 * Gemini 3 models "think" before answering by default, and those thinking
 * tokens count against maxOutputTokens: a 10-question quiz came back cut off
 * mid-JSON (→ 0 questions) after ~60 s. Light thinking keeps answers whole and
 * fast. MINIMAL isn't accepted by every model (3.8-flash / flash-latest want
 * LOW), so the level is picked per model.
 */
export function lightThinking(model: string, level: "minimal" | "low" = "minimal") {
  const needsLow = model === "gemini-3.8-flash" || model === "gemini-flash-latest";
  return { thinkingConfig: { thinkingLevel: level === "minimal" && needsLow ? "low" : level } };
}

/**
 * The SDK client every Gemini caller uses: each model it hands out gets light
 * thinking unless the caller set its own thinkingConfig.
 */
export class LightGoogleGenerativeAI extends GoogleGenerativeAI {
  getGenerativeModel(...args: Parameters<GoogleGenerativeAI["getGenerativeModel"]>) {
    const [params, options] = args;
    const generationConfig = { ...lightThinking(params.model), ...(params.generationConfig ?? {}) } as typeof params.generationConfig;
    return super.getGenerativeModel({ ...params, generationConfig }, options);
  }
}

/**
 * How long Google says to wait after a 429 ("Please retry in 10h10m44s" /
 * "retryDelay":"36644s"). A free-tier key that used up its daily quota
 * (20 requests per model per day) should be left alone until then instead
 * of being retried every minute. null when the error doesn't say.
 */
export function retryAfterMs(err: unknown): number | null {
  const m = message(err);
  const delay = m.match(/retrydelay"?\s*:\s*"(\d+(?:\.\d+)?)s"/);
  if (delay) return Math.round(Number(delay[1]) * 1000);
  const human = m.match(/retry in ((?:\d+h)?(?:\d+m)?(?:\d+(?:\.\d+)?s)?)/);
  if (human && human[1]) {
    const h = Number(human[1].match(/(\d+)h/)?.[1] ?? 0);
    const mi = Number(human[1].match(/(\d+)m(?!s)/)?.[1] ?? 0);
    const s = Number(human[1].match(/(\d+(?:\.\d+)?)s/)?.[1] ?? 0);
    const ms = ((h * 60 + mi) * 60 + s) * 1000;
    return ms > 0 ? Math.round(ms) : null;
  }
  return null;
}
