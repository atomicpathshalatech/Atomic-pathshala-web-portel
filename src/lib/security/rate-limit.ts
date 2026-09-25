import { NextRequest, NextResponse } from "next/server";

export type RateLimitTier = "AUTH" | "LIVE_STREAM" | "TEST_SERIES" | "PUBLIC" | "GENERAL";

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

export const RATE_LIMIT_PRESETS: Record<RateLimitTier, RateLimitConfig> = {
  AUTH: { limit: 10, windowMs: 60 * 1000 }, // 10 reqs / min (login, register, OTP)
  LIVE_STREAM: { limit: 120, windowMs: 60 * 1000 }, // 120 reqs / min (whiteboard strokes, polls, heartbeat)
  TEST_SERIES: { limit: 60, windowMs: 60 * 1000 }, // 60 reqs / min (quiz answer submit)
  PUBLIC: { limit: 30, windowMs: 60 * 1000 }, // 30 reqs / min (public landing, course views)
  GENERAL: { limit: 100, windowMs: 60 * 1000 }, // 100 reqs / min (default api calls)
};

interface RateLimitRecord {
  timestamps: number[];
}

// In-memory sliding window cache with automatic cleanup
class MemoryRateLimiter {
  private cache = new Map<string, RateLimitRecord>();
  private lastCleanup = Date.now();

  private cleanup(windowMs: number) {
    const now = Date.now();
    if (now - this.lastCleanup < 30000) return; // Clean up at most every 30s
    this.lastCleanup = now;

    for (const [key, record] of this.cache.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);
      if (record.timestamps.length === 0) {
        this.cache.delete(key);
      }
    }
  }

  public check(key: string, limit: number, windowMs: number): {
    success: boolean;
    limit: number;
    remaining: number;
    resetMs: number;
  } {
    const now = Date.now();
    this.cleanup(windowMs);

    let record = this.cache.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.cache.set(key, record);
    }

    // Filter out timestamps outside the sliding window
    record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

    if (record.timestamps.length >= limit) {
      const oldest = record.timestamps[0] || now;
      const resetMs = Math.max(0, oldest + windowMs - now);
      return {
        success: false,
        limit,
        remaining: 0,
        resetMs,
      };
    }

    record.timestamps.push(now);
    return {
      success: true,
      limit,
      remaining: Math.max(0, limit - record.timestamps.length),
      resetMs: windowMs,
    };
  }
}

const memoryLimiter = new MemoryRateLimiter();

/**
 * Extracts a client identifier from IP and headers
 */
export function getClientIp(req: NextRequest | Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",");
    if (parts[0]) return parts[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  return "127.0.0.1";
}

/**
 * Checks rate limit for a given request and tier
 */
export async function checkRateLimit(
  req: NextRequest | Request,
  tier: RateLimitTier = "GENERAL",
  customIdentifier?: string
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}> {
  const config = RATE_LIMIT_PRESETS[tier];
  const ip = getClientIp(req);
  const key = `ratelimit:${tier}:${customIdentifier || ip}`;

  // Use high-performance in-memory sliding window
  return memoryLimiter.check(key, config.limit, config.windowMs);
}

/**
 * Generates standard 429 Too Many Requests response with RFC headers
 */
export function rateLimitExceededResponse(result: {
  limit: number;
  remaining: number;
  resetMs: number;
}): NextResponse {
  const retryAfterSec = Math.ceil(result.resetMs / 1000);
  return NextResponse.json(
    {
      success: false,
      error: "Too many requests. Please slow down and try again shortly.",
      code: "RATE_LIMIT_EXCEEDED",
      retryAfterSeconds: retryAfterSec,
    },
    {
      status: 429,
      headers: {
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(Math.ceil((Date.now() + result.resetMs) / 1000)),
        "Retry-After": String(retryAfterSec),
      },
    }
  );
}
