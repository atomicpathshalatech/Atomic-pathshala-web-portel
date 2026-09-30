import { NextRequest } from "next/server";
import { addCounts, youtubeVoteCounts } from "@/lib/whiteboard/youtube-votes";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { looksLikeStageToken, verifyStageToken } from "@/lib/live-class/stage-session";

/**
 * Token-authenticated (NOT session-authenticated) read endpoint backing the
 * /obs-stage/[scheduleId] broadcast page — see stage-session.ts for why
 * this can't use the normal NextAuth session like every other whiteboard
 * route (OBS's Browser Source carries no cookies). Returns exactly what the
 * broadcast page needs to render: the board's current page and the
 * camera/theme layout preferences, polled every couple seconds rather than
 * pushed over Pusher (that channel is presence-based and needs a real
 * session to authorize) — a 1-2s lag composited into a recording/broadcast
 * is unnoticeable, unlike in the interactive student/teacher views.
 *
 * Everything returned here ends up in a YouTube video, so the payload is
 * deliberately minimal: no quiz answer before it is revealed, no student
 * names or doubt photos.
 */
export async function GET(request: NextRequest, { params }: { params: { scheduleId: string } }) {
  try {
    // DB-backed, revocable stage token bound to exactly this schedule and
    // its current live occurrence (src/lib/live-class/stage-session.ts). A
    // token for Class A never opens Class B; a token stops working when the
    // class ends. Malformed tokens are rejected without a database lookup.
    const token = request.nextUrl.searchParams.get("token");
    if (!looksLikeStageToken(token)) return apiError("Invalid or expired broadcast token.", 401);
    const stage = await verifyStageToken(token, params.scheduleId);
    if (!stage) return apiError("Invalid or expired broadcast token.", 401);

    const wbSession = await prisma.whiteboardSession.findUnique({
      where: { id: stage.whiteboardSessionId },
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

    // Read-only: an unauthenticated OBS poll must never create rows.
    const page = await prisma.whiteboardPage.findUnique({
      where: { sessionId_pageNumber: { sessionId: wbSession.id, pageNumber: wbSession.activePageNumber } },
      select: { objects: true, background: true },
    });

    let parsedObjects: any[] = [];
    if (page && page.objects) {
      if (Array.isArray(page.objects)) {
        parsedObjects = page.objects;
      } else if (typeof page.objects === "string") {
        try {
          parsedObjects = JSON.parse(page.objects);
        } catch {
          parsedObjects = [];
        }
      } else if (typeof page.objects === "object" && Array.isArray((page.objects as any).objects)) {
        parsedObjects = (page.objects as any).objects;
      }
    }

    // Active live quiz/poll data for OBS stage overlay
    const activeQuiz = await prisma.quizSession.findFirst({
      where: {
        whiteboardSessionId: wbSession.id,
        // A revealed poll is closed by the teacher's room ~2.5 s later; the
        // result stays in the video for 10 s so viewers can read it.
        OR: [
          { status: { in: ["ACTIVE", "REVEALED"] } },
          { status: "CLOSED", revealedAt: { gte: new Date(Date.now() - 10_000) } },
        ],
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
        revealedAt: true,
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
      // Plus answers typed in the YouTube chat.
      const youtube = await youtubeVoteCounts(activeQuiz.id);
      quizMetrics = { counts: addCounts(counts, youtube.counts), totalResponses: responses.length + youtube.total };
    }

    // Active hand raise — only whether one exists and its type; the student's
    // identity and any attached doubt photo stay out of the broadcast.
    const activeHandRaise = await prisma.handRaiseEvent.findFirst({
      where: {
        whiteboardSessionId: wbSession.id,
        status: { in: ["PENDING", "APPROVED"] },
      },
      orderBy: { raisedAt: "desc" },
      select: { id: true, requestType: true, status: true },
    });

    return apiSuccess({
      sessionId: wbSession.id,
      status: wbSession.status,
      livePhase: wbSession.livePhase,
      title: wbSession.title,
      classroomTheme: wbSession.classroomTheme,
      cameraShape: wbSession.cameraShape,
      cameraPosition: wbSession.cameraPosition,
      page: {
        objects: parsedObjects,
        background: page?.background ?? null,
      },
      activeQuiz: activeQuiz
        ? {
            id: activeQuiz.id,
            questionText: activeQuiz.questionText,
            options: (activeQuiz.options as any) || [],
            timeLimitSec: activeQuiz.timeLimitSec,
            status: activeQuiz.status === "CLOSED" ? "REVEALED" : activeQuiz.status,
            // The answer key only after the teacher reveals it — students
            // see it at that point anyway.
            correctOption: activeQuiz.revealedAt ? activeQuiz.correctOption : null,
            startedAt: activeQuiz.startedAt ? activeQuiz.startedAt.toISOString() : null,
          }
        : null,
      quizMetrics,
      handRaise: activeHandRaise
        ? {
            id: activeHandRaise.id,
            studentName: "A student",
            requestType: activeHandRaise.requestType,
            status: activeHandRaise.status,
          }
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
