import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { resolveStudentForSeries } from "@/lib/test-series/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/** A student's own published tests — both batch-scheduled class tests
 * (their own active enrollments) and standalone TestSeries tests they're
 * eligible for (see resolveStudentForSeries — PUBLIC series, or a PRIVATE
 * series whose targetBatch/className/course matches the student). */
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

    const [batchTests, standaloneTests] = await Promise.all([
      batchIds.length === 0
        ? []
        : prisma.test.findMany({
            where: { status: "PUBLISHED", batchSchedule: { batchId: { in: batchIds } } },
            include: {
              batchSchedule: true,
              sections: { select: { name: true, subject: true, targetCount: true, _count: { select: { questions: true } } } },
              attempts: { where: { studentId: student.id }, select: { status: true, score: true } },
            },
            orderBy: { batchSchedule: { startsAt: "asc" } },
          }),
      prisma.test.findMany({
        where: { status: "PUBLISHED", testSeriesId: { not: null }, batchScheduleId: null },
        include: {
          testSeries: true,
          sections: { select: { name: true, subject: true, targetCount: true, _count: { select: { questions: true } } } },
          attempts: { where: { studentId: student.id }, select: { status: true, score: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const eligibleStandalone: typeof standaloneTests = [];
    for (const t of standaloneTests) {
      if (!t.testSeriesId) continue;
      const { student: eligible } = await resolveStudentForSeries(session.user.id, t.testSeriesId);
      if (eligible) eligibleStandalone.push(t);
    }

    const calcTotalQuestions = (sections: Array<{ name: string; subject: string | null; targetCount: number | null; _count: { questions: number } }>) => {
      return sections.reduce((sum, s) => {
        const isBio = s.name?.toLowerCase().includes("bio") || s.subject?.toLowerCase().includes("bio") || s.name?.toLowerCase().includes("botany") || s.name?.toLowerCase().includes("zoology");
        const target = s.targetCount && s.targetCount > 0 ? s.targetCount : isBio ? 90 : 45;
        return sum + Math.min(s._count.questions, target);
      }, 0);
    };

    return apiSuccess({
      tests: [
        ...batchTests
          .filter((t) => t.batchSchedule)
          .map((t) => ({
            id: t.id,
            title: t.name,
            kind: "SCHEDULED" as const,
            durationMin: t.durationMin,
            questionCount: calcTotalQuestions(t.sections),
            startsAt: t.batchSchedule!.startsAt,
            endsAt: t.batchSchedule!.endsAt,
            myAttempt: t.attempts[0] ?? null,
          })),
        ...eligibleStandalone.map((t) => ({
          id: t.id,
          title: t.name,
          kind: "STANDALONE" as const,
          durationMin: t.durationMin,
          questionCount: calcTotalQuestions(t.sections),
          seriesName: t.testSeries?.name ?? null,
          startsAt: null,
          endsAt: null,
          myAttempt: t.attempts[0] ?? null,
        })),
      ],
    });
  } catch (error) {
    return handleApiError(error);
  }
}
