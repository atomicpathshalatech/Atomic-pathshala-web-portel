import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { assertCanControlLiveClass } from "@/lib/live-class/ownership";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
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
    const leased = await encoderCredentialsForSchedule(schedule.id);
    // Public class: the key the team entered for the stream they scheduled on
    // YouTube themselves (stored sealed on this class's session at Start).
    let manual: { serverUrl: string; streamKey: string } | null = null;
    if (wbSession?.youtubeStreamKey && wbSession.livePhase === "LIVE") {
      try {
        const { openSecret } = await import("@/lib/crypto/secret-box");
        manual = {
          serverUrl: wbSession.youtubeIngestUrl || "rtmp://a.rtmp.youtube.com/live2",
          streamKey: openSecret(wbSession.youtubeStreamKey),
        };
      } catch (err) {
        console.error("[stream_key_manual_unreadable]", err);
      }
    }
    // The key the teacher entered themselves wins: entering it means "send the class there".
    const credentials = (manual ? { ...manual, liveSessionId: null as string | null, state: "LIVE" } : null) ?? leased;
    if (credentials?.liveSessionId) {
      await prisma.encoderSession.create({
        data: {
          liveSessionId: credentials.liveSessionId!,
          userId: session.user.id,
          credentialsExpireAt: new Date(Date.now() + 60_000),
          credentialsUsedAt: new Date(),
        },
      });
    }

    const { YOUTUBE_OAUTH_PRODUCTION_URL } = await import("@/lib/youtube/oauth-config");
    const { issueStageToken, stageUrl } = await import("@/lib/live-class/stage-session");
    const stageToken = await issueStageToken({ batchScheduleId: schedule.id, issuedToUserId: session.user.id });
    const obsBroadcastUrl = stageToken ? stageUrl(YOUTUBE_OAUTH_PRODUCTION_URL, schedule.id, stageToken) : null;

    const res = apiSuccess({
      // Only the two fields the OBS setup panel reads — never the stored row.
      whiteboardSession: {
        youtubeIngestUrl: credentials?.serverUrl ?? null,
        youtubeStreamKey: credentials?.streamKey ?? null,
      },
      serverUrl: credentials?.serverUrl ?? null,
      streamKey: credentials?.streamKey ?? null,
      liveState: credentials?.state ?? null,
      manualStreamKey: Boolean(manual),
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

/**
 * The teacher's own YouTube stream (scheduled in YouTube Studio): its stream
 * key, and its link so students and the chat follow that video. Works at any
 * point of a live class — no YouTube API approval is needed for the stream
 * itself. The key is stored sealed on this class only and never returned
 * here; the Teacher app then fetches it with POST and starts sending.
 */
export async function PUT(request: NextRequest, { params }: { params: { scheduleId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);
    const { scheduleId, teacher } = await assertCanControlLiveClass(session.user.id, params.scheduleId);
    if (!scheduleId || !teacher) return apiError("Scheduled class not found", 404);

    const body = await request.json().catch(() => ({}));
    const streamKey = typeof body?.youtubeStreamKey === "string" ? body.youtubeStreamKey.trim() : "";
    if (!/^[A-Za-z0-9_-]{8,200}$/.test(streamKey)) {
      return apiError("That doesn't look like a YouTube stream key. Copy it from YouTube Studio → Go live → Stream key.", 400, { code: "BAD_STREAM_KEY" });
    }
    const ingestUrl =
      typeof body?.youtubeIngestUrl === "string" && /^rtmps?:\/\/[^\s]{4,300}$/i.test(body.youtubeIngestUrl.trim()) ? body.youtubeIngestUrl.trim() : null;

    const wbSession = await prisma.whiteboardSession.findFirst({
      where: { batchScheduleId: scheduleId },
      select: { id: true, livePhase: true, youtubeVideoId: true },
    });
    if (!wbSession || wbSession.livePhase !== "LIVE") return apiError("Start the class first, then add the stream key.", 409, { code: "NOT_LIVE" });

    const { extractYouTubeVideoId } = await import("@/lib/live-class/youtube-url");
    const link = typeof body?.youtubeUrlOrId === "string" ? body.youtubeUrlOrId.trim() : "";
    const videoId = link ? extractYouTubeVideoId(link) : wbSession.youtubeVideoId;
    if (link && !videoId) return apiError("Enter the YouTube link of this live stream (youtube.com/live/… or the video id).", 400, { code: "BAD_LINK" });
    if (!videoId) return apiError("Enter the YouTube link of this live stream too, so students and the chat follow it.", 400, { code: "NEEDS_LINK" });

    const { sealSecret } = await import("@/lib/crypto/secret-box");
    await prisma.whiteboardSession.update({
      where: { id: wbSession.id },
      data: {
        youtubeStreamKey: sealSecret(streamKey),
        youtubeIngestUrl: ingestUrl,
        youtubeVideoId: videoId,
        // A different video has a different live chat.
        ...(videoId !== wbSession.youtubeVideoId ? { youtubeLiveChatId: null } : {}),
      },
    });
    const res = apiSuccess({ youtubeVideoId: videoId });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (error) {
    return handleApiError(error);
  }
}
