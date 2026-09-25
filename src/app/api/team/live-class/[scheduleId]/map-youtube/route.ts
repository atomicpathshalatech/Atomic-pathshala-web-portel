import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { extractYouTubeVideoId } from "@/lib/live-class/youtube";
import { pusherServer, sessionChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";

export async function POST(
  request: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);

    const schedule = await prisma.batchSchedule.findUnique({
      where: { id: params.scheduleId },
      include: { liveWhiteboardSession: true, lecture: true },
    });

    if (!schedule) return apiError("Scheduled class not found", 404);

    const body = await request.json().catch(() => ({}));
    const youtubeInput = body?.youtubeUrlOrId || body?.youtubeVideoId;
    if (!youtubeInput || typeof youtubeInput !== "string") {
      return apiError("Please provide a valid YouTube URL or Video ID.", 400);
    }

    const videoId = extractYouTubeVideoId(youtubeInput);
    if (!videoId) {
      return apiError("Could not extract a valid 11-character YouTube video ID.", 400);
    }

    const fullYouTubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const now = new Date();

    // 1. Update WhiteboardSession & Schedule Status
    const [wbSession] = await Promise.all([
      prisma.whiteboardSession.upsert({
        where: { batchScheduleId: params.scheduleId },
        update: {
          status: "ACTIVE",
          livePhase: "LIVE",
          videoTransport: "YOUTUBE",
          youtubeVideoId: videoId,
          actualStartedAt: schedule.liveWhiteboardSession?.actualStartedAt || now,
          startedAt: schedule.liveWhiteboardSession?.startedAt || now,
        },
        create: {
          batchScheduleId: params.scheduleId,
          teacherId: schedule.teacherId || session.user.id,
          title: schedule.title,
          status: "ACTIVE",
          livePhase: "LIVE",
          videoTransport: "YOUTUBE",
          youtubeVideoId: videoId,
          actualStartedAt: now,
          startedAt: now,
          scheduledStart: schedule.startsAt,
          scheduledEnd: schedule.endsAt,
          pages: {
            create: {
              pageNumber: 1,
              objects: [],
            },
          },
        },
      }),
      prisma.batchSchedule.update({
        where: { id: params.scheduleId },
        data: { status: "LIVE" },
      }),
    ]);

    // 2. Invalidate cache so polling students see live state immediately
    const { cache } = await import("@/lib/cache/redis");
    await cache.del(`wb:schedule:${params.scheduleId}`);

    // 3. If connected to a Lecture curriculum record, update videoUrl & status
    if (schedule.lectureId) {
      await prisma.lecture.update({
        where: { id: schedule.lectureId },
        data: {
          videoUrl: fullYouTubeUrl,
          status: "PUBLISHED",
        },
      }).catch((err) => console.warn("[map-youtube] Lecture update notice:", err));
    }

    // 4. Real-time broadcast
    try {
      await pusherServer.trigger(sessionChannel(wbSession.id), WB_EVENTS.LIVE_PHASE_CHANGED, {
        phase: "LIVE",
        livePhase: "LIVE",
        videoTransport: "YOUTUBE",
        youtubeVideoId: videoId,
        actualStartedAt: now.toISOString(),
        serverTime: now.toISOString(),
      });
      await pusherServer.trigger(sessionChannel(wbSession.id), WB_EVENTS.CONFIG_UPDATED, {
        videoTransport: "YOUTUBE",
        youtubeVideoId: videoId,
      });
    } catch (pushErr) {
      console.warn("[map-youtube] Pusher broadcast warning:", pushErr);
    }

    return apiSuccess({
      message: "YouTube live class mapped successfully.",
      videoId,
      youtubeUrl: fullYouTubeUrl,
      whiteboardSession: wbSession,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
