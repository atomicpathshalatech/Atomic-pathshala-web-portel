import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { waitUntil } from "@vercel/functions";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { createStudioJob, updateStudioJobProgress } from "@/lib/ai-studio/jobs";
import { studioProviderRouter } from "@/lib/ai-studio/router";

const enqueueJobSchema = z.object({
  projectId: z.string().trim().optional(),
  modality: z.enum(["TEXT", "RESEARCH"]).default("TEXT"),
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
  prompt: z.string().trim().min(3).max(8000),
  preferredProvider: z.string().trim().optional(),
  preferredModel: z.string().trim().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_ACCESS);

    const rawStatus = req.nextUrl.searchParams.get("status");
    const allowedStatuses = ["QUEUED", "PROCESSING", "WAITING_WEBHOOK", "COMPLETED", "FAILED", "CANCELLED"];
    const status = rawStatus && allowedStatuses.includes(rawStatus) ? rawStatus : null;
    const projectId = req.nextUrl.searchParams.get("projectId");

    const jobs = await prisma.aiGenerationJob.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(projectId ? { projectId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const canViewCost = await hasPermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_COST_VIEW);
    return apiSuccess({
      jobs: canViewCost ? jobs : jobs.map((j) => ({ ...j, actualCostUsd: null })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_AI_GENERATE);

    const body = enqueueJobSchema.parse(await req.json());

    const job = await createStudioJob({
      userId: session.user.id,
      projectId: body.projectId,
      modality: body.modality,
      taskType: body.taskType,
      provider: body.preferredProvider,
      model: body.preferredModel,
      inputPayload: { prompt: body.prompt },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CONTENT_STUDIO_JOB_ENQUEUE",
        entityType: "AiGenerationJob",
        entityId: job.id,
        metadata: { taskType: body.taskType, projectId: body.projectId ?? null },
      },
    });

    const userId = session.user.id;
    const roleName = session.user.role ?? undefined;

    waitUntil(
      (async () => {
        try {
          await updateStudioJobProgress({
            jobId: job.id,
            status: "PROCESSING",
            progress: 25,
          });
          const res = await studioProviderRouter.generateText({
            prompt: body.prompt,
            taskType: body.taskType,
            preferredProvider: body.preferredProvider,
            preferredModel: body.preferredModel,
            feature: `JOB_${body.taskType}`,
            userId,
            roleName,
            projectId: body.projectId,
            jobId: job.id,
          });
          await prisma.aiGenerationJob.update({
            where: { id: job.id },
            data: {
              provider: res.provider,
              model: res.model,
            },
          });
          await updateStudioJobProgress({
            jobId: job.id,
            status: "COMPLETED",
            progress: 100,
            actualCostUsd: res.costUsd ?? undefined,
            outputPayload: {
              text: res.text,
              provider: res.provider,
              model: res.model,
              inputTokens: res.inputTokens,
              outputTokens: res.outputTokens,
              durationMs: res.durationMs,
            },
          });
        } catch (err) {
          await updateStudioJobProgress({
            jobId: job.id,
            status: "FAILED",
            progress: 100,
            errorMessage: err instanceof Error ? err.message : String(err),
          });
        }
      })()
    );

    return apiSuccess({ job }, 202);
  } catch (err) {
    return handleApiError(err);
  }
}
