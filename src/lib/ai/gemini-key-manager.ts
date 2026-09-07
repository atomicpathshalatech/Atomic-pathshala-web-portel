import { GoogleGenerativeAI } from "@google/generative-ai";

export interface KeyTelemetry {
  keyIndex: number;
  tier: "FREE" | "PAID";
  maskedKey: string;
  totalRequests: number;
  failedRequests: number;
  lastUsedAt?: number;
  cooldownUntil?: number;
}

export interface CostEstimateResult {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costInr: number;
  costPaise: number;
  isFreeTier: boolean;
  tier: "FREE" | "PAID";
  keyMasked: string;
}

// Pricing constants based on Google Gemini 1.5 / 2.0 / 2.5 Flash tier
// Gemini Flash: $0.075 / 1M input tokens, $0.30 / 1M output tokens
// USD to INR conversion rate approx 87.0
const USD_TO_INR = 87.0;
const INPUT_TOKEN_PRICE_PER_MILLION_USD = 0.075;
const OUTPUT_TOKEN_PRICE_PER_MILLION_USD = 0.30;
const DEFAULT_COOLDOWN_MS = 60_000; // 60s cooldown on 429 rate limit

export class GeminiKeyManager {
  private static instance: GeminiKeyManager;

  private freeKeys: string[] = [];
  private paidKeys: string[] = [];
  private currentFreeIndex = 0;
  private currentPaidIndex = 0;
  private cooldowns = new Map<string, number>();
  private requestCounts = new Map<string, { total: number; failed: number }>();

  private constructor() {
    this.refreshKeys();
  }

  public static getInstance(): GeminiKeyManager {
    if (!GeminiKeyManager.instance) {
      GeminiKeyManager.instance = new GeminiKeyManager();
    }
    return GeminiKeyManager.instance;
  }

