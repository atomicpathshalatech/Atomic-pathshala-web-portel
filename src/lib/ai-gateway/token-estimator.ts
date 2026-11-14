/**
 * ATOMIC PATHSHALA — AI TOKEN ESTIMATOR & COST CALCULATOR
 * Optimizes prompts, estimates token counts, and calculates costs.
 */

import crypto from "crypto";
import { AICostEstimate, ModelComplexityTier } from "./types";

// Pricing table (USD per 1 Million Tokens) - Updated Nov 2026 for Gemini 3 / Flash family
export const MODEL_TOKEN_PRICING: Record<string, { inputUsdPerM: number; outputUsdPerM: number }> = {
  "gemini-3.1-flash-lite": { inputUsdPerM: 0.075, outputUsdPerM: 0.30 },
  "gemini-3.1-flash-lite-preview": { inputUsdPerM: 0.075, outputUsdPerM: 0.30 },
  "gemini-flash-lite-latest": { inputUsdPerM: 0.075, outputUsdPerM: 0.30 },
  "gemini-3.5-flash-lite": { inputUsdPerM: 0.075, outputUsdPerM: 0.30 },
  "gemini-3-flash-preview": { inputUsdPerM: 0.10, outputUsdPerM: 0.40 },
  "gemini-flash-latest": { inputUsdPerM: 0.10, outputUsdPerM: 0.40 },
  "gemini-3.6-flash": { inputUsdPerM: 0.15, outputUsdPerM: 0.60 },
  "gemini-3.7-flash": { inputUsdPerM: 0.15, outputUsdPerM: 0.60 },
  default: { inputUsdPerM: 0.10, outputUsdPerM: 0.40 },
};

export const USD_TO_INR = 87.25;

/**
 * Fast client/server token estimator (~4 characters per token for English, ~2 chars per token for Devanagari Hindi/Hinglish).
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  // Check if string contains Devanagari characters (Unicode range U+0900 to U+097F)
  const devanagariCount = (text.match(/[\u0900-\u097F]/g) || []).length;
  const nonDevanagariCount = text.length - devanagariCount;

  // Devanagari script uses more byte/token encoding in BPE tokenizers
  const devanagariTokens = Math.ceil(devanagariCount / 1.5);
  const latinTokens = Math.ceil(nonDevanagariCount / 3.8);

  return Math.max(1, devanagariTokens + latinTokens);
}

/**
 * Computes exact cost estimate in USD, INR and Paise.
 */
export function calculateAICost(
  inputTokens: number,
  outputTokens: number,
  modelName: string
): AICostEstimate {
  const pricing = MODEL_TOKEN_PRICING[modelName] || MODEL_TOKEN_PRICING.default;
  const inputUsd = (inputTokens / 1_000_000) * pricing.inputUsdPerM;
  const outputUsd = (outputTokens / 1_000_000) * pricing.outputUsdPerM;
  const totalUsd = inputUsd + outputUsd;

  const costInr = Number((totalUsd * USD_TO_INR).toFixed(4));
  const costPaise = Number((costInr * 100).toFixed(2));

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    costUsd: Number(totalUsd.toFixed(6)),
    costInr,
    costPaise,
  };
}

/**
 * Deterministic prompt hashing for deduplication and caching.
 */
export function hashPrompt(prompt: string, context: string = ""): string {
  const normalized = `${prompt.trim()}|||${context.trim()}`.toLowerCase().replace(/\s+/g, " ");
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

/**
 * Strips redundant whitespace and repetitive prompt templates to minimize token consumption.
 */
export function optimizePromptTokens(rawPrompt: string): string {
  if (!rawPrompt) return "";
  return rawPrompt
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}
