import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveTeacherForSchedule, resolveStudentForSchedule } from "@/lib/whiteboard/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

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
    if (!teacher && !student) throw new ForbiddenError();

    let wbSession = await prisma.whiteboardSession.findUnique({
      where: { batchScheduleId: params.batchScheduleId },
      // livePhase lets the student client tell "session exists but teacher
      // hasn't hit Start Class yet" (PREPARING — show the lobby, chat is
      // already live) apart from "class is actually live" (LIVE — mount
      select: {
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
      },
    });

    if (!wbSession && schedule.type === "LIVE_CLASS") {
      const assignedTeacherId =
        schedule.teacherId ??
        (await prisma.batchTeacher.findFirst({ where: { batchId: schedule.batchId } }))?.teacherId;

      if (assignedTeacherId) {
        try {
          wbSession = await prisma.whiteboardSession.upsert({
            where: { batchScheduleId: params.batchScheduleId },
            update: {},
            create: {
              batchScheduleId: schedule.id,
              teacherId: assignedTeacherId,
              title: schedule.title,
              livePhase: "PREPARING",
              status: "ACTIVE",
              scheduledStart: schedule.startsAt ? new Date(schedule.startsAt) : new Date(),
              scheduledEnd: schedule.endsAt ? new Date(schedule.endsAt) : new Date(Date.now() + 60 * 60 * 1000),
              pages: { create: { pageNumber: 1, objects: [] } },
            },
            select: {
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
            },
          });
        } catch {
          wbSession = await prisma.whiteboardSession.findUnique({
            where: { batchScheduleId: params.batchScheduleId },
            select: {
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
            },
          });
        }
      }
    }

    return apiSuccess({
      whiteboardSession: wbSession ?? null,
      schedule: {
        id: schedule.id,
        title: schedule.title,
        startsAt: schedule.startsAt,
        endsAt: schedule.endsAt,
        type: schedule.type,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
