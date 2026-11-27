import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { createStudioJob, updateStudioJobProgress } from "@/lib/ai-studio/jobs";
import { recordStudioUsage } from "@/lib/ai-studio/budget";

const renderSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("START"),
    editorProjectId: z.string(),
    resolution: z.string(),
    aspectRatio: z.string(),
    durationMs: z.number().int(),
  }),
  z.object({
    action: z.literal("COMPLETE"),
    jobId: z.string(),
    editorProjectId: z.string(),
    exportedAssetId: z.string(),
    renderDurationMs: z.number().int(),
  }),
  z.object({
    action: z.literal("FAIL"),
    jobId: z.string(),
    errorMessage: z.string(),
  }),
]);

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_VIDEO_RENDER);
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_EXPORT);

    const body = renderSchema.parse(await req.json());

    if (body.action === "START") {
      const editorProj = await prisma.videoEditorProject.findFirst({
        where: { id: body.editorProjectId, projectId: params.id },
        select: { id: true },
      });
      if (!editorProj) return apiError("Editor project not found", 404);

      const job = await createStudioJob({
        userId: session.user.id,
        projectId: params.id,
        modality: "VIDEO",
        taskType: "TIMELINE_RENDER",
        provider: "BROWSER_COMPOSITOR",
        model: `${body.resolution}-${body.aspectRatio}`,
        inputPayload: {
          editorProjectId: body.editorProjectId,
          resolution: body.resolution,
          aspectRatio: body.aspectRatio,
          durationMs: body.durationMs,
        },
      });
      await updateStudioJobProgress({ jobId: job.id, status: "PROCESSING", progress: 10 });
      await prisma.videoEditorProject.update({
        where: { id: editorProj.id },
        data: { renderJobId: job.id },
      });
      return apiSuccess({ job }, 201);
    }

    const existingJob = await prisma.aiGenerationJob.findFirst({
      where: { id: body.jobId, projectId: params.id },
      select: { id: true },
    });
    if (!existingJob) return apiError("Render job not found", 404);

    if (body.action === "COMPLETE") {
      const editorProj = await prisma.videoEditorProject.findFirst({
        where: { id: body.editorProjectId, projectId: params.id },
        select: { id: true },
      });
      if (!editorProj) return apiError("Editor project not found", 404);

      const job = await updateStudioJobProgress({
        jobId: existingJob.id,
        status: "COMPLETED",
        progress: 100,
        outputPayload: {
          exportedAssetId: body.exportedAssetId,
          renderDurationMs: body.renderDurationMs,
        },
      });
      await prisma.videoEditorProject.update({
        where: { id: editorProj.id },
        data: { exportedAssetId: body.exportedAssetId },
      });
      await recordStudioUsage({
        userId: session.user.id,
        projectId: params.id,
        feature: "CONTENT_STUDIO_TIMELINE_RENDER",
        modality: "VIDEO",
        provider: "BROWSER_COMPOSITOR",
        model: "client-canvas-mediarecorder",
        durationMs: body.renderDurationMs,
        costUsd: 0,
        ok: true,
      });
      return apiSuccess({ job });
    }

    const job = await updateStudioJobProgress({
      jobId: existingJob.id,
      status: "FAILED",
      progress: 0,
      errorMessage: body.errorMessage,
    });
    return apiSuccess({ job });
  } catch (err) {
    return handleApiError(err);
  }
}
