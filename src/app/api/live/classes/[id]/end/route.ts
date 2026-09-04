import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { pusherServer, sessionChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    let liveClass = await prisma.liveClass.findUnique({
      where: { id: params.id },
    });

    if (!liveClass) {
      liveClass = await prisma.liveClass.findUnique({
        where: { batchScheduleId: params.id },
      });
    }

    if (!liveClass) return apiError("Live class not found", 404);

    const now = new Date();

    const updated = await prisma.liveClass.update({
      where: { id: liveClass.id },
      data: {
        status: "ENDED",
        actualEnd: now,
      },
    });

    if (liveClass.batchScheduleId) {
      await prisma.batchSchedule.update({
        where: { id: liveClass.batchScheduleId },
        data: { status: "COMPLETED" },
      }).catch(() => null);

      await prisma.whiteboardSession.update({
        where: { batchScheduleId: liveClass.batchScheduleId },
        data: { livePhase: "ENDED", status: "ENDED", endedAt: now, actualEndedAt: now },
      }).catch(() => null);

      try {
        await pusherServer.trigger(
          sessionChannel(liveClass.batchScheduleId),
          WB_EVENTS.SESSION_ENDED,
          { endedAt: now.toISOString() }
        );
      } catch (pushErr) {
        console.warn("[LiveClass] Realtime end broadcast warning:", pushErr);
      }
    }

    return apiSuccess({
      message: "Live class ended successfully.",
      liveClass: updated,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