  /**
   * Refreshes and organizes keys into FREE vs PAID pools.
   * Priority:
   * 1. If GEMINI_FREE_KEYS & GEMINI_PAID_KEYS are explicitly defined, use them.
   * 2. If only GEMINI_API_KEYS is defined:
   *    - If > 2 keys: First (N - 2) keys are treated as FREE, last 2 keys as PAID.
   *    - If <= 2 keys: All are treated as FREE with fallback.
   */
  public refreshKeys(): void {
    const rawFree = process.env.GEMINI_FREE_KEYS?.trim();
    const rawPaid = process.env.GEMINI_PAID_KEYS?.trim();
    const rawMulti = process.env.GEMINI_API_KEYS?.trim();
    const rawSingle = process.env.GEMINI_API_KEY?.trim();

    const parseList = (str?: string): string[] => {
      if (!str) return [];
      return str
        .split(",")
        .map((k) => k.trim().replace(/^["']|["']$/g, ""))
        .filter((k) => k && !k.includes("your_gemini_api_key") && k.length > 10 && k.length <= 120);
    };

    if (rawFree || rawPaid) {
      this.freeKeys = parseList(rawFree);
      this.paidKeys = parseList(rawPaid);
      if (this.freeKeys.length === 0 && rawMulti) {
        this.freeKeys = parseList(rawMulti);
      }
    } else {
      const combined = Array.from(new Set([...parseList(rawMulti), ...parseList(rawSingle)]));
      if (combined.length > 2) {
        // As per project rule: 2 paid keys, remaining are free keys
        this.freeKeys = combined.slice(0, combined.length - 2);
        this.paidKeys = combined.slice(combined.length - 2);
      } else {
        this.freeKeys = combined;
        this.paidKeys = [];
      }
    }
  }

  public getAvailableKeysSummary() {
    const now = Date.now();
    const freeAvailable = this.freeKeys.filter((k) => (this.cooldowns.get(k) || 0) <= now).length;
    const paidAvailable = this.paidKeys.filter((k) => (this.cooldowns.get(k) || 0) <= now).length;

    return {
      totalFree: this.freeKeys.length,
      availableFree: freeAvailable,
      totalPaid: this.paidKeys.length,
      availablePaid: paidAvailable,
    };
  }

  /**
   * Executes a task using round-robin rotation across Free keys first.
   * Seamlessly falls back to Paid keys only when all Free keys are in cooldown.
   */
  public async executeWithRotation<T>(
    task: (client: GoogleGenerativeAI, meta: { key: string; tier: "FREE" | "PAID"; index: number }) => Promise<T>
  ): Promise<T> {
    this.refreshKeys();
    const allKeysCount = this.freeKeys.length + this.paidKeys.length;
    if (allKeysCount === 0) {
      throw new Error("No valid Gemini API keys found. Please configure GEMINI_FREE_KEYS / GEMINI_API_KEYS in .env.local.");
    }

    const now = Date.now();
    let lastError: any = null;

    // 1. TRY FREE KEYS POOL (Round-Robin)
    if (this.freeKeys.length > 0) {
      const startIndex = this.currentFreeIndex % this.freeKeys.length;
      for (let i = 0; i < this.freeKeys.length; i++) {
        const idx = (startIndex + i) % this.freeKeys.length;
        const key = this.freeKeys[idx];
        if (!key) continue;
        const cd = this.cooldowns.get(key) || 0;

        if (cd > now) {
          continue; // Key is currently rate limited, skip to next free key
        }

        this.currentFreeIndex = (idx + 1) % this.freeKeys.length;
        this.trackRequest(key, false);

        try {
          const client = new GoogleGenerativeAI(key);
          const result = await task(client, { key, tier: "FREE", index: idx + 1 });
          return result;
        } catch (err: any) {
          lastError = err;
          this.trackRequest(key, true);
          this.handleKeyError(key, err);
          console.warn(`[GeminiKeyManager] Free Key #${idx + 1} (${this.maskKey(key)}) error: ${err?.message || err}. Moving to next key.`);
        }
      }
    }

    // 2. FALLBACK TO PAID KEYS POOL (When all free keys are in cooldown or failed)
    if (this.paidKeys.length > 0) {
      console.warn(`[GeminiKeyManager] All free keys are in cooldown or failed. Falling back to PAID tier keys.`);
      const startPaid = this.currentPaidIndex % this.paidKeys.length;
      for (let i = 0; i < this.paidKeys.length; i++) {
        const idx = (startPaid + i) % this.paidKeys.length;
        const key = this.paidKeys[idx];
        if (!key) continue;
        const cd = this.cooldowns.get(key) || 0;

        if (cd > now && this.paidKeys.some((k) => (this.cooldowns.get(k) || 0) <= now)) {
          continue;
        }

        this.currentPaidIndex = (idx + 1) % this.paidKeys.length;
        this.trackRequest(key, false);

        try {
          const client = new GoogleGenerativeAI(key);
          const result = await task(client, { key, tier: "PAID", index: idx + 1 });
          return result;
        } catch (err: any) {
          lastError = err;
          this.trackRequest(key, true);
          this.handleKeyError(key, err);
          console.warn(`[GeminiKeyManager] Paid Key #${idx + 1} (${this.maskKey(key)}) error: ${err?.message || err}.`);
        }
      }
    }

    // 3. If all keys failed
    throw new Error(
      `Gemini AI service unavailable: ${lastError?.message || "All Free and Paid keys hit rate limits or failed."}`
    );
  }

  private handleKeyError(key: string, err: any) {
    const msg = (err?.message || String(err)).toLowerCase();
    const isAuthError = msg.includes("401") || msg.includes("unauthenticated") || msg.includes("invalid authentication");
    const isRateLimit =
      msg.includes("429") ||
      msg.includes("quota") ||
      msg.includes("resourceexhausted") ||
      msg.includes("503") ||
      msg.includes("overloaded") ||
      msg.includes("high demand");

    if (isAuthError) {
      // 24hr cooldown for invalid key
      this.cooldowns.set(key, Date.now() + 24 * 60 * 60 * 1000);
    } else if (isRateLimit) {
      this.cooldowns.set(key, Date.now() + DEFAULT_COOLDOWN_MS);
    }
  }

  private trackRequest(key: string, isFailed: boolean) {
    const current = this.requestCounts.get(key) || { total: 0, failed: 0 };
    current.total += 1;
    if (isFailed) current.failed += 1;
    this.requestCounts.set(key, current);
  }

  public maskKey(key: string): string {
    if (!key || key.length < 8) return "****";
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  }

  /**
   * Computes exact cost estimation in Indian Rupees (INR) and Paise.
   */
  public calculateCost(
    inputTokens: number,
    outputTokens: number,
    tier: "FREE" | "PAID",
    key: string
  ): CostEstimateResult {
    const inputCostUsd = (inputTokens / 1_000_000) * INPUT_TOKEN_PRICE_PER_MILLION_USD;
    const outputCostUsd = (outputTokens / 1_000_000) * OUTPUT_TOKEN_PRICE_PER_MILLION_USD;
    const totalCostUsd = inputCostUsd + outputCostUsd;
    const costInr = totalCostUsd * USD_TO_INR;
    const costPaise = tier === "FREE" ? 0.0 : Number((costInr * 100).toFixed(3));

    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      costInr: tier === "FREE" ? 0.0 : Number(costInr.toFixed(4)),
      costPaise,
      isFreeTier: tier === "FREE",
      tier,
      keyMasked: this.maskKey(key),
    };
  }
}

export const geminiKeyManager = GeminiKeyManager.getInstance();
