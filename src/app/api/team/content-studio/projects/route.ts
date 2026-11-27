import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

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

const createProjectSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional(),
  type: z.enum(PROJECT_TYPES).default("YOUTUBE_VIDEO"),
  topic: z.string().trim().max(240).optional(),
  subject: z.string().trim().max(120).optional(),
  chapter: z.string().trim().max(160).optional(),
  targetAudience: z.string().trim().max(160).optional(),
  platform: z.string().trim().max(60).optional(),
  objective: z.string().trim().max(1000).optional(),
  targetChannel: z.string().trim().max(40).optional(),
  language: z.string().trim().max(16).default("en"),
  managerId: z.string().trim().optional().nullable(),
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
});

function makeSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base || "project"}-${suffix}`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_PROJECT_READ);

    const status = req.nextUrl.searchParams.get("status");
    const type = req.nextUrl.searchParams.get("type");
    const q = req.nextUrl.searchParams.get("q")?.trim();

    const projects = await prisma.contentProject.findMany({
      where: {
        ...(status ? { status: status as never } : { status: { not: "ARCHIVED" } }),
        ...(type ? { type: type as never } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { topic: { contains: q, mode: "insensitive" } },
                { subject: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        manager: { select: { id: true, name: true, email: true } },
        _count: {
          select: {
            scripts: true,
            storyboards: true,
            assets: true,
            jobs: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 60,
    });

    return apiSuccess({ projects });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_PROJECT_CREATE);

    const body = createProjectSchema.parse(await req.json());
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { reportingManagerId: true },
    });

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.contentProject.create({
        data: {
          title: body.title,
          slug: makeSlug(body.title),
          description: body.description ?? null,
          type: body.type,
          status: "IDEA",
          topic: body.topic ?? null,
          subject: body.subject ?? null,
          chapter: body.chapter ?? null,
          targetAudience: body.targetAudience ?? null,
          platform: body.platform ?? "YOUTUBE",
          objective: body.objective ?? null,
          targetChannel: body.targetChannel ?? "MAIN",
          language: body.language,
          tags: body.tags ?? [],
          ownerId: session.user.id,
          managerId: body.managerId ?? user?.reportingManagerId ?? null,
          members: {
            create: {
              userId: session.user.id,
              role: "OWNER",
              canApprove: true,
              canPublish: true,
            },
          },
        },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          manager: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.contentHistory.create({
        data: {
          projectId: created.id,
          entityType: "PROJECT",
          entityId: created.id,
          version: 1,
          snapshot: { title: created.title, type: created.type, status: created.status },
          changeSummary: "Project created",
          actorId: session.user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CONTENT_STUDIO_PROJECT_CREATE",
          entityType: "ContentProject",
          entityId: created.id,
          metadata: { title: created.title, type: created.type },
        },
      });

      return created;
    });

    return apiSuccess({ project }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
