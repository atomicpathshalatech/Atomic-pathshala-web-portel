import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { assertCanControlLiveClass } from "@/lib/live-class/ownership";
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

    // The schedule's assigned teacher or a LIVE_CLASS_ADMIN only.
    const { teacher } = await assertCanControlLiveClass(session.user.id, schedule.id);
    if (!teacher) return apiError("Teacher profile could not be resolved.", 403);

    // Encoder credentials exist only while THIS class holds a stream lease —
    // i.e. after Start Class, until the class ends. There is no shared master
    // key and no key before Start. Each hand-out is recorded (EncoderSession).
    const wbSession = schedule.liveWhiteboardSession;
    const { encoderCredentialsForSchedule } = await import("@/lib/live-session/app-youtube");
    const credentials = await encoderCredentialsForSchedule(schedule.id);
    if (credentials) {
      await prisma.encoderSession.create({
        data: {
          liveSessionId: credentials.liveSessionId,
          userId: session.user.id,
          credentialsExpireAt: new Date(Date.now() + 60_000),
          credentialsUsedAt: new Date(),
        },
      });
    }

    const { YOUTUBE_OAUTH_PRODUCTION_URL } = await import("@/lib/youtube/oauth-config");
    const broadcastToken = createBroadcastToken(schedule.id, session.user.id);
    const obsBroadcastUrl = `${YOUTUBE_OAUTH_PRODUCTION_URL}/obs-stage/${schedule.id}?token=${broadcastToken}`;

    const res = apiSuccess({
      // Only the two fields the OBS setup panel reads — never the stored row.
      whiteboardSession: {
        youtubeIngestUrl: credentials?.serverUrl ?? null,
        youtubeStreamKey: credentials?.streamKey ?? null,
      },
      serverUrl: credentials?.serverUrl ?? null,
      streamKey: credentials?.streamKey ?? null,
      liveState: credentials?.state ?? null,
      message: credentials ? null : "Click Start Class first — your class's stream key appears here once the class has a stream slot.",
      obsBroadcastUrl,
      youtubeVideoId: wbSession?.youtubeVideoId ?? null,
      videoTransport: wbSession?.videoTransport ?? null,
      livePhase: wbSession?.livePhase ?? null,
      isLive: wbSession?.livePhase === "LIVE",
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (error) {
    return handleApiError(error);
  }
}
