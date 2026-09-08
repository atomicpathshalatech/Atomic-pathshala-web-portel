import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Server-authoritative Attendance Report API.
 * Attendance is strictly computed from verified server heartbeat events, not mere page loads.
 *
 * Tracks:
 * - student_id
 * - class_id
 * - joined_at
 * - left_at
 * - total_duration (activeDurationSec)
 * - rejoin_count (reconnectCount)
 * - attendance_status (PRESENT, PARTIAL, ABSENT)
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access) throw new ForbiddenError();

    const wbSession = await prisma.whiteboardSession.findUnique({
      where: { id: params.id },
      include: {
        batchSchedule: {
          include: {
            batch: {
              include: {
                enrollments: {
                  where: { status: "ACTIVE" },
                  include: {
                    student: {
                      include: {
                        user: { select: { id: true, name: true, email: true, photoUrl: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        attendances: {
          include: {
            student: {
              include: {
                user: { select: { id: true, name: true, email: true, photoUrl: true } },
              },
            },
          },
        },
      },
    });

    if (!wbSession) return apiError("Whiteboard session not found", 404);

    const classStart = wbSession.actualStartedAt || wbSession.startedAt;
    const classEnd = wbSession.actualEndedAt || wbSession.endedAt || new Date();
    const classDurationSeconds = Math.max(
      60,
      Math.round((classEnd.getTime() - classStart.getTime()) / 1000)
    );

    const attendanceMap = new Map(wbSession.attendances.map((a) => [a.studentId, a]));

    let totalPresent = 0;
    let totalPartial = 0;
    let totalAbsent = 0;

    const studentRecords = wbSession.batchSchedule.batch.enrollments.map((e) => {
      const att = attendanceMap.get(e.studentId);
      const activeDuration = att?.activeDurationSec ?? 0;

      // Server-authoritative calculation
      let attendanceStatus: "PRESENT" | "PARTIAL" | "ABSENT" = "ABSENT";
      if (activeDuration >= Math.min(900, Math.round(classDurationSeconds * 0.5))) {
        attendanceStatus = "PRESENT";
        totalPresent++;
      } else if (activeDuration > 0) {
        attendanceStatus = "PARTIAL";
        totalPartial++;
      } else {
        totalAbsent++;
      }

      return {
        studentId: e.student.id,
        userId: e.student.user.id,
        name: e.student.user.name,
        email: e.student.user.email,
        photoUrl: e.student.user.photoUrl,
        classId: wbSession.batchScheduleId,
        liveSessionId: wbSession.id,
        joinedAt: att?.joinedAt?.toISOString() || null,
        leftAt: att?.leftAt?.toISOString() || att?.lastSeenAt?.toISOString() || null,
        totalDurationSeconds: activeDuration,
        rejoinCount: att?.reconnectCount ?? 0,
        interactionCount: att?.interactionCount ?? 0,
        quizParticipated: att?.quizParticipated ?? false,
        attendanceStatus,
      };
    });

    return apiSuccess({
      classId: wbSession.batchScheduleId,
      liveSessionId: wbSession.id,
      title: wbSession.title,
      classDurationSeconds,
      summary: {
        totalEnrolled: studentRecords.length,
        totalPresent,
        totalPartial,
        totalAbsent,
        attendancePercentage:
          studentRecords.length > 0
            ? Math.round((totalPresent / studentRecords.length) * 100)
            : 0,
      },
      records: studentRecords,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
