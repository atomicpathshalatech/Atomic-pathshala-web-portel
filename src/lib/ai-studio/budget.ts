import "server-only";
import { prisma } from "@/lib/prisma";
import { StudioModality, StudioProviderError } from "./types";

const USD_TO_INR = Number(process.env.AI_USD_TO_INR || 86);

export function usdToInr(usd: number): number {
  return Number((usd * USD_TO_INR).toFixed(4));
}

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  dailySpendUsd: number;
  monthlySpendUsd: number;
}

/**
 * Checks GLOBAL, ROLE, USER, and PROJECT AiBudgetLimit rules before
 * dispatching an AI request. Fails open only if no limits are configured.
 */
export async function checkStudioBudget(params: {
  userId: string;
  roleName?: string;
  projectId?: string;
  estimatedCostUsd?: number;
}): Promise<BudgetCheckResult> {
  const limits = await prisma.aiBudgetLimit.findMany({
    where: {
      isActive: true,
      OR: [
        { scopeType: "GLOBAL", scopeId: "GLOBAL" },
        ...(params.roleName ? [{ scopeType: "ROLE" as const, scopeId: params.roleName }] : []),
        { scopeType: "USER", scopeId: params.userId },
        ...(params.projectId ? [{ scopeType: "PROJECT" as const, scopeId: params.projectId }] : []),
      ],
    },
  });

  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  if (limits.length === 0) {
    return { allowed: true, dailySpendUsd: 0, monthlySpendUsd: 0 };
  }

  const estimate = params.estimatedCostUsd ?? 0;

  for (const limit of limits) {
    let whereScope: Record<string, unknown>;
    if (limit.scopeType === "USER") {
      whereScope = { userId: limit.scopeId };
    } else if (limit.scopeType === "PROJECT") {
      whereScope = { projectId: limit.scopeId };
    } else if (limit.scopeType === "ROLE") {
      const roleUsers = await prisma.user.findMany({
        where: { role: limit.scopeId as never },
        select: { id: true },
      });
      whereScope = {
        userId: { in: roleUsers.map((u) => u.id) },
        feature: { startsWith: "CONTENT_STUDIO" },
      };
    } else {
      whereScope = { feature: { startsWith: "CONTENT_STUDIO" } };
    }

    const [dayAgg, monthAgg] = await Promise.all([
      prisma.aiUsageLog.aggregate({
        where: { ...whereScope, createdAt: { gte: startOfDay }, ok: true },
        _sum: { costUsd: true },
      }),
      prisma.aiUsageLog.aggregate({
        where: { ...whereScope, createdAt: { gte: startOfMonth }, ok: true },
        _sum: { costUsd: true },
      }),
    ]);

    const dailySpendUsd = dayAgg._sum.costUsd ?? 0;
    const monthlySpendUsd = monthAgg._sum.costUsd ?? 0;

    if (limit.hardStop && dailySpendUsd + estimate > limit.dailyLimitUsd) {
      return {
        allowed: false,
        reason: `Daily AI budget limit ($${limit.dailyLimitUsd.toFixed(2)}) reached for ${limit.scopeType}:${limit.scopeId}.`,
        dailySpendUsd,
        monthlySpendUsd,
      };
    }

    if (limit.hardStop && monthlySpendUsd + estimate > limit.monthlyLimitUsd) {
      return {
        allowed: false,
        reason: `Monthly AI budget limit ($${limit.monthlyLimitUsd.toFixed(2)}) reached for ${limit.scopeType}:${limit.scopeId}.`,
        dailySpendUsd,
        monthlySpendUsd,
      };
    }
  }

  return { allowed: true, dailySpendUsd: 0, monthlySpendUsd: 0 };
}

export async function assertStudioBudget(params: {
  userId: string;
  roleName?: string;
  projectId?: string;
  estimatedCostUsd?: number;
}): Promise<void> {
  const res = await checkStudioBudget(params);
  if (!res.allowed) {
    throw new StudioProviderError(
      res.reason || "AI budget limit exceeded",
      "BUDGET_EXCEEDED",
      "BUDGET_GUARD",
      false
    );
  }
}

export async function recordStudioUsage(entry: {
  feature: string;
  provider: string;
  model: string;
  modality: StudioModality;
  userId: string;
  projectId?: string;
  jobId?: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs: number;
  costUsd: number | null;
  isFallback?: boolean;
  ok: boolean;
  error?: string;
}): Promise<void> {
  try {
    await prisma.aiUsageLog.create({
      data: {
        feature: entry.feature.startsWith("CONTENT_STUDIO")
          ? entry.feature
          : `CONTENT_STUDIO_${entry.feature}`,
        provider: entry.provider,
        model: entry.model,
        modality: entry.modality,
        userId: entry.userId,
        projectId: entry.projectId ?? null,
        jobId: entry.jobId ?? null,
        inputTokens: entry.inputTokens ?? null,
        outputTokens: entry.outputTokens ?? null,
        durationMs: entry.durationMs,
        costUsd: entry.costUsd,
        costInr: entry.costUsd !== null ? usdToInr(entry.costUsd) : null,
        isFallback: entry.isFallback ?? false,
        ok: entry.ok,
        error: entry.error ? entry.error.slice(0, 500) : null,
      },
    });
  } catch (err) {
    console.error("[ai-studio/budget] Failed to persist AiUsageLog:", err);
  }
}
