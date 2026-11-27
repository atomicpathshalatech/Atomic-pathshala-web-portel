import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { VIDEO_PROVIDER_CAPABILITIES } from "@/lib/ai-studio/video/capabilities";
import {
  isVideoProviderConfigured,
  pollVideoGenerationStatus,
  submitVideoGenerationJob,
} from "@/lib/ai-studio/video/providers";
import { cancelStudioJob } from "@/lib/ai-studio/jobs";

const submitVideoSchema = z.object({
  sceneId: z.string().optional(),
  provider: z.enum(["RUNWAY", "KLING", "REPLICATE_VIDEO", "GOOGLE_VEO"]).default("RUNWAY"),
  model: z.string().default("gen4_turbo"),
  mode: z.enum(["TEXT_TO_VIDEO", "IMAGE_TO_VIDEO", "REFERENCE_BASED", "EXTEND"]).default("TEXT_TO_VIDEO"),
  prompt: z.string().trim().min(3).max(4000),
  aspectRatio: z.string().default("16:9"),
  durationSec: z.number().int().min(3).max(15).default(5),
  referenceImageUrl: z.string().optional(),
  cameraMovement: z.string().optional(),
  lighting: z.string().optional(),
  environment: z.string().optional(),
  mood: z.string().optional(),
});

const patchVideoSchema = z.object({
  action: z.enum(["POLL", "CANCEL", "REORDER_SCENES"]),
  videoGenId: z.string().optional(),
  orderedSceneIds: z.array(z.string()).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_VIDEO);

    const [generations, storyboards, referenceImages] = await Promise.all([
      prisma.videoGeneration.findMany({
        where: { projectId: params.id },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
      prisma.storyboard.findMany({
        where: { projectId: params.id },
        include: { scenes: { orderBy: { orderIndex: "asc" } } },
        orderBy: { version: "desc" },
        take: 1,
      }),
      prisma.generatedAsset.findMany({
        where: {
          projectId: params.id,
          assetType: { in: ["IMAGE", "THUMBNAIL"] },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

    const providers = Object.values(VIDEO_PROVIDER_CAPABILITIES).map((cap) => ({
      ...cap,
      configured: isVideoProviderConfigured(cap.provider),
    }));

    return apiSuccess({
      generations,
      scenes: storyboards[0]?.scenes || [],
      referenceImages,
      providers,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_VIDEO);
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_AI_GENERATE);

    const body = submitVideoSchema.parse(await req.json());
    const res = await submitVideoGenerationJob({
      ...body,
      projectId: params.id,
      userId: session.user.id,
      roleName: session.user.role ?? undefined,
    });

    return apiSuccess(res, 202);
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

    const body = patchVideoSchema.parse(await req.json());

    if (body.action === "POLL" && body.videoGenId) {
      const vg = await prisma.videoGeneration.findFirst({
        where: { id: body.videoGenId, projectId: params.id },
        select: { id: true },
      });
      if (!vg) return apiError("Video generation not found", 404);
      const videoGen = await pollVideoGenerationStatus(vg.id, session.user.id);
      return apiSuccess({ videoGen });
    }

    if (body.action === "CANCEL" && body.videoGenId) {
      const vg = await prisma.videoGeneration.findFirst({
        where: { id: body.videoGenId, projectId: params.id },
      });
      if (!vg) return apiError("Video generation not found", 404);
      if (vg.jobId) await cancelStudioJob(vg.jobId);
      const updated = await prisma.videoGeneration.update({
        where: { id: vg.id },
        data: { status: "CANCELLED" },
      });
      return apiSuccess({ videoGen: updated });
    }

    if (body.action === "REORDER_SCENES" && body.orderedSceneIds) {
      await prisma.$transaction(
        body.orderedSceneIds.map((sceneId, idx) =>
          prisma.storyboardScene.updateMany({
            where: { id: sceneId, storyboard: { projectId: params.id } },
            data: { orderIndex: idx + 1 },
          })
        )
      );
      return apiSuccess({ reordered: true });
    }

    return apiError("Invalid action", 400);
  } catch (err) {
    return handleApiError(err);
  }
}
