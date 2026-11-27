import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

const saveEditorSchema = z.object({
  editorProjectId: z.string(),
  title: z.string().trim().min(1).max(160).optional(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional(),
  resolution: z.enum(["1080p", "720p"]).optional(),
  fps: z.number().int().min(15).max(60).optional(),
  durationMs: z.number().int().min(1000).max(3600000).optional(),
  timelineJson: z.object({
    clips: z.array(z.record(z.unknown())),
  }),
  exportedAssetId: z.string().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_VIDEO);

    let editorProject = await prisma.videoEditorProject.findFirst({
      where: { projectId: params.id },
      orderBy: { updatedAt: "desc" },
    });

    if (!editorProject) {
      editorProject = await prisma.videoEditorProject.create({
        data: {
          projectId: params.id,
          title: "Main Timeline",
          aspectRatio: "16:9",
          resolution: "1080p",
          fps: 30,
          durationMs: 15000,
          timelineJson: { clips: [] },
          createdById: session.user.id,
        },
      });
    }

    const [assets, renderJobs] = await Promise.all([
      prisma.generatedAsset.findMany({
        where: { projectId: params.id },
        orderBy: { createdAt: "desc" },
        take: 80,
      }),
      prisma.aiGenerationJob.findMany({
        where: { projectId: params.id, taskType: "TIMELINE_RENDER" },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
    ]);

    return apiSuccess({ editorProject, assets, renderJobs });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_VIDEO);

    const body = saveEditorSchema.parse(await req.json());

    const existing = await prisma.videoEditorProject.findFirst({
      where: { id: body.editorProjectId, projectId: params.id },
      select: { id: true },
    });
    if (!existing) {
      return apiSuccess({ error: "Editor project not found" }, 404);
    }

    const updated = await prisma.videoEditorProject.update({
      where: { id: existing.id },
      data: {
        ...(body.title ? { title: body.title } : {}),
        ...(body.aspectRatio ? { aspectRatio: body.aspectRatio } : {}),
        ...(body.resolution ? { resolution: body.resolution } : {}),
        ...(body.fps ? { fps: body.fps } : {}),
        ...(body.durationMs ? { durationMs: body.durationMs } : {}),
        ...(body.exportedAssetId ? { exportedAssetId: body.exportedAssetId } : {}),
        timelineJson: body.timelineJson as Prisma.InputJsonValue,
      },
    });

    await prisma.contentHistory.create({
      data: {
        projectId: params.id,
        entityType: "PROJECT",
        entityId: updated.id,
        version: 1,
        snapshot: { clipCount: body.timelineJson.clips.length, resolution: updated.resolution },
        changeSummary: `Saved Video Editor timeline (${body.timelineJson.clips.length} clips)`,
        actorId: session.user.id,
      },
    });

    return apiSuccess({ editorProject: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
