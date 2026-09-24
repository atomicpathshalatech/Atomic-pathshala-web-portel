import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { pusherServer, sessionChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";

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
        const defaultBatch =
          (await prisma.batch.findFirst({ where: { status: "ACTIVE" } })) ||
          (await prisma.batch.findFirst());

        if (defaultBatch) {
          const { computeISTScheduleDates } = await import("@/lib/date-utils");
          const { startsAt, endsAt } = computeISTScheduleDates(
            lecture.scheduledDate,
            lecture.startTime,
            lecture.durationMin || 60
          );

          schedule = await prisma.batchSchedule.upsert({
            where: { id: lecture.id },
            update: {
              title: lecture.title,
              chapterId: lecture.chapterId,
              teacherId: lecture.teacherId,
              lectureId: lecture.id,
              startsAt,
              endsAt,
            },
            create: {
              id: lecture.id,
              title: lecture.title,
              type: "LIVE_CLASS",
              batchId: defaultBatch.id,
              teacherId: lecture.teacherId,
              chapterId: lecture.chapterId,
              lectureId: lecture.id,
              startsAt,
              endsAt,
              createdById: session.user.id,
            },
            include: { liveWhiteboardSession: true },
          });
        }
      }
    }

    if (!schedule) return apiError("Scheduled class not found", 404);

    // Slide/presentation prep is metadata prep, not entering the live room
    // with students -- gated by canTeacherPrepareClass (any time before the
    // class is cancelled/concluded), NOT the stricter T-15
    // canTeacherEnterClass room-entry window. That T-15 gate used to block
    // a teacher from preparing slides more than 15 minutes ahead, which
    // defeated the entire point of "prepare in advance."
    const { canTeacherPrepareClass } = await import("@/lib/schedule/access-rules");
    const evaluation = canTeacherPrepareClass(schedule, new Date());
    if (!evaluation.allowed) {
      return apiError(
        evaluation.reason || "This class can no longer be prepared.",
        403,
        {
          code: evaluation.code || "ENTRY_TOO_EARLY",
          details: {
            opensAt: evaluation.opensAt.toISOString(),
            secondsUntilWindowOpens: evaluation.secondsUntilWindowOpens,
          },
        }
      );
    }

    const teacher = await prisma.teacher.findFirst({
      where: { userId: session.user.id },
    });

    if (!teacher) return apiError("Teacher profile not found", 403);

    const body = await request.json();
    const {
      presentationUrl,
      presentationName,
      presentationType,
      classroomTheme = "LIGHT",
      cameraShape = "SQUARE",
      cameraPosition = "UPPER_RIGHT",
      videoTransport,
      youtubeVideoId,
    } = body;

    const sessionStart = schedule.startsAt ? new Date(schedule.startsAt) : new Date();
    const sessionEnd = schedule.endsAt ? new Date(schedule.endsAt) : new Date(Date.now() + 60 * 60 * 1000);

    // Auto-generated first slide (chapter name, lecture number, the
    // teacher's own profile photo) — only needed the first time this
    // session's page 1 is ever created; a teacher preparing slides on an
    // already-existing session (the `update` branch below) never touches
    // `pages`, so there's nothing to (re)generate for.
    let startSlideUrl: string | null = null;
    if (!schedule.liveWhiteboardSession) {
      try {
        const { generateCreative } = await import("@/lib/creative/engine");
        const result = await generateCreative("LECTURE_START_SLIDE", schedule.id);
        if (result.ok) startSlideUrl = result.assetUrl;
      } catch (slideErr) {
        console.error("[live_class_start_slide_error]", slideErr);
      }
    }

    const wbSession = await prisma.whiteboardSession.upsert({
      where: { batchScheduleId: schedule.id },
      update: {
        presentationUrl: presentationUrl !== undefined ? presentationUrl || null : undefined,
        presentationName: presentationName !== undefined ? presentationName || null : undefined,
        presentationType: presentationType !== undefined ? presentationType || null : undefined,
        classroomTheme: classroomTheme === "DARK" ? "DARK" : "LIGHT",
        cameraShape: cameraShape === "CIRCULAR" ? "CIRCULAR" : "SQUARE",
        cameraPosition: cameraPosition || "UPPER_RIGHT",
        scheduledStart: sessionStart,
        scheduledEnd: sessionEnd,
        ...(videoTransport ? { videoTransport } : {}),
        ...(youtubeVideoId !== undefined ? { youtubeVideoId: youtubeVideoId || null } : {}),
      },
      create: {
        batchScheduleId: schedule.id,
        teacherId: teacher.id,
        title: schedule.title,
        status: "ACTIVE",
        livePhase: "PREPARING",
        videoTransport: videoTransport === "YOUTUBE" ? "YOUTUBE" : "LIVEKIT",
        youtubeVideoId: youtubeVideoId || null,
        presentationUrl: presentationUrl || null,
        presentationName: presentationName || null,
        presentationType: presentationType || null,
        classroomTheme: classroomTheme === "DARK" ? "DARK" : "LIGHT",
        cameraShape: cameraShape === "CIRCULAR" ? "CIRCULAR" : "SQUARE",
        cameraPosition: cameraPosition || "UPPER_RIGHT",
        scheduledStart: sessionStart,
        scheduledEnd: sessionEnd,
        pages: {
          create: {
            pageNumber: 1,
            objects: [],
            ...(startSlideUrl && { background: startSlideUrl }),
          },
        },
      },
      include: {
        pages: { orderBy: { pageNumber: "asc" } },
      },
    });

    let obsBroadcastUrl: string | undefined;
    if (wbSession.videoTransport === "YOUTUBE" || wbSession.videoTransport === "BOTH") {
      const { createBroadcastToken } = await import("@/lib/live-class/broadcast-token");
      const { getAppBaseUrl } = await import("@/lib/email/app-url");
      const broadcastToken = createBroadcastToken(schedule.id, session.user.id);
      obsBroadcastUrl = `${getAppBaseUrl()}/obs-stage/${schedule.id}?token=${broadcastToken}`;

      if (!wbSession.youtubeStreamKey && !wbSession.youtubeVideoId) {
        try {
          const { youtubeLiveClassConfigured, ensureYoutubeBroadcastForWhiteboard } = await import(
            "@/lib/live-class/youtube-broadcast"
          );
          if (youtubeLiveClassConfigured()) {
            const withBroadcast = await ensureYoutubeBroadcastForWhiteboard(
              wbSession.id,
              schedule.title,
              sessionStart
            );
            Object.assign(wbSession, {
              youtubeBroadcastId: withBroadcast.youtubeBroadcastId,
              youtubeStreamId: withBroadcast.youtubeStreamId,
              youtubeVideoId: withBroadcast.youtubeVideoId,
              youtubeLiveChatId: withBroadcast.youtubeLiveChatId,
              youtubeStatus: withBroadcast.youtubeStatus,
              youtubeIngestUrl: withBroadcast.youtubeIngestUrl,
              youtubeStreamKey: withBroadcast.youtubeStreamKey,
            });
          }
        } catch (ytErr) {
          console.warn("[preflight_youtube_init_warning]", ytErr);
        }
      }
    }

    // Notify connected clients of updated pre-flight configuration
    try {
      await pusherServer.trigger(sessionChannel(wbSession.id), WB_EVENTS.CONFIG_UPDATED, {
        presentationUrl: wbSession.presentationUrl,
        presentationName: wbSession.presentationName,
        presentationType: wbSession.presentationType,
        classroomTheme: wbSession.classroomTheme,
        cameraShape: wbSession.cameraShape,
      });
    } catch (pushErr) {
      console.warn("Realtime config push warning:", pushErr);
    }

    return apiSuccess({
      message: "Pre-flight setup saved successfully.",
      whiteboardSession: wbSession,
      obsBroadcastUrl,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
