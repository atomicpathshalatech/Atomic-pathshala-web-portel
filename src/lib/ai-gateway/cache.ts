/**
 * ATOMIC PATHSHALA — AI RESPONSE CACHE & IN-FLIGHT DEDUPLICATION
 * Prevents redundant calls, duplicate student clicks, and saves quota/cost.
 */

interface CacheEntry<T> {
  data: T;
  rawText: string;
  modelUsed: string;
  cachedAt: number;
  expiresAt: number;
  inputTokens: number;
  outputTokens: number;
}

export class AIReponseCache {
  private static instance: AIReponseCache;
  private cache = new Map<string, CacheEntry<any>>();
  private inFlightRequests = new Map<string, Promise<any>>();

  // Cache telemetry
  private stats = {
    hits: 0,
    misses: 0,
    inFlightDeduplicated: 0,
    tokensSaved: 0,
  };

  private constructor() {
    // Periodically sweep expired entries every 5 minutes
    if (typeof setInterval !== "undefined") {
      setInterval(() => this.purgeExpired(), 5 * 60 * 1000).unref?.();
    }
  }

  public static getInstance(): AIReponseCache {
    if (!AIReponseCache.instance) {
      AIReponseCache.instance = new AIReponseCache();
    }
    return AIReponseCache.instance;
  }

  public get<T>(hash: string): CacheEntry<T> | null {
    const entry = this.cache.get(hash);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(hash);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    this.stats.tokensSaved += entry.inputTokens + entry.outputTokens;
    return entry;
  }

  public set<T>(
    hash: string,
    data: T,
    rawText: string,
    modelUsed: string,
    ttlMs: number,
    inputTokens: number,
    outputTokens: number
  ): void {
    if (ttlMs <= 0) return;
    const now = Date.now();
    this.cache.set(hash, {
      data,
      rawText,
      modelUsed,
      cachedAt: now,
      expiresAt: now + ttlMs,
      inputTokens,
      outputTokens,
    });
  }

  /**
   * In-Flight Deduplication:
   * If an identical prompt is already executing, returns the existing Promise
   * instead of spawning a second API call to Google.
   */
  public async deduplicateInFlight<T>(hash: string, factory: () => Promise<T>): Promise<T> {
    const existing = this.inFlightRequests.get(hash);
    if (existing) {
      this.stats.inFlightDeduplicated++;
      return existing;
    }

    const promise = factory().finally(() => {
      this.inFlightRequests.delete(hash);
    });

    this.inFlightRequests.set(hash, promise);
    return promise;
  }

  public purgeExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  public getStats() {
    return {
      ...this.stats,
      cachedEntriesCount: this.cache.size,
      activeInFlightCount: this.inFlightRequests.size,
    };
  }

  public clear(): void {
    this.cache.clear();
    this.inFlightRequests.clear();
  }
}

export const aiResponseCache = AIReponseCache.getInstance();
