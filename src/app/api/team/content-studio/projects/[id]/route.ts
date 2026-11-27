import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";

const PROJECT_STATUSES = [
  "IDEA",
  "RESEARCHING",
  "PLANNED",
  "SCRIPT_READY",
  "PRODUCTION",
  "EDITING",
  "REVIEW",
  "APPROVED",
  "PUBLISHED",
  "ARCHIVED",
] as const;

const PROJECT_TYPES = [
  "YOUTUBE_VIDEO",
  "YOUTUBE_SHORT",
  "INSTAGRAM_REEL",
  "MOTIVATIONAL_VIDEO",
  "BATCH_LAUNCH",
  "LECTURE",
  "THUMBNAIL",
  "CINEMATIC_PROMO",
  "SLIDE_DECK",
] as const;

const updateProjectSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  type: z.enum(PROJECT_TYPES).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  topic: z.string().trim().max(240).nullable().optional(),
  subject: z.string().trim().max(120).nullable().optional(),
  chapter: z.string().trim().max(160).nullable().optional(),
  targetAudience: z.string().trim().max(160).nullable().optional(),
  platform: z.string().trim().max(60).nullable().optional(),
  objective: z.string().trim().max(1000).nullable().optional(),
  targetChannel: z.string().trim().max(40).nullable().optional(),
  language: z.string().trim().max(16).optional(),
  managerId: z.string().trim().nullable().optional(),
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_PROJECT_READ);

    const project = await prisma.contentProject.findUnique({
      where: { id: params.id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        manager: { select: { id: true, name: true, email: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        ideas: { orderBy: { createdAt: "desc" }, take: 20 },
        plans: { orderBy: { version: "desc" }, take: 5 },
        scripts: { orderBy: { version: "desc" }, take: 10 },
        storyboards: { include: { scenes: { orderBy: { orderIndex: "asc" } } }, take: 5 },
        assets: { orderBy: { createdAt: "desc" }, take: 40 },
        jobs: { orderBy: { createdAt: "desc" }, take: 25 },
        histories: { orderBy: { createdAt: "desc" }, take: 30 },
      },
    });

    if (!project) return apiError("Project not found", 404);
    return apiSuccess({ project });
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
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_PROJECT_UPDATE);

    const body = updateProjectSchema.parse(await req.json());
    if (body.status === "APPROVED" || body.status === "PUBLISHED") {
      await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_PROJECT_APPROVE);
    }

    const existing = await prisma.contentProject.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!existing) return apiError("Project not found", 404);

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.contentProject.update({
        where: { id: params.id },
        data: {
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.type !== undefined ? { type: body.type } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.topic !== undefined ? { topic: body.topic } : {}),
          ...(body.subject !== undefined ? { subject: body.subject } : {}),
          ...(body.chapter !== undefined ? { chapter: body.chapter } : {}),
          ...(body.targetAudience !== undefined ? { targetAudience: body.targetAudience } : {}),
          ...(body.platform !== undefined ? { platform: body.platform } : {}),
          ...(body.objective !== undefined ? { objective: body.objective } : {}),
          ...(body.targetChannel !== undefined ? { targetChannel: body.targetChannel } : {}),
          ...(body.language !== undefined ? { language: body.language } : {}),
          ...(body.managerId !== undefined ? { managerId: body.managerId } : {}),
          ...(body.tags !== undefined ? { tags: body.tags } : {}),
          ...(body.status === "APPROVED"
            ? { approvedAt: new Date(), approvedById: session.user.id }
            : {}),
          ...(body.status === "PUBLISHED" ? { publishedAt: new Date() } : {}),
        },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          manager: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.contentHistory.create({
        data: {
          projectId: next.id,
          entityType: "PROJECT",
          entityId: next.id,
          version: 1,
          snapshot: body,
          changeSummary: body.status ? `Status changed to ${body.status}` : "Project updated",
          actorId: session.user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CONTENT_STUDIO_PROJECT_UPDATE",
          entityType: "ContentProject",
          entityId: next.id,
          metadata: body,
        },
      });

      return next;
    });

    return apiSuccess({ project: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_DELETE);

    const existing = await prisma.contentProject.findUnique({
      where: { id: params.id },
      select: { id: true, title: true },
    });
    if (!existing) return apiError("Project not found", 404);

    await prisma.$transaction(async (tx) => {
      await tx.contentProject.delete({ where: { id: params.id } });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CONTENT_STUDIO_PROJECT_DELETE",
          entityType: "ContentProject",
          entityId: params.id,
          metadata: { title: existing.title },
        },
      });
    });

    return apiSuccess({ deleted: true, id: params.id });
  } catch (err) {
    return handleApiError(err);
  }
}
