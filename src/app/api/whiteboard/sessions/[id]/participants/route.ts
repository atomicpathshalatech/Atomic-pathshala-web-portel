import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access) throw new ForbiddenError();

    const wbSession = await prisma.whiteboardSession.findUnique({
      where: { id: params.id },
      include: {
        teacher: {
          include: {
            user: { select: { id: true, name: true, photoUrl: true, email: true } },
          },
        },
        batchSchedule: {
          include: {
            batch: {
              include: {
                enrollments: {
                  where: { status: "ACTIVE" },
                  include: {
                    student: {
                      include: {
                        user: { select: { id: true, name: true, photoUrl: true, email: true } },
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
                user: { select: { id: true, name: true, photoUrl: true, email: true } },
              },
            },
          },
        },
      },
    });

    if (!wbSession) return apiError("Whiteboard session not found", 404);

    const attendanceMap = new Map(
      wbSession.attendances.map((a) => [a.studentId, a])
    );

    const enrolledStudents = wbSession.batchSchedule.batch.enrollments.map((e) => {
      const att = attendanceMap.get(e.studentId);
      const isRecentlyActive =
        att && att.lastSeenAt && Date.now() - new Date(att.lastSeenAt).getTime() < 120_000;

      return {
        id: e.student.id,
        userId: e.student.user.id,
        name: e.student.user.name,
        photoUrl: e.student.user.photoUrl,
        email: e.student.user.email,
        hasJoined: !!att,
        joinedAt: att?.joinedAt ? att.joinedAt.toISOString() : null,
        lastSeenAt: att?.lastSeenAt ? att.lastSeenAt.toISOString() : null,
        activeDurationSec: att?.activeDurationSec ?? 0,
        reconnectCount: att?.reconnectCount ?? 0,
        interactionCount: att?.interactionCount ?? 0,
        isRecentlyActive: !!isRecentlyActive,
      };
    });

    return apiSuccess({
      teacher: {
        id: wbSession.teacher.id,
        userId: wbSession.teacher.user.id,
        name: wbSession.teacher.user.name,
        photoUrl: wbSession.teacher.user.photoUrl,
      },
      participants: enrolledStudents,
      totalEnrolled: enrolledStudents.length,
      totalAttended: wbSession.attendances.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
