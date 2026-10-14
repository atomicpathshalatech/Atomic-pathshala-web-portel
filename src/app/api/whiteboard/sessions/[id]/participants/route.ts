import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { ONLINE_WINDOW_MS } from "@/lib/whiteboard/constants";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    // Teacher-only: this lists every enrolled student with their email.
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

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
                enrollments: { where: { status: "ACTIVE" }, select: { studentId: true } },
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

    // Only students who actually came into this class (an attendance row),
    // one row each — the list used to show every enrolled student, so the
    // teacher could not tell who was really there. Online = a heartbeat in
    // the last ONLINE_WINDOW_MS; the rest joined and left (offline).
    const enrolledIds = new Set(wbSession.batchSchedule.batch.enrollments.map((e) => e.studentId));
    const seen = new Set<string>();
    const joinedStudents = wbSession.attendances
      .filter((att) => {
        if (seen.has(att.studentId)) return false;
        seen.add(att.studentId);
        return true;
      })
      .map((att) => {
        const isRecentlyActive = !!att.lastSeenAt && Date.now() - new Date(att.lastSeenAt).getTime() < ONLINE_WINDOW_MS;
        return {
          id: att.student.id,
          userId: att.student.user.id,
          name: att.student.user.name,
          photoUrl: att.student.user.photoUrl,
          email: att.student.user.email,
          hasJoined: true,
          enrolled: enrolledIds.has(att.studentId),
          joinedAt: att.joinedAt ? att.joinedAt.toISOString() : null,
          lastSeenAt: att.lastSeenAt ? att.lastSeenAt.toISOString() : null,
          activeDurationSec: att.activeDurationSec ?? 0,
          reconnectCount: att.reconnectCount ?? 0,
          interactionCount: att.interactionCount ?? 0,
          isRecentlyActive,
        };
      })
      .sort((x, y) => Number(y.isRecentlyActive) - Number(x.isRecentlyActive) || x.name.localeCompare(y.name));

    return apiSuccess({
      teacher: {
        id: wbSession.teacher.id,
        userId: wbSession.teacher.user.id,
        name: wbSession.teacher.user.name,
        photoUrl: wbSession.teacher.user.photoUrl,
      },
      participants: joinedStudents,
      totalEnrolled: enrolledIds.size,
      totalAttended: joinedStudents.length,
      onlineCount: joinedStudents.filter((p) => p.isRecentlyActive).length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
