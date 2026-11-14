import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import {
  aiProjectRegistry,
  aiModelRouter,
  aiRequestQueue,
  aiResponseCache,
  aiProviderGateway,
} from "@/lib/ai-gateway";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.SYSTEM_VIEW);

    const projects = aiProjectRegistry.getProjects();
    const models = aiModelRouter.getAllModels();
    const queue = aiRequestQueue.getQueueStats();
    const cache = aiResponseCache.getStats();
    const recentTelemetry = aiProviderGateway.getTelemetry().slice(0, 50);

    // Fetch db aggregate usage logs for today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayUsage = await prisma.aiUsageLog.aggregate({
      where: { createdAt: { gte: startOfToday } },
      _count: { id: true },
      _sum: { inputTokens: true, outputTokens: true },
    });

    const failedCount = await prisma.aiUsageLog.count({
      where: { createdAt: { gte: startOfToday }, ok: false },
    });

    return apiSuccess({
      projects,
      models,
      queue,
      cache,
      telemetry: recentTelemetry,
      todaySummary: {
        totalCalls: todayUsage._count.id || 0,
        failedCalls: failedCount || 0,
        inputTokens: todayUsage._sum.inputTokens || 0,
        outputTokens: todayUsage._sum.outputTokens || 0,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.SYSTEM_MANAGE);

    const body = await req.json();
    const { action, payload = {} } = body;

    if (action === "toggle_project") {
      const { projectId, enabled } = payload;
      aiProjectRegistry.toggleProject(projectId, Boolean(enabled));
      return apiSuccess({ message: `Project ${projectId} updated.` });
    }

    if (action === "toggle_model") {
      const { modelId, enabled } = payload;
      aiModelRouter.toggleModel(modelId, Boolean(enabled));
      return apiSuccess({ message: `Model ${modelId} updated.` });
    }

    if (action === "set_concurrency") {
      const { concurrency } = payload;
      aiRequestQueue.setMaxConcurrency(Number(concurrency));
      return apiSuccess({ message: `Concurrency set to ${concurrency}.` });
    }

    if (action === "clear_cache") {
      aiResponseCache.clear();
      return apiSuccess({ message: "AI response cache cleared." });
    }

    if (action === "test_project") {
      const { projectId } = payload;
      const proj = aiProjectRegistry.getProjects().find((p) => p.id === projectId);
      if (!proj) return apiError("Project not found", 404);

      const start = Date.now();
      try {
        const genAI = new GoogleGenerativeAI(proj.rawKey);
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
        const res = await model.generateContent("ping");
        const latencyMs = Date.now() - start;
        aiProjectRegistry.recordResult(proj.id, true);
        return apiSuccess({
          healthy: true,
          latencyMs,
          reply: res.response.text().trim(),
        });
      } catch (err: any) {
        const latencyMs = Date.now() - start;
        const msg = String(err?.message || err);
        aiProjectRegistry.recordResult(proj.id, false, { errorMsg: msg });
        return apiSuccess({
          healthy: false,
          latencyMs,
          error: msg.slice(0, 160),
        });
      }
    }

    return apiError("Unknown action", 400);
  } catch (error) {
    return handleApiError(error);
  }
}
