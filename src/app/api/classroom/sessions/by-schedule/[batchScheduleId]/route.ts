import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveTeacherForSchedule, resolveStudentForSchedule, toScheduleAccessTarget } from "@/lib/classroom/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Classroom equivalent of /api/whiteboard/sessions/by-schedule/[batchScheduleId] —
 * looked up by BatchSchedule id (all a student's timetable knows) rather
 * than a ClassroomSession id, which may not exist yet if the teacher hasn't
 * configured/started the classroom. Returns { classroomSession: null } (not
 * an error) in that case so the client renders an honest waiting state.
 */
export async function GET(_request: NextRequest, { params }: { params: { batchScheduleId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const [{ schedule, teacher }, { student }] = await Promise.all([
      resolveTeacherForSchedule(session.user.id, params.batchScheduleId),
      resolveStudentForSchedule(session.user.id, params.batchScheduleId),
    ]);

    if (!schedule) return apiError("Scheduled class not found", 404);
    if (!teacher && !student) throw new ForbiddenError();

    const classroomSession = await prisma.classroomSession.findUnique({
      where: { batchScheduleId: params.batchScheduleId },
      select: {
        id: true,
        title: true,
        phase: true,
        streamMethod: true,
        youtubeVideoId: true,
        recordingVideoId: true,
        recordingStatus: true,
        chatEnabled: true,
        handRaiseEnabled: true,
        startedAt: true,
        endedAt: true,
      },
    });

    const { canStudentJoinClass, canTeacherStartClass, getEffectiveScheduleStatus } = await import(
      "@/lib/schedule/access-rules"
    );
    const now = new Date();
    const scheduleTarget = toScheduleAccessTarget(schedule, classroomSession);

    const studentEval = canStudentJoinClass(scheduleTarget, now);
    const teacherStartEval = canTeacherStartClass(scheduleTarget, now);
    const effectiveStatus = getEffectiveScheduleStatus(scheduleTarget, now);

    return apiSuccess({
      classroomSession: classroomSession ?? null,
      serverTime: now.toISOString(),
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
        canTeacherStart: teacherStartEval.allowed,
        studentReason: studentEval.reason,
        opensAt: studentEval.opensAt.toISOString(),
        startsAt: new Date(schedule.startsAt).toISOString(),
        secondsUntilWindowOpens: studentEval.secondsUntilWindowOpens,
        secondsUntilStartsAt: studentEval.secondsUntilStartsAt,
        isLive: studentEval.isLive,
        isCompleted: studentEval.isCompleted,
        isCancelled: studentEval.isCancelled,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
