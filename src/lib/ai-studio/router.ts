import "server-only";
import { prisma } from "@/lib/prisma";
import { assertStudioBudget, recordStudioUsage, usdToInr } from "./budget";
import { invokeTextProvider, isEnvKeyConfigured } from "./providers/text-adapters";
import { invokeImageProvider, invokeVoiceProvider } from "./providers/media-adapters";
import {
  StudioImageRequest,
  StudioImageResponse,
  StudioModality,
  StudioProviderDescriptor,
  StudioProviderError,
  StudioTaskType,
  StudioTextRequest,
  StudioTextResponse,
  StudioVoiceRequest,
  StudioVoiceResponse,
} from "./types";

export const DEFAULT_STUDIO_PROVIDERS: StudioProviderDescriptor[] = [
  {
    provider: "GEMINI",
    modality: "TEXT",
    taskType: "GENERAL",
    modelId: "gemini-3-flash-preview",
    displayName: "Gemini 3 Flash Preview",
    envKeyRef: "GEMINI_API_KEY",
    priority: 10,
    isEnabled: true,
    isDefault: true,
    timeoutMs: 30000,
    inputCostPer1M: 0.1,
    outputCostPer1M: 0.4,
    unitCostUsd: 0,
  },
  {
    provider: "OPENAI",
    modality: "TEXT",
    taskType: "GENERAL",
    modelId: process.env.OPENAI_MODEL || "gpt-4o",
    displayName: "OpenAI GPT-4o",
    envKeyRef: "OPENAI_API_KEY",
    priority: 20,
    isEnabled: true,
    isDefault: false,
    timeoutMs: 30000,
    inputCostPer1M: 2.5,
    outputCostPer1M: 10.0,
    unitCostUsd: 0,
  },
  {
    provider: "XAI_GROK",
    modality: "TEXT",
    taskType: "GENERAL",
    modelId: process.env.XAI_MODEL || process.env.GROK_MODEL || "grok-2-latest",
    displayName: "xAI Grok 2",
    envKeyRef: "XAI_API_KEY",
    priority: 30,
    isEnabled: true,
    isDefault: false,
    timeoutMs: 30000,
    inputCostPer1M: 2.0,
    outputCostPer1M: 10.0,
    unitCostUsd: 0,
  },
  {
    provider: "GROQ",
    modality: "TEXT",
    taskType: "GENERAL",
    modelId: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
    displayName: "Groq Reasoning",
    envKeyRef: "GROQ_API_KEY",
    priority: 40,
    isEnabled: true,
    isDefault: false,
    timeoutMs: 25000,
    inputCostPer1M: 0.2,
    outputCostPer1M: 0.6,
    unitCostUsd: 0,
  },
  {
    provider: "ANTHROPIC",
    modality: "TEXT",
    taskType: "GENERAL",
    modelId: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
    displayName: "Claude 3.5 Sonnet",
    envKeyRef: "ANTHROPIC_API_KEY",
    priority: 50,
    isEnabled: true,
    isDefault: false,
    timeoutMs: 30000,
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
    unitCostUsd: 0,
  },
  {
    provider: "OPENAI",
    modality: "IMAGE",
    taskType: "GENERAL",
    modelId: "dall-e-3",
    displayName: "OpenAI DALL-E 3",
    envKeyRef: "OPENAI_API_KEY",
    priority: 10,
    isEnabled: true,
    isDefault: true,
    timeoutMs: 45000,
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    unitCostUsd: 0.04,
  },
  {
    provider: "OPENAI",
    modality: "VOICE",
    taskType: "GENERAL",
    modelId: "tts-1",
    displayName: "OpenAI TTS-1",
    envKeyRef: "OPENAI_API_KEY",
    priority: 10,
    isEnabled: true,
    isDefault: true,
    timeoutMs: 45000,
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    unitCostUsd: 0.015,
  },
];

