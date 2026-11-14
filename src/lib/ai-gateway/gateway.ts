/**
 * ATOMIC PATHSHALA — CENTRAL GEMINI AI PROVIDER GATEWAY
 * The single, authoritative entry point for all Gemini calls across the platform.
 */

import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { prisma } from "@/lib/db";
import {
  AIGatewayRequestOptions,
  AIGatewayResponse,
  AIProviderTelemetry,
} from "./types";
import { aiProjectRegistry } from "./project-registry";
import { aiModelRouter } from "./model-router";
import { aiCircuitBreaker } from "./circuit-breaker";
import { aiRequestQueue } from "./request-queue";
import { aiResponseCache } from "./cache";
import {
  calculateAICost,
  estimateTokenCount,
  hashPrompt,
  optimizePromptTokens,
} from "./token-estimator";

export class GeminiAIService {
  private static instance: GeminiAIService;
  private telemetryLog: AIProviderTelemetry[] = [];
  private maxTelemetryHistory = 200;

  private constructor() {}

  public static getInstance(): GeminiAIService {
    if (!GeminiAIService.instance) {
      GeminiAIService.instance = new GeminiAIService();
    }
    return GeminiAIService.instance;
  }

  /**
   * Main text/multimodal content generation entry point.
   */
  public async generateContent(
    prompt: string | Part[],
    options: AIGatewayRequestOptions
  ): Promise<AIGatewayResponse<string>> {
    const startTime = Date.now();
    const isTextOnly = typeof prompt === "string";
    const promptText = isTextOnly ? (prompt as string) : "[Multimodal Content]";
    const optimizedPrompt = isTextOnly ? optimizePromptTokens(promptText) : prompt;

    const cacheHash = isTextOnly ? hashPrompt(optimizedPrompt as string, options.workload) : null;
    const ttlMs = options.cacheTtlMs ?? (options.workload === "STUDENT_PRACTICE" || options.workload === "AI_TUTOR" ? 300_000 : 0);

    // 1. Check Response Cache
    if (cacheHash && ttlMs > 0) {
      const cached = aiResponseCache.get<string>(cacheHash);
      if (cached) {
        const cost = calculateAICost(cached.inputTokens, cached.outputTokens, cached.modelUsed);
        return {
          data: cached.data,
          rawText: cached.rawText,
          modelUsed: cached.modelUsed,
          projectUsed: "cache",
          keyMasked: "cached",
          durationMs: Date.now() - startTime,
          cost,
          cached: true,
          requestId: options.requestId || "cached",
        };
      }
    }

    // 2. In-flight Deduplication & Priority Scheduling
    const executionTask = async (): Promise<AIGatewayResponse<string>> => {
      const priority = options.priority ?? (options.workload === "STUDENT_PRACTICE" || options.workload === "AI_TUTOR" ? 1 : 3);
      return aiRequestQueue.schedule(priority, async () => {
        return this.executeWithFailover(optimizedPrompt, options, startTime);
      });
    };

    if (cacheHash) {
      const result = await aiResponseCache.deduplicateInFlight(cacheHash, executionTask);
      if (ttlMs > 0 && result.data) {
        aiResponseCache.set(
          cacheHash,
          result.data,
          result.rawText,
          result.modelUsed,
          ttlMs,
          result.cost.inputTokens,
          result.cost.outputTokens
        );
      }
      return result;
    }

    return executionTask();
  }

