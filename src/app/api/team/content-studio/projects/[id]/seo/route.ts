import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { generateCompleteSeoPackage } from "@/lib/ai-studio/seo/engine";

const generateSeoSchema = z.object({
  topic: z.string().trim().min(2).max(240),
  subject: z.string().optional(),
  chapter: z.string().optional(),
  language: z.string().default("hinglish"),
  videoType: z.string().default("YOUTUBE_VIDEO"),
  channel: z.string().default("MAIN"),
  targetAudience: z.string().optional(),
  scriptText: z.string().optional(),
});

const patchSeoSchema = z.object({
  seoPackageId: z.string(),
  titles: z.array(z.record(z.unknown())).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  hashtags: z.array(z.string()).optional(),
  chapters: z.array(z.object({ timestamp: z.string(), title: z.string() })).optional(),
  pinnedComment: z.string().optional(),
  communityPost: z.string().optional(),
  instagramCaption: z.string().optional(),
  reelCaption: z.string().optional(),
  whatsappMessage: z.string().optional(),
  shortsPack: z.array(z.object({ idea: z.string(), hook: z.string(), script: z.string() })).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_SEO);

    const packages = await prisma.seoPackage.findMany({
      where: { projectId: params.id },
      orderBy: { updatedAt: "desc" },
    });

    return apiSuccess({ packages });
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
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_SEO);
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_AI_GENERATE);

    const body = generateSeoSchema.parse(await req.json());
    const pkg = await generateCompleteSeoPackage({
      ...body,
      projectId: params.id,
      userId: session.user.id,
      roleName: session.user.role ?? undefined,
    });

    return apiSuccess({ package: pkg }, 201);
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
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_SEO);

    const body = patchSeoSchema.parse(await req.json());
    const existing = await prisma.seoPackage.findFirst({
      where: { id: body.seoPackageId, projectId: params.id },
    });
    if (!existing) return apiError("SEO Package not found", 404);

    const updated = await prisma.seoPackage.update({
      where: { id: body.seoPackageId },
      data: {
        ...(body.titles !== undefined ? { titles: body.titles as Prisma.InputJsonValue } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.tags !== undefined ? { tags: body.tags } : {}),
        ...(body.hashtags !== undefined ? { hashtags: body.hashtags } : {}),
        ...(body.chapters !== undefined ? { chapters: body.chapters as Prisma.InputJsonValue } : {}),
        ...(body.pinnedComment !== undefined ? { pinnedComment: body.pinnedComment } : {}),
        ...(body.communityPost !== undefined ? { communityPost: body.communityPost } : {}),
        ...(body.instagramCaption !== undefined ? { instagramCaption: body.instagramCaption } : {}),
        ...(body.reelCaption !== undefined ? { reelCaption: body.reelCaption } : {}),
        ...(body.whatsappMessage !== undefined ? { whatsappMessage: body.whatsappMessage } : {}),
        ...(body.shortsPack !== undefined ? { shortsPack: body.shortsPack as Prisma.InputJsonValue } : {}),
      },
    });

    await prisma.contentHistory.create({
      data: {
        projectId: params.id,
        entityType: "SEO",
        entityId: updated.id,
        version: 1,
        snapshot: { updatedAt: new Date().toISOString() },
        changeSummary: "Updated YouTube SEO Package",
        actorId: session.user.id,
      },
    });

    return apiSuccess({ package: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
