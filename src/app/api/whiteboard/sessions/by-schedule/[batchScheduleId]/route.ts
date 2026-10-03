import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveTeacherForSchedule, resolveStudentForSchedule, hasLenientLiveClassAccess } from "@/lib/whiteboard/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { cache } from "@/lib/cache/redis";

// Explicit allowlist — this route is polled by students, so it must never
// return the whole WhiteboardSession row (youtubeStreamKey, ingest URL,
// recording/archive internals).
const STUDENT_SAFE_SESSION_SELECT = {
  id: true,
  title: true,
  status: true,
  livePhase: true,
  videoTransport: true,
  youtubeVideoId: true,
  startedAt: true,
  endedAt: true,
  presentationUrl: true,
  presentationName: true,
  presentationType: true,
  classroomTheme: true,
  cameraShape: true,
  cameraPosition: true,
  scheduledStart: true,
  scheduledEnd: true,
  actualStartedAt: true,
  actualEndedAt: true,
  totalExtendedMinutes: true,
} as const;

/**
 * Looks up the live session (if any) for a scheduled class, keyed by
 * BatchSchedule id rather than WhiteboardSession id — this is what a
 * student's "Join Class" flow calls, since they only know the schedule id
 * from their timetable, not a session id that may not exist yet if the
 * teacher hasn't started class. Returns { whiteboardSession: null } (not an
 * error) when nothing has started yet, so the client can show an honest
 * "waiting for your teacher" state instead of a broken one.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { batchScheduleId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const [{ schedule, teacher }, { student }] = await Promise.all([
      resolveTeacherForSchedule(session.user.id, params.batchScheduleId),
      resolveStudentForSchedule(session.user.id, params.batchScheduleId),
    ]);

    if (!schedule) return apiError("Scheduled class not found", 404);

    // resolveStudentForSchedule stays strictly batch-scoped (it's shared with
    // the Test Engine) — this route alone widens, to match the live-class
    // page's own lenient access check. Without this, a student the page let
    // through could still 403 here forever and see an indefinite blank
    // "waiting" screen with no error surfaced (see hasLenientLiveClassAccess).
    let hasAccess = Boolean(teacher || student);
    if (!hasAccess) {
      const studentRow = await prisma.student.findUnique({ where: { userId: session.user.id } });
      if (studentRow) {
        hasAccess = await hasLenientLiveClassAccess(
          session.user.id,
          studentRow.id,
          schedule.batchId,
          schedule.chapterId
        );
      }
    }
    if (!hasAccess) throw new ForbiddenError();

    let wbSession = await cache.getOrSet(
      `wb:schedule:${params.batchScheduleId}`,
      async () => {
        const { alignRoomClockWithSchedule } = await import("@/lib/live-session/service");
        await alignRoomClockWithSchedule(params.batchScheduleId).catch(() => false);
        let ws = await prisma.whiteboardSession.findUnique({
          where: { batchScheduleId: params.batchScheduleId },
          select: STUDENT_SAFE_SESSION_SELECT,
        });

        // Batches share a room ONLY through an admin-created simulcast group
        // — never implicitly because two schedules happen to share a lecture.
        if (!ws) {
          const { resolveGroupWhiteboardSessionId } = await import("@/lib/live-session/simulcast");
          const groupRoomId = await resolveGroupWhiteboardSessionId(params.batchScheduleId);
          if (groupRoomId) {
            ws = await prisma.whiteboardSession.findUnique({ where: { id: groupRoomId }, select: STUDENT_SAFE_SESSION_SELECT });
          }
        }
        // A stored link (older rows) is served as its video id.
        if (ws?.youtubeVideoId && ws.youtubeVideoId.length !== 11) {
          const { extractYouTubeVideoId } = await import("@/lib/live-class/youtube");
          ws = { ...ws, youtubeVideoId: extractYouTubeVideoId(ws.youtubeVideoId) ?? ws.youtubeVideoId };
        }
        return ws;
      },
      3
    );

    // Authoritative lifecycle state for THIS schedule's occurrence. Clients
    // decide "live" from this, never from the presence of a YouTube id.
    const liveState = await cache.getOrSet(
      `live:state:${params.batchScheduleId}`,
      async () => {
        const { getOpenLiveSession, getLatestLiveSession } = await import("@/lib/live-session/service");
        const row = (await getOpenLiveSession(params.batchScheduleId)) ?? (await getLatestLiveSession(params.batchScheduleId));
        return row?.state ?? null;
      },
      3
    );

    // Students only get the video id while the class is actually live (or
    // ending) — a pre-created or already-finished broadcast is not "live".
    // Sessions with no lifecycle row yet (not backfilled) keep old behaviour.
    if (!teacher && wbSession && liveState && liveState !== "LIVE" && liveState !== "ENDING") {
      wbSession = { ...wbSession, youtubeVideoId: null };
    }

    // No YouTube API call here: this route is polled by every student every
    // few seconds, and the videos.update (≈50 quota units) that used to run
    // on each hit could exhaust the whole daily YouTube quota within minutes.
    // Embeddability is set once when the broadcast is created.

    const {
      canStudentJoinClass,
      canTeacherEnterClass,
      canTeacherStartClass,
      getEffectiveScheduleStatus,
    } = await import("@/lib/schedule/access-rules");
    const now = new Date();
    const scheduleTarget = {
      id: schedule.id,
      startsAt: schedule.startsAt,
      endsAt: schedule.endsAt,
      status: schedule.status,
      type: schedule.type,
      liveWhiteboardSession: wbSession,
    };

    const studentEval = canStudentJoinClass(scheduleTarget, now);
    const teacherEnterEval = canTeacherEnterClass(scheduleTarget, now);
    const teacherStartEval = canTeacherStartClass(scheduleTarget, now);
    const effectiveStatus = getEffectiveScheduleStatus(scheduleTarget, now);

    return apiSuccess({
      whiteboardSession: wbSession ?? null,
      liveState,
      serverTime: now.toISOString(),
      serverTimeMs: now.getTime(),
      schedule: {
        id: schedule.id,
        title: schedule.title,
        startsAt: schedule.startsAt,
        endsAt: schedule.endsAt,
        type: schedule.type,
        status: effectiveStatus,
      },
      access: {
        canStudentJoin: studentEval.allowed,
        canTeacherEnter: teacherEnterEval.allowed,
        canTeacherStart: teacherStartEval.allowed,
        studentReason: studentEval.reason,
        teacherReason: teacherStartEval.reason,
        teacherEnterReason: teacherEnterEval.reason,
        opensAt: studentEval.opensAt.toISOString(),
        startOpensAt: teacherStartEval.startOpensAt.toISOString(),
        startsAt: new Date(schedule.startsAt).toISOString(),
        secondsUntilWindowOpens: studentEval.secondsUntilWindowOpens,
        secondsUntilStartOpens: teacherStartEval.secondsUntilStartOpens,
        secondsUntilStartsAt: teacherStartEval.secondsUntilStartsAt,
        isLive: studentEval.isLive,
        isCompleted: studentEval.isCompleted,
        isCancelled: studentEval.isCancelled,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