function withTimeout<T>(promise: Promise<T>, ms: number, provider: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new StudioProviderError(`${provider} timed out after ${ms}ms`, "TIMEOUT", provider, true));
    }, ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function resolveProviderChain(
  modality: StudioModality,
  preferredProvider?: string,
  preferredModel?: string,
  taskType: StudioTaskType = "GENERAL"
): Promise<StudioProviderDescriptor[]> {
  const dbRows = await prisma.aiProviderConfig.findMany({
    where: {
      modality,
      isEnabled: true,
      taskType: { in: [taskType, "GENERAL"] },
    },
    orderBy: [{ isDefault: "desc" }, { priority: "asc" }],
  });

  const candidates: StudioProviderDescriptor[] =
    dbRows.length > 0
      ? dbRows
          .sort((a, b) => {
            const aExact = a.taskType === taskType ? 0 : 1;
            const bExact = b.taskType === taskType ? 0 : 1;
            if (aExact !== bExact) return aExact - bExact;
            if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
            return a.priority - b.priority;
          })
          .map((r) => ({
            id: r.id,
            provider: r.provider,
            modality: r.modality as StudioModality,
            taskType: r.taskType,
            modelId: r.modelId,
            displayName: r.displayName,
            envKeyRef: r.envKeyRef,
            priority: r.priority,
            isEnabled: r.isEnabled,
            isDefault: r.isDefault,
            fallbackConfigId: r.fallbackConfigId,
            fallbackProvider: r.fallbackProvider,
            fallbackModelId: r.fallbackModelId,
            timeoutMs: r.timeoutMs,
            inputCostPer1M: r.inputCostPer1M,
            outputCostPer1M: r.outputCostPer1M,
            unitCostUsd: r.unitCostUsd,
            configJson: (r.configJson as Record<string, unknown> | null) ?? null,
          }))
      : DEFAULT_STUDIO_PROVIDERS.filter((p) => p.modality === modality && p.isEnabled);

  const configured = candidates.filter((c) => isEnvKeyConfigured(c.envKeyRef));
  const pool = configured.length > 0 ? configured : candidates;

  if (!preferredProvider && !preferredModel) {
    return pool;
  }

  return [...pool].sort((a, b) => {
    const aMatch =
      (preferredProvider ? a.provider === preferredProvider : true) &&
      (preferredModel ? a.modelId === preferredModel : true);
    const bMatch =
      (preferredProvider ? b.provider === preferredProvider : true) &&
      (preferredModel ? b.modelId === preferredModel : true);
    if (aMatch && !bMatch) return -1;
    if (!aMatch && bMatch) return 1;
    return a.priority - b.priority;
  });
}

function computeTokenCostUsd(
  inputTokens: number,
  outputTokens: number,
  cfg: StudioProviderDescriptor
): number | null {
  if (cfg.inputCostPer1M <= 0 && cfg.outputCostPer1M <= 0) {
    return null;
  }
  const cost =
    (inputTokens / 1_000_000) * cfg.inputCostPer1M +
    (outputTokens / 1_000_000) * cfg.outputCostPer1M;
  return Number(cost.toFixed(6));
}

export interface CompareModelResult {
  provider: string;
  model: string;
  displayName: string;
  ok: boolean;
  text?: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs: number;
  costUsd: number | null;
  costInr: number | null;
  error?: string;
}

