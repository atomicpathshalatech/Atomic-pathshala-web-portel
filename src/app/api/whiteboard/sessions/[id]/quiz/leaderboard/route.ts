import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export interface StudentLeaderboardEntry {
  studentId: string;
  name: string;
  photoUrl: string | null;
  totalAttempted: number;
  correctCount: number;
  accuracyPct: number;
  avgResponseTimeMs: number;
  rank: number;
}

/**
 * GET /api/whiteboard/sessions/[id]/quiz/leaderboard
 * Query Params: ?scope=session (default) | chapter
 * Returns real-time ranked student leaderboard for either the current live session
 * or the entire chapter progression (Batch + Chapter + Lecture + Poll relation).
 * Ranking formula: Accuracy % primary -> Correct Count -> Avg Response Time (ms) tie-breaker.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access) throw new ForbiddenError();

    const searchParams = request.nextUrl.searchParams;
    const scope = searchParams.get("scope") === "chapter" ? "chapter" : "session";

    const wbSession = await prisma.whiteboardSession.findUnique({
      where: { id: params.id },
      include: {
        batchSchedule: {
          select: {
            id: true,
            batchId: true,
            chapterId: true,
            lectureId: true,
          },
        },
      },
    });

    if (!wbSession) return apiError("Whiteboard session not found", 404);

    let sessionIds: string[] = [params.id];

    if (scope === "chapter" && wbSession.batchSchedule?.chapterId) {
      const chapterSchedules = await prisma.batchSchedule.findMany({
        where: {
          chapterId: wbSession.batchSchedule.chapterId,
          batchId: wbSession.batchSchedule.batchId,
        },
        select: {
          liveWhiteboardSession: {
            select: { id: true },
          },
        },
      });

      const ids = chapterSchedules
        .map((s) => s.liveWhiteboardSession?.id)
        .filter((id): id is string => Boolean(id));

      if (ids.length > 0) {
        sessionIds = Array.from(new Set([...sessionIds, ...ids]));
      }
    }

    const quizzes = await prisma.quizSession.findMany({
      where: {
        whiteboardSessionId: { in: sessionIds },
      },
      include: {
        responses: {
          include: {
            student: {
              include: {
                user: {
                  select: {
                    name: true,
                    photoUrl: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { startedAt: "asc" },
    });

    const studentMap: Record<
      string,
      {
        studentId: string;
        name: string;
        photoUrl: string | null;
        totalAttempted: number;
        correctCount: number;
        totalResponseTimeMs: number;
      }
    > = {};

    for (const quiz of quizzes) {
      for (const resp of quiz.responses) {
        const studentId = resp.studentId;
        const studentName = resp.student.user?.name || `Student ${resp.student.studentIdCode || ""}`.trim() || "Student";
        const photoUrl = resp.student.user?.photoUrl || null;

        if (!studentMap[studentId]) {
          studentMap[studentId] = {
            studentId,
            name: studentName,
            photoUrl,
            totalAttempted: 0,
            correctCount: 0,
            totalResponseTimeMs: 0,
          };
        }

        const entry = studentMap[studentId];
        entry.totalAttempted += 1;
        entry.totalResponseTimeMs += Math.max(0, resp.responseTimeMs || 0);

        const isCorrect =
          resp.isCorrect === true ||
          (Boolean(quiz.correctOption) && resp.selectedOption === quiz.correctOption);

        if (isCorrect) {
          entry.correctCount += 1;
        }
      }
    }

    const studentList = Object.values(studentMap).map((s) => {
      const accuracyPct = s.totalAttempted > 0 ? Math.round((s.correctCount / s.totalAttempted) * 100) : 0;
      const avgResponseTimeMs = s.totalAttempted > 0 ? Math.round(s.totalResponseTimeMs / s.totalAttempted) : 0;
      return {
        studentId: s.studentId,
        name: s.name,
        photoUrl: s.photoUrl,
        totalAttempted: s.totalAttempted,
        correctCount: s.correctCount,
        accuracyPct,
        avgResponseTimeMs,
        rank: 0,
      };
    });

    // Ranking algorithm:
    // 1. Accuracy % (Descending)
    // 2. Correct count (Descending)
    // 3. Average response time (Ascending, faster response wins)
    // 4. Total attempted (Descending)
    studentList.sort((a, b) => {
      if (b.accuracyPct !== a.accuracyPct) return b.accuracyPct - a.accuracyPct;
      if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
      if (a.avgResponseTimeMs !== b.avgResponseTimeMs) return a.avgResponseTimeMs - b.avgResponseTimeMs;
      return b.totalAttempted - a.totalAttempted;
    });

    const rankings: StudentLeaderboardEntry[] = studentList.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

    const totalParticipants = rankings.length;
    const totalPolls = quizzes.length;
    const averageAccuracy =
      totalParticipants > 0
        ? Math.round(rankings.reduce((sum, r) => sum + r.accuracyPct, 0) / totalParticipants)
        : 0;

    return apiSuccess({
      scope,
      stats: {
        totalParticipants,
        totalPolls,
        averageAccuracy,
      },
      rankings,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
