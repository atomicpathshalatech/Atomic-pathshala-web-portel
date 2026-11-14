/**
 * ATOMIC PATHSHALA — INTELLIGENT MODEL ROUTER
 * Routes tasks to optimal, cost-efficient, live-tested Gemini models.
 */

import { AIModelConfig, ModelComplexityTier } from "./types";

/**
 * Verified Live Google Gemini Models (Nov 2026).
 * Ranked by speed, reliability, and cost-efficiency.
 */
export const VERIFIED_MODELS: Record<string, AIModelConfig> = {
  // --- TIER 1: LOW-COST / HIGH-SPEED (Primary for Student Practice & MCQ Doubts) ---
  "gemini-3.1-flash-lite": {
    id: "gemini-3.1-flash-lite",
    displayName: "Gemini 3.1 Flash Lite (Ultra-Fast)",
    tier: "LOW_COST",
    contextWindowTokens: 1_048_576,
    maxOutputTokens: 65_536,
    inputPricePerMillionUsd: 0.075,
    outputPricePerMillionUsd: 0.30,
    supportsThinking: true,
    enabled: true,
  },
  "gemini-flash-lite-latest": {
    id: "gemini-flash-lite-latest",
    displayName: "Gemini Flash Lite (Latest)",
    tier: "LOW_COST",
    contextWindowTokens: 1_048_576,
    maxOutputTokens: 65_536,
    inputPricePerMillionUsd: 0.075,
    outputPricePerMillionUsd: 0.30,
    supportsThinking: true,
    enabled: true,
  },
  "gemini-3.5-flash-lite": {
    id: "gemini-3.5-flash-lite",
    displayName: "Gemini 3.5 Flash Lite",
    tier: "LOW_COST",
    contextWindowTokens: 1_048_576,
    maxOutputTokens: 65_536,
    inputPricePerMillionUsd: 0.075,
    outputPricePerMillionUsd: 0.30,
    supportsThinking: true,
    enabled: true,
  },

  // --- TIER 2: BALANCED / REASONING (Question Extraction, Numericals, Study Plans) ---
  "gemini-3-flash-preview": {
    id: "gemini-3-flash-preview",
    displayName: "Gemini 3 Flash Preview",
    tier: "BALANCED",
    contextWindowTokens: 1_048_576,
    maxOutputTokens: 65_536,
    inputPricePerMillionUsd: 0.10,
    outputPricePerMillionUsd: 0.40,
    supportsThinking: true,
    enabled: true,
  },
  "gemini-flash-latest": {
    id: "gemini-flash-latest",
    displayName: "Gemini Flash (Latest)",
    tier: "BALANCED",
    contextWindowTokens: 1_048_576,
    maxOutputTokens: 65_536,
    inputPricePerMillionUsd: 0.10,
    outputPricePerMillionUsd: 0.40,
    supportsThinking: true,
    enabled: true,
  },

  // --- TIER 3: HIGH-COMPLEXITY (Deep Physics/Chemistry, Multi-Step Proofs) ---
  "gemini-3.6-flash": {
    id: "gemini-3.6-flash",
    displayName: "Gemini 3.6 Flash (Advanced Reasoning)",
    tier: "HIGH_COMPLEXITY",
    contextWindowTokens: 1_048_576,
    maxOutputTokens: 65_536,
    inputPricePerMillionUsd: 0.15,
    outputPricePerMillionUsd: 0.60,
    supportsThinking: true,
    enabled: true,
  },
  "gemini-3.7-flash": {
    id: "gemini-3.7-flash",
    displayName: "Gemini 3.7 Flash",
    tier: "HIGH_COMPLEXITY",
    contextWindowTokens: 1_048_576,
    maxOutputTokens: 65_536,
    inputPricePerMillionUsd: 0.15,
    outputPricePerMillionUsd: 0.60,
    supportsThinking: true,
    enabled: true,
  },
};

/**
 * Problematic / Overloaded Models that must NEVER be called in default fast chains.
 * `gemini-3.8-flash` takes 15+ seconds to return 503 Overload.
 */
export const BLACKLISTED_MODELS = new Set([
  "gemini-3.8-flash", // High-demand 503 hang trap
  "gemini-1.5-flash", // Retired 404
  "gemini-1.5-pro",   // Retired 404
  "gemini-2.0-flash", // Retired 404
  "gemini-2.5-flash", // Retired 404
]);

export class AIModelRouter {
  private static instance: AIModelRouter;
  private modelCatalog = new Map<string, AIModelConfig>(Object.entries(VERIFIED_MODELS));
  private busyModels = new Map<string, number>();

  private constructor() {}

  public static getInstance(): AIModelRouter {
    if (!AIModelRouter.instance) {
      AIModelRouter.instance = new AIModelRouter();
    }
    return AIModelRouter.instance;
  }

  /**
   * Returns ordered fallback list of model IDs for a given task complexity.
   */
  public getCandidateModels(tier: ModelComplexityTier = "LOW_COST", preferred?: string): string[] {
    const now = Date.now();
    const candidates: string[] = [];

    if (preferred && !BLACKLISTED_MODELS.has(preferred)) {
      candidates.push(preferred);
    }

    if (tier === "LOW_COST") {
      candidates.push(
        "gemini-3.1-flash-lite",
        "gemini-flash-lite-latest",
        "gemini-3.5-flash-lite",
        "gemini-3-flash-preview",
        "gemini-flash-latest"
      );
    } else if (tier === "BALANCED") {
      candidates.push(
        "gemini-3-flash-preview",
        "gemini-3.1-flash-lite",
        "gemini-flash-latest",
        "gemini-flash-lite-latest",
        "gemini-3.6-flash"
      );
    } else {
      // HIGH_COMPLEXITY
      candidates.push(
        "gemini-3.6-flash",
        "gemini-3-flash-preview",
        "gemini-3.7-flash",
        "gemini-3.1-flash-lite",
        "gemini-flash-latest"
      );
    }

    // Deduplicate and filter out blacklisted or disabled models
    const unique = Array.from(new Set(candidates)).filter((m) => {
      if (BLACKLISTED_MODELS.has(m)) return false;
      const cfg = this.modelCatalog.get(m);
      return !cfg || cfg.enabled;
    });

    // Move currently busy (503 overloaded) models to the very end
    const notBusy = unique.filter((m) => (this.busyModels.get(m) || 0) <= now);
    const busy = unique.filter((m) => (this.busyModels.get(m) || 0) > now);

    return [...notBusy, ...busy];
  }

  public markModelBusy(model: string, durationMs: number = 60_000): void {
    this.busyModels.set(model, Date.now() + durationMs);
  }

  public getModelConfig(modelId: string): AIModelConfig | null {
    return this.modelCatalog.get(modelId) || null;
  }

  public getAllModels(): AIModelConfig[] {
    return Array.from(this.modelCatalog.values());
  }

  public toggleModel(modelId: string, enabled: boolean): void {
    const existing = this.modelCatalog.get(modelId);
    if (existing) {
      this.modelCatalog.set(modelId, { ...existing, enabled });
    }
  }

  /**
   * Safe thinking configuration for Gemini 3 models to prevent mid-JSON truncations.
   */
  public getThinkingConfig(modelId: string): { thinkingConfig?: { thinkingLevel: "minimal" | "low" } } {
    return { thinkingConfig: { thinkingLevel: "minimal" } };
  }
}

export const aiModelRouter = AIModelRouter.getInstance();