export class StudioProviderRouter {
  public async generateText(request: StudioTextRequest): Promise<StudioTextResponse> {
    await assertStudioBudget({
      userId: request.userId,
      roleName: request.roleName,
      projectId: request.projectId,
      estimatedCostUsd: 0.01,
    });

    const chain = await resolveProviderChain(
      "TEXT",
      request.preferredProvider,
      request.preferredModel,
      request.taskType || "GENERAL"
    );

    if (chain.length === 0) {
      throw new StudioProviderError("No enabled TEXT providers configured", "NOT_CONFIGURED", "ROUTER", false);
    }

    const maxRetries = Math.min(2, request.maxRetries ?? 1);
    let lastError: unknown = null;

    for (let i = 0; i < chain.length; i++) {
      const candidate = chain[i];
      if (!candidate) continue;
      const isFallback = i > 0;
      const timeoutMs = request.timeoutMs ?? candidate.timeoutMs ?? 30000;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const res = await withTimeout(
            invokeTextProvider({
              provider: candidate.provider,
              modelId: candidate.modelId,
              envKeyRef: candidate.envKeyRef,
              request,
            }),
            timeoutMs,
            candidate.provider
          );
          const costUsd = computeTokenCostUsd(res.inputTokens, res.outputTokens, candidate);
          await recordStudioUsage({
            feature: request.feature,
            provider: candidate.provider,
            model: candidate.modelId,
            modality: "TEXT",
            userId: request.userId,
            projectId: request.projectId,
            jobId: request.jobId,
            inputTokens: res.inputTokens,
            outputTokens: res.outputTokens,
            durationMs: res.durationMs,
            costUsd,
            isFallback,
            ok: true,
          });
          return {
            text: res.text,
            provider: candidate.provider,
            model: candidate.modelId,
            inputTokens: res.inputTokens,
            outputTokens: res.outputTokens,
            durationMs: res.durationMs,
            costUsd,
            costInr: costUsd !== null ? usdToInr(costUsd) : null,
            isFallback,
          };
        } catch (err) {
          lastError = err;
          const retryable = err instanceof StudioProviderError ? err.retryable : true;
          const isLastAttempt = attempt === maxRetries || !retryable;
          if (isLastAttempt) {
            await recordStudioUsage({
              feature: request.feature,
              provider: candidate.provider,
              model: candidate.modelId,
              modality: "TEXT",
              userId: request.userId,
              projectId: request.projectId,
              jobId: request.jobId,
              durationMs: 0,
              costUsd: null,
              isFallback,
              ok: false,
              error: (err instanceof Error ? err.message : String(err)).replace(
                /([?&]key=)[^&\s"']+/gi,
                "$1REDACTED"
              ),
            });
          }
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new StudioProviderError("All text providers failed", "PROVIDER_UNAVAILABLE", "ROUTER", false);
  }

  /**
   * Explicit Multi-AI Comparison: executes the same prompt across selected
   * providers in parallel and returns side-by-side results with cost & latency.
   * Never invoked automatically for standard single-provider tasks.
   */
  public async compareModels(params: {
    prompt: string;
    systemPrompt?: string;
    taskType?: StudioTaskType;
    providers: string[];
    userId: string;
    roleName?: string;
    projectId?: string;
    evaluateWinner?: boolean;
  }): Promise<{ results: CompareModelResult[]; evaluation?: StudioTextResponse | null }> {
    await assertStudioBudget({
      userId: params.userId,
      roleName: params.roleName,
      projectId: params.projectId,
      estimatedCostUsd: 0.03,
    });

    const chain = await resolveProviderChain("TEXT", undefined, undefined, params.taskType || "GENERAL");
    const targets = params.providers
      .map((p) => chain.find((c) => c.provider === p))
      .filter((c): c is StudioProviderDescriptor => Boolean(c));

    const settled = await Promise.allSettled(
      targets.map(async (cfg): Promise<CompareModelResult> => {
        const start = Date.now();
        try {
          const res = await withTimeout(
            invokeTextProvider({
              provider: cfg.provider,
              modelId: cfg.modelId,
              envKeyRef: cfg.envKeyRef,
              request: {
                prompt: params.prompt,
                systemPrompt: params.systemPrompt,
                taskType: params.taskType,
                feature: "COMPARE",
                userId: params.userId,
                projectId: params.projectId,
              },
            }),
            cfg.timeoutMs ?? 30000,
            cfg.provider
          );
          const costUsd = computeTokenCostUsd(res.inputTokens, res.outputTokens, cfg);
          await recordStudioUsage({
            feature: "CONTENT_STUDIO_COMPARE",
            provider: cfg.provider,
            model: cfg.modelId,
            modality: "TEXT",
            userId: params.userId,
            projectId: params.projectId,
            inputTokens: res.inputTokens,
            outputTokens: res.outputTokens,
            durationMs: res.durationMs,
            costUsd,
            isFallback: false,
            ok: true,
          });
          return {
            provider: cfg.provider,
            model: cfg.modelId,
            displayName: cfg.displayName,
            ok: true,
            text: res.text,
            inputTokens: res.inputTokens,
            outputTokens: res.outputTokens,
            durationMs: res.durationMs,
            costUsd,
            costInr: costUsd !== null ? usdToInr(costUsd) : null,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await recordStudioUsage({
            feature: "CONTENT_STUDIO_COMPARE",
            provider: cfg.provider,
            model: cfg.modelId,
            modality: "TEXT",
            userId: params.userId,
            projectId: params.projectId,
            durationMs: Date.now() - start,
            costUsd: null,
            isFallback: false,
            ok: false,
            error: msg,
          });
          return {
            provider: cfg.provider,
            model: cfg.modelId,
            displayName: cfg.displayName,
            ok: false,
            durationMs: Date.now() - start,
            costUsd: null,
            costInr: null,
            error: msg,
          };
        }
      })
    );

    const results = settled.map((s, idx) =>
      s.status === "fulfilled"
        ? s.value
        : {
            provider: targets[idx]?.provider || "UNKNOWN",
            model: targets[idx]?.modelId || "unknown",
            displayName: targets[idx]?.displayName || "Unknown",
            ok: false,
            durationMs: 0,
            costUsd: null,
            costInr: null,
            error: String(s.reason),
          }
    );

    let evaluation: StudioTextResponse | null = null;
    const successful = results.filter((r) => r.ok && r.text);
    if (params.evaluateWinner && successful.length >= 2) {
      const evalPrompt = [
        `Original Task (${params.taskType || "GENERAL"}): ${params.prompt}`,
        "",
        ...successful.map(
          (r, i) => `--- CANDIDATE ${i + 1}: ${r.provider} (${r.model}) ---\n${r.text}\n`
        ),
        "Compare the candidates objectively for accuracy, clarity, and structure, and recommend the best output with brief reasoning.",
      ].join("\n");

      evaluation = await this.generateText({
        prompt: evalPrompt,
        systemPrompt: "You are an impartial AI output evaluator.",
        taskType: "SUMMARIZATION",
        feature: "COMPARE_EVALUATOR",
        userId: params.userId,
        roleName: params.roleName,
        projectId: params.projectId,
      });
    }

    return { results, evaluation };
  }

  public async generateImage(request: StudioImageRequest): Promise<StudioImageResponse> {
    await assertStudioBudget({
      userId: request.userId,
      roleName: request.roleName,
      projectId: request.projectId,
      estimatedCostUsd: 0.04,
    });

    const chain = await resolveProviderChain("IMAGE", request.preferredProvider, request.preferredModel);
    if (chain.length === 0) {
      throw new StudioProviderError("No enabled IMAGE providers configured", "NOT_CONFIGURED", "ROUTER", false);
    }

    let lastError: unknown = null;
    for (let i = 0; i < chain.length; i++) {
      const candidate = chain[i];
      if (!candidate) continue;
      const isFallback = i > 0;
      try {
        const res = await withTimeout(
          invokeImageProvider({
            provider: candidate.provider,
            modelId: candidate.modelId,
            envKeyRef: candidate.envKeyRef,
            request,
          }),
          candidate.timeoutMs ?? 45000,
          candidate.provider
        );
        const costUsd = candidate.unitCostUsd;
        await recordStudioUsage({
          feature: request.feature,
          provider: candidate.provider,
          model: candidate.modelId,
          modality: "IMAGE",
          userId: request.userId,
          projectId: request.projectId,
          jobId: request.jobId,
          durationMs: res.durationMs,
          costUsd,
          isFallback,
          ok: true,
        });
        return {
          ...res,
          provider: candidate.provider,
          model: candidate.modelId,
          costUsd,
          costInr: usdToInr(costUsd),
          isFallback,
        };
      } catch (err) {
        lastError = err;
        await recordStudioUsage({
          feature: request.feature,
          provider: candidate.provider,
          model: candidate.modelId,
          modality: "IMAGE",
          userId: request.userId,
          projectId: request.projectId,
          jobId: request.jobId,
          durationMs: 0,
          costUsd: null,
          isFallback,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new StudioProviderError("All image providers failed", "PROVIDER_UNAVAILABLE", "ROUTER", false);
  }

  public async generateVoice(request: StudioVoiceRequest): Promise<StudioVoiceResponse> {
    const estimatedUsd = Math.max(0.005, (request.text.length / 1000) * 0.015);
    await assertStudioBudget({
      userId: request.userId,
      roleName: request.roleName,
      projectId: request.projectId,
      estimatedCostUsd: estimatedUsd,
    });

    const chain = await resolveProviderChain("VOICE", request.preferredProvider, request.preferredModel);
    if (chain.length === 0) {
      throw new StudioProviderError("No enabled VOICE providers configured", "NOT_CONFIGURED", "ROUTER", false);
    }

    let lastError: unknown = null;
    for (let i = 0; i < chain.length; i++) {
      const candidate = chain[i];
      if (!candidate) continue;
      const isFallback = i > 0;
      try {
        const res = await withTimeout(
          invokeVoiceProvider({
            provider: candidate.provider,
            modelId: candidate.modelId,
            envKeyRef: candidate.envKeyRef,
            request,
          }),
          candidate.timeoutMs ?? 45000,
          candidate.provider
        );
        const costUsd = Number(((request.text.length / 1000) * (candidate.unitCostUsd || 0.015)).toFixed(6));
        await recordStudioUsage({
          feature: request.feature,
          provider: candidate.provider,
          model: candidate.modelId,
          modality: "VOICE",
          userId: request.userId,
          projectId: request.projectId,
          jobId: request.jobId,
          durationMs: res.durationMs,
          costUsd,
          isFallback,
          ok: true,
        });
        return {
          ...res,
          provider: candidate.provider,
          model: candidate.modelId,
          costUsd,
          costInr: usdToInr(costUsd),
          isFallback,
        };
      } catch (err) {
        lastError = err;
        await recordStudioUsage({
          feature: request.feature,
          provider: candidate.provider,
          model: candidate.modelId,
          modality: "VOICE",
          userId: request.userId,
          projectId: request.projectId,
          jobId: request.jobId,
          durationMs: 0,
          costUsd: null,
          isFallback,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new StudioProviderError("All voice providers failed", "PROVIDER_UNAVAILABLE", "ROUTER", false);
  }
}

export const studioProviderRouter = new StudioProviderRouter();
