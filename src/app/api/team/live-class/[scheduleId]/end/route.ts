import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { endWhiteboardSession } from "@/lib/whiteboard/lifecycle";

export async function POST(
  _request: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);

    const schedule = await prisma.batchSchedule.findUnique({
      where: { id: params.scheduleId },
      include: { liveWhiteboardSession: true },
    });

    if (!schedule) return apiError("Scheduled class not found", 404);

    const wbSession = schedule.liveWhiteboardSession;
    if (!wbSession) return apiError("Whiteboard session not found", 404);

    const ended = await endWhiteboardSession(wbSession.id, {
      endedByUserId: session.user.id,
      reason: "manual",
    });

    return apiSuccess({
      message: "Class ended successfully.",
      whiteboardSession: ended,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

