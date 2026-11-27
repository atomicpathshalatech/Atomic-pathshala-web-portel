import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { youtubeChannelConfigured } from "@/lib/youtube/channels";
import {
  generateChannelAnalyticsReport,
  generateVideoReview,
} from "@/lib/ai-studio/analytics/insights-engine";
import { ChannelVideoMetric } from "@/lib/ai-studio/analytics/youtube-analytics";

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("SYNC_CHANNEL"),
    channelKey: z.enum(["MAIN", "APP"]).default("MAIN"),
  }),
  z.object({
    action: z.literal("REVIEW_VIDEO"),
    channelKey: z.enum(["MAIN", "APP"]).default("MAIN"),
    video: z.object({
      videoId: z.string(),
      title: z.string(),
      publishedAt: z.string(),
      durationSec: z.number(),
      format: z.enum(["SHORTS", "LONG", "LIVE"]),
      views: z.number(),
      likes: z.number().nullable(),
      comments: z.number().nullable(),
      thumbnailUrl: z.string().nullable(),
      url: z.string(),
    }),
  }),
]);

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.YOUTUBE_ANALYTICS_VIEW);

    const channelKey = req.nextUrl.searchParams.get("channelKey") || "MAIN";

    const [reports, reviews, platformStatsCount] = await Promise.all([
      prisma.channelAnalyticsReport.findMany({
        where: { channelKey },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.videoReviewReport.findMany({
        where: { channelKey },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
      prisma.youtubeVideoStat.count(),
    ]);

    return apiSuccess({
      reports,
      reviews,
      platformStatsCount,
      channelStatus: {
        MAIN: youtubeChannelConfigured("MAIN"),
        APP: youtubeChannelConfigured("APP"),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.YOUTUBE_ANALYTICS_VIEW);

    const body = postSchema.parse(await req.json());

    if (body.action === "SYNC_CHANNEL") {
      const report = await generateChannelAnalyticsReport({
        channelKey: body.channelKey,
        userId: session.user.id,
        roleName: session.user.role ?? undefined,
      });
      return apiSuccess({ report }, 201);
    }

    if (body.action === "REVIEW_VIDEO") {
      const review = await generateVideoReview({
        channelKey: body.channelKey,
        video: body.video as ChannelVideoMetric,
        userId: session.user.id,
        roleName: session.user.role ?? undefined,
      });
      return apiSuccess({ review }, 201);
    }

    return apiError("Unsupported action", 400);
  } catch (err) {
    return handleApiError(err);
  }
}
