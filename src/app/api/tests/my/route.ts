import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/** A student's own published tests, across every batch they're actively
 * enrolled in — ownership-checked (their own enrollments), not RBAC, same
 * pattern as /api/batches/my. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return apiError("No student profile found for this account.", 404);

    const enrollments = await prisma.batchEnrollment.findMany({
      where: { studentId: student.id, status: "ACTIVE" },
      select: { batchId: true },
    });
    const batchIds = enrollments.map((e) => e.batchId);
    if (batchIds.length === 0) return apiSuccess({ tests: [] });

    const tests = await prisma.test.findMany({
      where: { status: "PUBLISHED", batchSchedule: { batchId: { in: batchIds } } },
      include: {
        batchSchedule: true,
        _count: { select: { questions: true } },
        attempts: { where: { studentId: student.id }, select: { status: true, score: true } },
      },
      orderBy: { batchSchedule: { startsAt: "asc" } },
    });

    return apiSuccess({
      tests: tests.map((t) => ({
        id: t.id,
        title: t.title,
        durationMin: t.durationMin,
        questionCount: t._count.questions,
        startsAt: t.batchSchedule.startsAt,
        endsAt: t.batchSchedule.endsAt,
        myAttempt: t.attempts[0] ?? null,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
