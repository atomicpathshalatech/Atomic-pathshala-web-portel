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

    // 1. Update WhiteboardSession
    const wbSession = await prisma.whiteboardSession.upsert({
      where: { batchScheduleId: params.scheduleId },
      update: {
        videoTransport: "YOUTUBE",
        youtubeVideoId: videoId,
      },
      create: {
        batchScheduleId: params.scheduleId,
        teacherId: schedule.teacherId || session.user.id,
        title: schedule.title,
        status: "ACTIVE",
        livePhase: "LIVE",
        videoTransport: "YOUTUBE",
        youtubeVideoId: videoId,
        scheduledStart: schedule.startsAt,
        scheduledEnd: schedule.endsAt,
      },
    });

    // 2. If connected to a Lecture curriculum record, update videoUrl & status
    if (schedule.lectureId) {
      await prisma.lecture.update({
        where: { id: schedule.lectureId },
        data: {
          videoUrl: fullYouTubeUrl,
          status: "PUBLISHED",
        },
      }).catch((err) => console.warn("[map-youtube] Lecture update notice:", err));
    }

    // 3. Real-time broadcast
    try {
      await pusherServer.trigger(sessionChannel(wbSession.id), WB_EVENTS.CONFIG_UPDATED, {
        videoTransport: "YOUTUBE",
        youtubeVideoId: videoId,
      });
    } catch {}

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
