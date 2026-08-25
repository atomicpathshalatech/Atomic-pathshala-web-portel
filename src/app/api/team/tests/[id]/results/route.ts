import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { canManageTest, getTestOr404 } from "@/lib/test-engine/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/** Ranked results for a test — submitted/auto-submitted attempts only,
 * highest score first. Plain ranked table, not a gamified leaderboard (no
 * points/badges/streaks) — just the marks, same spirit as the rest of this
 * codebase's honest-data policy. */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_READ);

    const test = await getTestOr404(params.id);
    if (!test) return apiError("Test not found", 404);
    if (!(await canManageTest(session.user.id, test.batchScheduleId))) throw new ForbiddenError();

    const schedule = await prisma.batchSchedule.findUnique({ where: { id: test.batchScheduleId } });
    const [attempts, totalEnrolled, questionCount] = await Promise.all([
      prisma.testAttempt.findMany({
        where: { testId: params.id, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
        include: { student: { include: { user: true } } },
        orderBy: [{ score: "desc" }, { submittedAt: "asc" }],
      }),
      schedule
        ? prisma.batchEnrollment.count({ where: { batchId: schedule.batchId, status: "ACTIVE" } })
        : Promise.resolve(0),
      prisma.testQuestion.count({ where: { testId: params.id } }),
    ]);

    return apiSuccess({
      attempts: attempts.map((a, i) => ({
        rank: i + 1,
        studentId: a.studentId,
        studentName: a.student.user.name,
        enrollmentNumber: a.student.enrollmentNumber,
        score: a.score,
        correctCount: a.correctCount,
        incorrectCount: a.incorrectCount,
        unattemptedCount: a.unattemptedCount,
        status: a.status,
        submittedAt: a.submittedAt,
      })),
      attemptedCount: attempts.length,
      totalEnrolled,
      questionCount,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
