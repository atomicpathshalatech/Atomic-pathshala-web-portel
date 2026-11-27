import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import {
  buildDefaultThumbnailLayers,
  generateThumbnailConcepts,
  generateThumbnailImageLayer,
} from "@/lib/ai-studio/thumbnail/engine";

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("GENERATE_CONCEPTS"),
    title: z.string().trim().min(1).max(160),
    topic: z.string().trim().min(2).max(240),
    subject: z.string().optional(),
    chapter: z.string().optional(),
    projectType: z.string().default("LECTURE"),
    targetAudience: z.string().optional(),
    keyMessage: z.string().optional(),
    thumbnailText: z.string().optional(),
    platform: z.string().default("YOUTUBE"),
    width: z.number().int().default(1280),
    height: z.number().int().default(720),
    teacherImageUrl: z.string().optional(),
  }),
  z.object({
    action: z.literal("GENERATE_IMAGE"),
    thumbnailProjectId: z.string().optional(),
    prompt: z.string().trim().min(3).max(2000),
    width: z.number().int().default(1280),
    height: z.number().int().default(720),
  }),
]);

const patchSchema = z.object({
  thumbnailProjectId: z.string(),
  layers: z.array(z.record(z.unknown())),
  overlayText: z.string().optional(),
  selectedAssetId: z.string().optional(),
  changeSummary: z.string().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_THUMBNAIL);

    const [thumbnails, history] = await Promise.all([
      prisma.thumbnailProject.findMany({
        where: { projectId: params.id },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.contentHistory.findMany({
        where: { projectId: params.id, entityType: "THUMBNAIL" },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
    ]);

    return apiSuccess({ thumbnails, history });
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
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_THUMBNAIL);
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_AI_GENERATE);

    const body = postSchema.parse(await req.json());

    if (body.action === "GENERATE_IMAGE") {
      const asset = await generateThumbnailImageLayer({
        prompt: body.prompt,
        width: body.width,
        height: body.height,
        userId: session.user.id,
        roleName: session.user.role ?? undefined,
        projectId: params.id,
      });
      return apiSuccess({ asset }, 201);
    }

    const { concepts } = await generateThumbnailConcepts({
      topic: body.topic,
      subject: body.subject,
      chapter: body.chapter,
      projectType: body.projectType,
      targetAudience: body.targetAudience,
      keyMessage: body.keyMessage,
      thumbnailText: body.thumbnailText,
      platform: body.platform,
      userId: session.user.id,
      roleName: session.user.role ?? undefined,
      projectId: params.id,
    });

    const first = concepts[0];
    const defaultLayers = buildDefaultThumbnailLayers({
      width: body.width,
      height: body.height,
      headlineText: body.thumbnailText || first?.headlineText || body.topic,
      subText: first?.subText,
      primaryColor: first?.primaryColor,
      accentColor: first?.accentColor,
      teacherImageUrl: body.teacherImageUrl,
    });

    const thumbnailProject = await prisma.thumbnailProject.create({
      data: {
        projectId: params.id,
        title: body.title,
        projectType: body.projectType,
        platform: body.platform,
        width: body.width,
        height: body.height,
        overlayText: first?.headlineText ?? null,
        concepts: concepts as unknown as Prisma.InputJsonValue,
        layers: defaultLayers as unknown as Prisma.InputJsonValue,
        createdById: session.user.id,
      },
    });

    await prisma.contentHistory.create({
      data: {
        projectId: params.id,
        entityType: "THUMBNAIL",
        entityId: thumbnailProject.id,
        version: 1,
        snapshot: { layers: defaultLayers } as unknown as Prisma.InputJsonValue,
        changeSummary: `Generated ${concepts.length} thumbnail concepts`,
        actorId: session.user.id,
      },
    });

    return apiSuccess({ thumbnailProject, concepts }, 201);
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
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_THUMBNAIL);

    const body = patchSchema.parse(await req.json());
    const existing = await prisma.thumbnailProject.findFirst({
      where: { id: body.thumbnailProjectId, projectId: params.id },
    });
    if (!existing) return apiError("Thumbnail project not found", 404);

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.thumbnailProject.update({
        where: { id: body.thumbnailProjectId },
        data: {
          layers: body.layers as Prisma.InputJsonValue,
          ...(body.overlayText !== undefined ? { overlayText: body.overlayText } : {}),
          ...(body.selectedAssetId !== undefined ? { selectedAssetId: body.selectedAssetId } : {}),
        },
      });

      const count = await tx.contentHistory.count({
        where: { projectId: params.id, entityType: "THUMBNAIL", entityId: next.id },
      });

      await tx.contentHistory.create({
        data: {
          projectId: params.id,
          entityType: "THUMBNAIL",
          entityId: next.id,
          version: count + 1,
          snapshot: { layers: body.layers } as unknown as Prisma.InputJsonValue,
          changeSummary: body.changeSummary || `Saved layer edit v${count + 1}`,
          actorId: session.user.id,
        },
      });

      return next;
    });

    return apiSuccess({ thumbnailProject: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
