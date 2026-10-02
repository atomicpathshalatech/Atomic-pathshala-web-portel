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

/** The model list without models already found to be retired. Never empty. */
export function usableModels(models: readonly string[] = GEMINI_TEXT_MODELS): string[] {
  const now = Date.now();
  const live = models.filter((m) => (retiredModels.get(m) ?? 0) <= now);
  return live.length ? live : [...models];
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
