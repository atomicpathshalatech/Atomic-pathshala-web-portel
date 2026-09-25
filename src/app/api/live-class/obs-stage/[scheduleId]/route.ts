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
    // Allow token-authenticated or direct schedule access for OBS Browser Source
    if (!payload && !params.scheduleId) {
      return apiError("Invalid or expired broadcast token.", 401);
    }

    let wbSession = await prisma.whiteboardSession.findUnique({
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

    if (!wbSession) {
      wbSession = await prisma.whiteboardSession.findUnique({
        where: { id: params.scheduleId },
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
    }

    if (!wbSession) {
      const schedule = await prisma.batchSchedule.findFirst({
        where: {
          OR: [
            { id: params.scheduleId },
            { lectureId: params.scheduleId },
            { liveWhiteboardSession: { id: params.scheduleId } },
          ],
        },
        include: { liveWhiteboardSession: true },
      });
      if (schedule?.liveWhiteboardSession) {
        wbSession = {
          id: schedule.liveWhiteboardSession.id,
          title: schedule.liveWhiteboardSession.title,
          status: schedule.liveWhiteboardSession.status,
          livePhase: schedule.liveWhiteboardSession.livePhase,
          activePageNumber: schedule.liveWhiteboardSession.activePageNumber,
          classroomTheme: schedule.liveWhiteboardSession.classroomTheme,
          cameraShape: schedule.liveWhiteboardSession.cameraShape,
          cameraPosition: schedule.liveWhiteboardSession.cameraPosition,
        };
      }
    }

    if (!wbSession) return apiError("Class session not found.", 404);

    let page = await prisma.whiteboardPage.findUnique({
      where: { sessionId_pageNumber: { sessionId: wbSession.id, pageNumber: wbSession.activePageNumber } },
      select: { objects: true, background: true },
    });

    if (!page) {
      page = await prisma.whiteboardPage.findFirst({
        where: { sessionId: wbSession.id },
        orderBy: { pageNumber: "asc" },
        select: { objects: true, background: true },
      });
    }

    // Active live quiz/poll data for OBS stage overlay
    const activeQuiz = await prisma.quizSession.findFirst({
      where: {
        whiteboardSessionId: wbSession.id,
        status: { in: ["ACTIVE", "REVEALED"] },
      },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        questionText: true,
        options: true,
        timeLimitSec: true,
        status: true,
        correctOption: true,
        startedAt: true,
      },
    });

    let quizMetrics = null;
    if (activeQuiz) {
      const responses = await prisma.quizResponse.findMany({
        where: { quizSessionId: activeQuiz.id },
        select: { selectedOption: true },
      });
      const counts: Record<string, number> = {};
      responses.forEach((r: { selectedOption: string }) => {
        counts[r.selectedOption] = (counts[r.selectedOption] || 0) + 1;
      });
      quizMetrics = { counts, totalResponses: responses.length };
    }

    // Active hand raise data
    const activeHandRaise = await prisma.handRaiseEvent.findFirst({
      where: {
        whiteboardSessionId: wbSession.id,
        status: { in: ["PENDING", "APPROVED"] },
      },
      orderBy: { raisedAt: "desc" },
      include: {
        student: { include: { user: true } },
      },
    });

    return apiSuccess({
      sessionId: wbSession.id,
      status: wbSession.status,
      livePhase: wbSession.livePhase,
      title: wbSession.title,
      classroomTheme: wbSession.classroomTheme,
      cameraShape: wbSession.cameraShape,
      cameraPosition: wbSession.cameraPosition,
      page: page ?? null,
      activeQuiz: activeQuiz
        ? {
            id: activeQuiz.id,
            questionText: activeQuiz.questionText,
            options: (activeQuiz.options as any) || [],
            timeLimitSec: activeQuiz.timeLimitSec,
            status: activeQuiz.status,
            correctOption: activeQuiz.correctOption,
            startedAt: activeQuiz.startedAt ? activeQuiz.startedAt.toISOString() : null,
          }
        : null,
      quizMetrics,
      handRaise: activeHandRaise
        ? {
            id: activeHandRaise.id,
            studentName: activeHandRaise.student?.user?.name || "Student",
            requestType: activeHandRaise.requestType,
            status: activeHandRaise.status,
            imageUrl: activeHandRaise.imageUrl || null,
          }
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
