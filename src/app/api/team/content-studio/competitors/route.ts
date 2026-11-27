import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { resolveYouTubeChannelId } from "@/lib/ai-studio/research/sources";

const addCompetitorSchema = z.object({
  name: z.string().trim().min(2).max(120),
  channelUrl: z.string().trim().min(5).max(300),
  channelId: z.string().trim().optional(),
  group: z
    .enum([
      "NEET_CHEMISTRY",
      "NEET_BIOLOGY",
      "NEET_PHYSICS",
      "HINDI_MEDIUM",
      "ENGLISH_MEDIUM",
      "MOTIVATION",
      "GENERAL_EDTECH",
    ])
    .default("GENERAL_EDTECH"),
  category: z
    .enum(["NEET", "JEE", "BOARDS", "MOTIVATIONAL", "EDUCATIONAL_NEWS"])
    .default("NEET"),
  language: z.string().trim().max(16).default("hi"),
  description: z.string().trim().max(500).optional(),
});

const toggleSchema = z.object({
  id: z.string().trim(),
  isActive: z.boolean(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_RESEARCH);

    const group = req.nextUrl.searchParams.get("group");

    const [channels, recentVideos] = await Promise.all([
      prisma.competitorChannel.findMany({
        where: group ? { group: group as never } : undefined,
        include: { _count: { select: { videos: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.competitorVideo.findMany({
        where: group ? { competitorChannel: { group: group as never } } : undefined,
        include: {
          competitorChannel: { select: { id: true, name: true, group: true, language: true } },
        },
        orderBy: [{ publishedAt: "desc" }],
        take: 40,
      }),
    ]);

    return apiSuccess({ channels, recentVideos });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_RESEARCH);

    const body = addCompetitorSchema.parse(await req.json());
    const resolvedId =
      (body.channelId && /^UC[a-zA-Z0-9_-]{20,}$/.test(body.channelId) ? body.channelId : null) ||
      (await resolveYouTubeChannelId(body.channelUrl));

    if (!resolvedId) {
      return apiError(
        "Could not resolve a YouTube Channel ID (UC...). Please paste a /channel/UC... URL or explicit Channel ID.",
        400
      );
    }

    const channel = await prisma.competitorChannel.upsert({
      where: { channelId: resolvedId },
      create: {
        name: body.name,
        channelId: resolvedId,
        channelUrl: body.channelUrl,
        group: body.group,
        category: body.category,
        language: body.language,
        description: body.description ?? null,
        createdById: session.user.id,
      },
      update: {
        name: body.name,
        channelUrl: body.channelUrl,
        group: body.group,
        category: body.category,
        language: body.language,
        description: body.description ?? null,
        isActive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CONTENT_STUDIO_COMPETITOR_ADD",
        entityType: "CompetitorChannel",
        entityId: channel.id,
        metadata: { name: channel.name, channelId: channel.channelId, group: channel.group },
      },
    });

    return apiSuccess({ channel }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_RESEARCH);

    const body = toggleSchema.parse(await req.json());
    const channel = await prisma.competitorChannel.update({
      where: { id: body.id },
      data: { isActive: body.isActive },
    });

    return apiSuccess({ channel });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_DELETE);

    const id = req.nextUrl.searchParams.get("id");
    if (!id) return apiError("Missing id", 400);

    await prisma.competitorChannel.delete({ where: { id } });
    return apiSuccess({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
