import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { studioProviderRouter } from "@/lib/ai-studio/router";

const compareSchema = z.object({
  prompt: z.string().trim().min(3).max(8000),
  systemPrompt: z.string().trim().max(2000).optional(),
  taskType: z
    .enum([
      "GENERAL",
      "RESEARCH",
      "TOPIC_ANALYSIS",
      "SCRIPT_WRITING",
      "SEO",
      "CHEMISTRY_VERIFICATION",
      "THUMBNAIL_PROMPT",
      "CONTENT_PLANNING",
      "SUMMARIZATION",
    ])
    .default("GENERAL"),
  providers: z.array(z.string().trim().min(2)).min(2).max(4),
  projectId: z.string().trim().optional(),
  evaluateWinner: z.boolean().default(false),
});

const selectWinnerSchema = z.object({
  projectId: z.string().trim().optional(),
  provider: z.string().trim(),
  model: z.string().trim(),
  prompt: z.string().trim(),
  selectedText: z.string().trim(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_AI_GENERATE);

    const canViewCosts = await hasPermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_COST_VIEW);
    const body = compareSchema.parse(await req.json());

    const comparison = await studioProviderRouter.compareModels({
      prompt: body.prompt,
      systemPrompt: body.systemPrompt,
      taskType: body.taskType,
      providers: body.providers,
      userId: session.user.id,
      roleName: session.user.role ?? undefined,
      projectId: body.projectId,
      evaluateWinner: body.evaluateWinner,
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CONTENT_STUDIO_MULTI_AI_COMPARE",
        entityType: "ContentProject",
        entityId: body.projectId ?? "STANDALONE",
        metadata: {
          taskType: body.taskType,
          providers: body.providers,
          evaluateWinner: body.evaluateWinner,
        },
      },
    });

    return apiSuccess({
      canViewCosts,
      results: canViewCosts
        ? comparison.results
        : comparison.results.map((r) => ({ ...r, costUsd: null, costInr: null })),
      evaluation: comparison.evaluation
        ? canViewCosts
          ? comparison.evaluation
          : { ...comparison.evaluation, costUsd: null, costInr: null }
        : null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_AI_GENERATE);

    const body = selectWinnerSchema.parse(await req.json());

    if (body.projectId) {
      await prisma.contentHistory.create({
        data: {
          projectId: body.projectId,
          entityType: "PROJECT",
          entityId: body.projectId,
          version: 1,
          snapshot: {
            provider: body.provider,
            model: body.model,
            prompt: body.prompt,
            selectedText: body.selectedText,
          },
          changeSummary: `Selected ${body.provider} (${body.model}) output from Multi-AI Comparison`,
          actorId: session.user.id,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CONTENT_STUDIO_COMPARE_SELECT",
        entityType: "ContentProject",
        entityId: body.projectId ?? "STANDALONE",
        metadata: { provider: body.provider, model: body.model },
      },
    });

    return apiSuccess({ saved: true });
  } catch (err) {
    return handleApiError(err);
  }
}
