/**
 * ATOMIC PATHSHALA — MULTI-PROJECT & CREDENTIAL REGISTRY
 * Manages Google Cloud projects, credentials, workloads, and real-time health.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { AIProjectCredential, AIWorkloadRole } from "./types";

// Known disabled projects detected during live audit
const KNOWN_ZERO_QUOTA_CONSUMERS = new Set(["projects/401168136295", "projects/239005724824"]);

// Known key suffixes from audit that were depleted or zero-quota
const KNOWN_DEPLETED_KEY_SUFFIXES = new Set(["9XCwuA", "tZdgbw"]);
const KNOWN_ZERO_QUOTA_KEY_SUFFIXES = new Set(["av1XGw", "uvlSQw"]);

export class AIProjectRegistry {
  private static instance: AIProjectRegistry;
  private projects = new Map<string, AIProjectCredential>();

  private constructor() {
    this.initializeRegistry();
  }

  public static getInstance(): AIProjectRegistry {
    if (!AIProjectRegistry.instance) {
      AIProjectRegistry.instance = new AIProjectRegistry();
    }
    return AIProjectRegistry.instance;
  }

  public mask(key: string): string {
    if (!key || key.length < 10) return "****";
    return `${key.slice(0, 6)}...${key.slice(-4)}`;
  }

  /**
   * Initializes and organizes keys into logical multi-project workload pools.
   */
  public initializeRegistry(): void {
    // If process.env doesn't have GEMINI_API_KEY, load from .env files
    if (!process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEYS) {
      for (const envFile of [".env.local", ".env.production", ".env"]) {
        const p = path.join(process.cwd(), envFile);
        if (fs.existsSync(p)) {
          try {
            const content = fs.readFileSync(p, "utf-8");
            for (const line of content.split("\n")) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith("#")) continue;
              const idx = trimmed.indexOf("=");
              if (idx !== -1) {
                const k = trimmed.slice(0, idx).trim();
                const v = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
                if (k.startsWith("GEMINI_") && !process.env[k]) {
                  process.env[k] = v;
                }
              }
            }
          } catch {
            // Ignore read errors
          }
        }
      }
    }

    const rawSingle = process.env.GEMINI_API_KEY?.trim() || "";
    const rawMulti = process.env.GEMINI_API_KEYS?.trim() || "";
    const rawFree = process.env.GEMINI_FREE_KEYS?.trim() || "";
    const rawPaid = process.env.GEMINI_PAID_KEYS?.trim() || "";

    const allRaw = [rawSingle, rawMulti, rawFree, rawPaid]
      .filter(Boolean)
      .join(",")
      .split(/[\s,;]+/)
      .map((k) => k.trim().replace(/^["']|["']$/g, ""))
      .filter((k) => k.length > 20 && !k.includes("your_gemini_api_key"));

    const uniqueKeys = Array.from(new Set(allRaw));

    // Logical role rotation across healthy keys
    const roles: AIWorkloadRole[] = [
      "STUDENT_PRACTICE",
      "STUDENT_PRACTICE",
      "AI_TUTOR",
      "AI_TUTOR",
      "TEST_PORTAL",
      "DOCUMENT_PROCESSING",
      "DOCUMENT_PROCESSING",
      "CRM_ANALYSIS",
      "BACKUP_FAILOVER",
    ];

    let healthyIdx = 0;

    for (let i = 0; i < uniqueKeys.length; i++) {
      const key = uniqueKeys[i]!;
      const suffix = key.slice(-6);
      const isKnownZero = KNOWN_ZERO_QUOTA_KEY_SUFFIXES.has(suffix);
      const isKnownDepleted = KNOWN_DEPLETED_KEY_SUFFIXES.has(suffix);

      let role: AIWorkloadRole = "BACKUP_FAILOVER";
      let isHealthy = true;
      let failureReason: string | undefined = undefined;

      if (isKnownZero) {
        isHealthy = false;
        failureReason = "Google Cloud Project quota_limit_value is 0 for this region.";
      } else if (isKnownDepleted) {
        isHealthy = false;
        failureReason = "Prepayment credits depleted (HTTP 402). Top up in Google AI Studio.";
      } else {
        role = roles[healthyIdx % roles.length]!;
        healthyIdx++;
      }

      const id = `proj-gemini-${i + 1}`;
      const name = isHealthy ? `Gemini ${role.replace(/_/g, " ")} #${healthyIdx}` : `Gemini Quota-Restricted #${i + 1}`;

      const credential: AIProjectCredential = {
        id,
        name,
        assignedRole: role,
        maskedKey: this.mask(key),
        rawKey: key,
        billingType: isKnownDepleted ? "PAID_PREPAY" : "FREE",
        enabled: isHealthy,
        isHealthy,
        failureReason,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        rpmQuotaLimit: 15,
        activeInFlightRequests: 0,
      };

      this.projects.set(id, credential);
    }
  }

  /**
   * Selects the best eligible project credential for a given workload.
   * Prioritizes healthy projects assigned to the workload, then healthy backup failover projects.
   */
  public selectProject(workload: AIWorkloadRole): AIProjectCredential | null {
    const now = Date.now();
    const all = Array.from(this.projects.values());

    const isAvailable = (p: AIProjectCredential) =>
      p.enabled &&
      p.isHealthy &&
      (p.cooldownUntil || 0) <= now &&
      p.activeInFlightRequests < 3; // Max 3 concurrent requests per key

    // 1. Try projects dedicated to this workload
    const dedicated = all.filter((p) => p.assignedRole === workload && isAvailable(p));
    if (dedicated.length > 0) {
      // Pick the one with lowest active in-flight requests or round-robin
      dedicated.sort((a, b) => a.activeInFlightRequests - b.activeInFlightRequests || a.totalRequests - b.totalRequests);
      return dedicated[0]!;
    }

    // 2. Try BACKUP_FAILOVER projects
    const backup = all.filter((p) => p.assignedRole === "BACKUP_FAILOVER" && isAvailable(p));
    if (backup.length > 0) {
      backup.sort((a, b) => a.activeInFlightRequests - b.activeInFlightRequests);
      return backup[0]!;
    }

    // 3. Last resort: Any healthy project not in cooldown
    const anyHealthy = all.filter((p) => isAvailable(p));
    if (anyHealthy.length > 0) {
      anyHealthy.sort((a, b) => a.activeInFlightRequests - b.activeInFlightRequests);
      return anyHealthy[0]!;
    }

    // 4. Overload Fallback: If all healthy projects have >= 3 in-flight, pick the one with lowest load
    const anyNonCooldown = all.filter((p) => p.enabled && p.isHealthy && (p.cooldownUntil || 0) <= now);
    if (anyNonCooldown.length > 0) {
      anyNonCooldown.sort((a, b) => a.activeInFlightRequests - b.activeInFlightRequests);
      return anyNonCooldown[0]!;
    }

    return null;
  }

  /**
   * Reports error or rate limit to update credential health and adaptive cooldown.
   */
  public recordResult(
    projectId: string,
    success: boolean,
    opts: { isRateLimit?: boolean; isDepleted?: boolean; is403?: boolean; retryAfterMs?: number; errorMsg?: string } = {}
  ): void {
    const proj = this.projects.get(projectId);
    if (!proj) return;

    proj.totalRequests++;
    if (success) {
      proj.successfulRequests++;
      proj.lastSuccessAt = Date.now();
      proj.isHealthy = true;
      proj.failureReason = undefined;
    } else {
      proj.failedRequests++;
      proj.lastFailureAt = Date.now();
      proj.failureReason = opts.errorMsg || "API failure";

      if (opts.isDepleted) {
        proj.isHealthy = false;
        proj.enabled = false;
        proj.failureReason = "Prepayment credits depleted (HTTP 402).";
      } else if (opts.is403) {
        proj.isHealthy = false;
        proj.enabled = false;
        proj.failureReason = "Permission denied or API key revoked (HTTP 403).";
      } else if (opts.isRateLimit) {
        // Adaptive cooldown based on Retry-After
        const waitMs = opts.retryAfterMs && opts.retryAfterMs > 10_000 ? Math.min(opts.retryAfterMs, 60 * 60 * 1000) : 30_000;
        proj.cooldownUntil = Date.now() + waitMs;
      }
    }
  }

  public incrementInFlight(projectId: string): void {
    const proj = this.projects.get(projectId);
    if (proj) proj.activeInFlightRequests++;
  }

  public decrementInFlight(projectId: string): void {
    const proj = this.projects.get(projectId);
    if (proj && proj.activeInFlightRequests > 0) proj.activeInFlightRequests--;
  }

  public getProjects(): AIProjectCredential[] {
    return Array.from(this.projects.values());
  }

  public toggleProject(projectId: string, enabled: boolean): void {
    const proj = this.projects.get(projectId);
    if (proj) proj.enabled = enabled;
  }
}

export const aiProjectRegistry = AIProjectRegistry.getInstance();