  /**
   * Internal failover loop across projects and candidate models.
   */
  private async executeWithFailover(
    content: string | Part[],
    options: AIGatewayRequestOptions,
    startTime: number
  ): Promise<AIGatewayResponse<string>> {
    const candidateModels = aiModelRouter.getCandidateModels(options.complexity, options.preferredModel);
    let lastError: any = null;

    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // 1. Select healthy project for workload
      const project = aiProjectRegistry.selectProject(options.workload);
      if (!project) {
        throw new Error(
          `All Gemini AI projects for ${options.workload} are currently rate-limited or in cooldown. Please wait a moment.`
        );
      }

      const circuitKey = `${project.id}`;
      if (!aiCircuitBreaker.canExecute(circuitKey)) {
        continue;
      }

      aiProjectRegistry.incrementInFlight(project.id);

      try {
        const genAI = new GoogleGenerativeAI(project.rawKey);

        // Try candidate models in order
        for (const modelName of candidateModels) {
          try {
            const thinking = aiModelRouter.getThinkingConfig(modelName);
            const model = genAI.getGenerativeModel({
              model: modelName,
              generationConfig: {
                maxOutputTokens: options.maxTokens || 4096,
                temperature: options.temperature !== undefined ? options.temperature : 0.2,
                ...thinking,
              },
            });

            const promptPayload = typeof content === "string" ? content : (content as any);
            const callTimeoutMs = options.timeoutMs || 10_000;
            const res: any = await Promise.race([
              model.generateContent(promptPayload),
              new Promise((_, reject) =>
                setTimeout(
                  () => reject(new Error(`Gemini call timed out after ${callTimeoutMs}ms on ${modelName}`)),
                  callTimeoutMs
                )
              ),
            ]);
            const responseText = res.response.text();

            if (!responseText || !responseText.trim()) {
              throw new Error("Gemini returned an empty response.");
            }

            // Success: record telemetry
            const durationMs = Date.now() - startTime;
            const inputTokens = estimateTokenCount(typeof content === "string" ? content : "multimodal");
            const outputTokens = estimateTokenCount(responseText);
            const cost = calculateAICost(inputTokens, outputTokens, modelName);

            aiProjectRegistry.recordResult(project.id, true);
            aiCircuitBreaker.recordSuccess(circuitKey);

            this.logTelemetry({
              timestamp: Date.now(),
              workload: options.workload,
              model: modelName,
              project: project.name,
              durationMs,
              inputTokens,
              outputTokens,
              costInr: cost.costInr,
              ok: true,
            });

            // Async persist to db without blocking response
            this.persistUsageLog({
              feature: options.workload,
              provider: "gemini",
              model: modelName,
              inputTokens,
              outputTokens,
              durationMs,
              ok: true,
            });

            return {
              data: responseText,
              rawText: responseText,
              modelUsed: modelName,
              projectUsed: project.name,
              keyMasked: project.maskedKey,
              durationMs,
              cost,
              cached: false,
              requestId: options.requestId || Math.random().toString(36).substring(7),
            };
          } catch (modelErr: any) {
            const msg = String(modelErr?.message || modelErr).toLowerCase();

            // 503 Overload: mark model busy and move to next model
            if (msg.includes("503") || msg.includes("overloaded") || msg.includes("high demand")) {
              aiModelRouter.markModelBusy(modelName);
              continue;
            }

            // 404 Model not found: retire model and continue
            if (msg.includes("404") || msg.includes("not found")) {
              aiModelRouter.toggleModel(modelName, false);
              continue;
            }

            // If it's a project-level rate limit or auth error, break model loop to switch project
            if (msg.includes("429") || msg.includes("quota") || msg.includes("403") || msg.includes("402")) {
              throw modelErr;
            }

            lastError = modelErr;
          }
        }
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err).toLowerCase();
        const isDepleted = msg.includes("402") || msg.includes("depleted");
        const is403 = msg.includes("403") || msg.includes("permission_denied") || msg.includes("invalid");
        const isRateLimit = msg.includes("429") || msg.includes("quota") || msg.includes("resourceexhausted");

        aiProjectRegistry.recordResult(project.id, false, {
          isRateLimit,
          isDepleted,
          is403,
          errorMsg: msg.slice(0, 120),
        });

        aiCircuitBreaker.recordFailure(circuitKey, isDepleted || is403);

        // Exponential backoff with jitter before trying next project
        await aiCircuitBreaker.waitWithJitter(attempt);
      } finally {
        aiProjectRegistry.decrementInFlight(project.id);
      }
    }

    // All attempts failed
    const errorMsg = lastError?.message || "Gemini AI Provider temporarily unavailable across all configured projects.";
    this.logTelemetry({
      timestamp: Date.now(),
      workload: options.workload,
      model: "failover-exhausted",
      project: "all",
      durationMs: Date.now() - startTime,
      inputTokens: 0,
      outputTokens: 0,
      costInr: 0,
      ok: false,
      errorCode: errorMsg.slice(0, 80),
    });

    throw new Error(errorMsg);
  }

  private logTelemetry(entry: AIProviderTelemetry): void {
    this.telemetryLog.unshift(entry);
    if (this.telemetryLog.length > this.maxTelemetryHistory) {
      this.telemetryLog.pop();
    }
  }

  private persistUsageLog(log: {
    feature: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
    ok: boolean;
    error?: string;
  }): void {
    prisma.aiUsageLog
      .create({
        data: log,
      })
      .catch(() => undefined);
  }

  public getTelemetry(): AIProviderTelemetry[] {
    return this.telemetryLog;
  }
}

export const aiProviderGateway = GeminiAIService.getInstance();
