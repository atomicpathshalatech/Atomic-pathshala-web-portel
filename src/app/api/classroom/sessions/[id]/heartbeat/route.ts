import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveClassroomAccess } from "@/lib/classroom/access";
import { apiSuccess, handleApiError } from "@/lib/api/response";

/** Student presence heartbeat — mirrors src/app/api/whiteboard/sessions/[id]/heartbeat/route.ts against ClassroomAttendance. */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveClassroomAccess(session.user.id, params.id);
    if (!access) throw new ForbiddenError();

    const now = new Date();
    if (access.role === "TEACHER") {
      return apiSuccess({ role: "TEACHER", timestamp: now.toISOString() });
    }

    const attendance = await prisma.classroomAttendance.findUnique({
      where: { classroomSessionId_studentId: { classroomSessionId: params.id, studentId: access.entityId } },
    });

    if (attendance) {
      const lastSeen = attendance.lastSeenAt ? new Date(attendance.lastSeenAt).getTime() : now.getTime();
      const diffSec = Math.min(60, Math.max(0, Math.round((now.getTime() - lastSeen) / 1000)));

      await prisma.classroomAttendance.update({
        where: { id: attendance.id },
        data: { lastSeenAt: now, activeDurationSec: { increment: diffSec } },
      });
    } else {
      await prisma.classroomAttendance.create({
        data: { classroomSessionId: params.id, studentId: access.entityId, joinedAt: now, lastSeenAt: now },
      });
    }

    return apiSuccess({ role: "STUDENT", timestamp: now.toISOString() });
  } catch (error) {
    return handleApiError(error);
  }
}
