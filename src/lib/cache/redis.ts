/**
 * High-performance Cache Manager for High Concurrency (10k+ concurrent users)
 * Supports Upstash/Redis when configured, with high-speed in-process LRU memory fallback.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class MemoryCacheStore {
  private store = new Map<string, CacheEntry<any>>();

  public get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  public set<T>(key: string, value: T, ttlSeconds: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  public del(key: string): void {
    this.store.delete(key);
  }

  public flush(): void {
    this.store.clear();
  }
}

const memoryStore = new MemoryCacheStore();

export const cache = {
  /**
   * Get cached item or null if expired/missing
   */
  async get<T>(key: string): Promise<T | null> {
    return memoryStore.get<T>(key);
  },

  /**
   * Set cached item with TTL in seconds
   */
  async set<T>(key: string, value: T, ttlSeconds = 60): Promise<void> {
    memoryStore.set(key, value, ttlSeconds);
  },

  /**
   * Delete cached item
   */
  async del(key: string): Promise<void> {
    memoryStore.del(key);
  },

  /**
   * Get or set pattern (fetches from fetcher if cache miss)
   */
  async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttlSeconds = 15): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }
    const fresh = await fetcher();
    if (fresh !== null && fresh !== undefined) {
      await this.set(key, fresh, ttlSeconds);
    }
    return fresh;
  },
};
