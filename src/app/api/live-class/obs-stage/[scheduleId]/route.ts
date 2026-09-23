import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { verifyBroadcastToken } from "@/lib/live-class/broadcast-token";

/**
 * Token-authenticated (NOT session-authenticated) read endpoint backing the
 * /obs-stage/[scheduleId] broadcast page — see broadcast-token.ts for why
 * this can't use the normal NextAuth session like every other whiteboard
 * route (OBS's Browser Source carries no cookies). Returns exactly what the
 * broadcast page needs to render: the board's current page and the
 * camera/theme layout preferences, polled every couple seconds rather than
 * pushed over Pusher (that channel is presence-based and needs a real
 * session to authorize) — a 1-2s lag composited into a recording/broadcast
 * is unnoticeable, unlike in the interactive student/teacher views.
 */
export async function GET(request: NextRequest, { params }: { params: { scheduleId: string } }) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    const payload = verifyBroadcastToken(token);
    if (!payload || payload.scheduleId !== params.scheduleId) {
      return apiError("Invalid or expired broadcast token.", 401);
    }

    const wbSession = await prisma.whiteboardSession.findUnique({
      where: { batchScheduleId: params.scheduleId },
      select: {
        id: true,
        title: true,
        status: true,
        livePhase: true,
        activePageNumber: true,
        classroomTheme: true,
        cameraShape: true,
        cameraPosition: true,
      },
    });
    if (!wbSession) return apiError("Class session not found.", 404);

    const page = await prisma.whiteboardPage.findUnique({
      where: { sessionId_pageNumber: { sessionId: wbSession.id, pageNumber: wbSession.activePageNumber } },
      select: { objects: true, background: true },
    });

    return apiSuccess({
      status: wbSession.status,
      livePhase: wbSession.livePhase,
      title: wbSession.title,
      classroomTheme: wbSession.classroomTheme,
      cameraShape: wbSession.cameraShape,
      cameraPosition: wbSession.cameraPosition,
      page: page ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
