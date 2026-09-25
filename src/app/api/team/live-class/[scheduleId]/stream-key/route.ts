import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError, hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { createBroadcastToken } from "@/lib/live-class/broadcast-token";
import { getAppBaseUrl } from "@/lib/email/app-url";

export async function POST(
  request: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);

    let schedule = await prisma.batchSchedule.findUnique({
      where: { id: params.scheduleId },
      include: { liveWhiteboardSession: true },
    });

    if (!schedule) {
      const lecture = await prisma.lecture.findUnique({
        where: { id: params.scheduleId },
        include: { chapter: true, teacher: true },
      });
      if (lecture) {
        schedule = await prisma.batchSchedule.findFirst({
          where: { OR: [{ id: lecture.id }, { lectureId: lecture.id }] },
          include: { liveWhiteboardSession: true },
        });
      }
    }

    if (!schedule) return apiError("Scheduled class not found", 404);

    let teacher = await prisma.teacher.findFirst({
      where: { userId: session.user.id },
    });

    const isDirectlyAssigned = teacher && schedule.teacherId === teacher.id;
    const isBatchAssigned =
      teacher &&
      (await prisma.batchTeacher.findFirst({
        where: { batchId: schedule.batchId, teacherId: teacher.id },
      }));
    const isAdmin = await hasPermission(session.user.id, PERMISSIONS.BATCH_UPDATE);

    if (!isDirectlyAssigned && !isBatchAssigned && !isAdmin) {
      throw new ForbiddenError("You are not authorized to access this live class stream key.");
    }

    if (!teacher && isAdmin) {
      if (schedule.teacherId) {
        teacher = await prisma.teacher.findUnique({ where: { id: schedule.teacherId } });
      }
      if (!teacher) {
        const code = Date.now().toString().slice(-6);
        teacher = await prisma.teacher.create({
          data: {
            userId: session.user.id,
            employeeCode: `ADM-INST-${code}`,
            department: "Academic Operations",
            subjects: ["General", "All Subjects"],
            bio: "Academic Administrator and Instructor",
          },
        });
      }
    }

    if (!teacher) return apiError("Teacher profile could not be resolved.", 403);

    // Ensure WhiteboardSession exists
    let wbSession = schedule.liveWhiteboardSession;
    const scheduledStart = schedule.startsAt ? new Date(schedule.startsAt) : new Date();
    const scheduledEnd = schedule.endsAt ? new Date(schedule.endsAt) : new Date(Date.now() + 60 * 60 * 1000);

    if (!wbSession) {
      wbSession = await prisma.whiteboardSession.create({
        data: {
          batchScheduleId: schedule.id,
          teacherId: teacher.id,
          title: schedule.title,
          status: "ACTIVE",
          livePhase: "PREPARING",
          videoTransport: "YOUTUBE",
          scheduledStart,
          scheduledEnd,
          pages: {
            create: {
              pageNumber: 1,
              objects: [],
            },
          },
        },
      });
    }

    // Generate or fetch YouTube broadcast credentials
    let serverUrl = "rtmp://a.rtmp.youtube.com/live2";
    let streamKey = wbSession.youtubeStreamKey || null;
    let videoId = wbSession.youtubeVideoId || null;

    try {
      const { youtubeLiveConfigured, getOrCreateMasterLiveStream } = await import(
        "@/lib/youtube/live-broadcast"
      );
      if (youtubeLiveConfigured()) {
        const masterStream = await getOrCreateMasterLiveStream();
        serverUrl = masterStream.ingestUrl || serverUrl;
        streamKey = masterStream.streamKey || streamKey;

        if (wbSession.youtubeStreamKey !== streamKey || wbSession.youtubeIngestUrl !== serverUrl) {
          wbSession = await prisma.whiteboardSession.update({
            where: { id: wbSession.id },
            data: {
              youtubeIngestUrl: serverUrl,
              youtubeStreamKey: streamKey,
            },
          });
        }
      }
    } catch (ytErr) {
      console.warn("[youtube_master_stream_key_fetch_warning]", ytErr);
    }

    const { YOUTUBE_OAUTH_PRODUCTION_URL } = await import("@/lib/youtube/oauth-config");
    const broadcastToken = createBroadcastToken(schedule.id, session.user.id);
    const obsBroadcastUrl = `${YOUTUBE_OAUTH_PRODUCTION_URL}/obs-stage/${schedule.id}?token=${broadcastToken}`;

    return apiSuccess({
      whiteboardSession: wbSession,
      serverUrl,
      streamKey,
      obsBroadcastUrl,
      youtubeVideoId: videoId,
      videoTransport: wbSession.videoTransport,
      livePhase: wbSession.livePhase,
      isLive: wbSession.livePhase === "LIVE",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
