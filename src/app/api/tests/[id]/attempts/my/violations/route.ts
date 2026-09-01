import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveStudentForTest } from "@/lib/test-series/access";
import { attemptViolationSchema } from "@/lib/validation/test";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Records a proctoring violation (tab switch, forced fullscreen exit,
 * copy/paste, context-menu) reported by ExamRunner's client-side
 * detectors, and decrements the attempt's integrityScore server-side —
 * the client only ever *reports* a violation, it never sets the score
 * itself. Best-effort from the client's perspective (fire-and-forget,
 * exam flow never blocks on this call succeeding), but once it lands the
 * penalty is authoritative and persisted alongside the attempt. Works for
 * both batch-scheduled and standalone tests (see resolveStudentForTest).
 *
 * Fixed penalty per violation (5 points, floor 0) rather than a scaling/
 * escalating scheme — the source Test Portal spec didn't define a curve,
 * and a flat penalty is the safer default until product specifies one.
 */
const PENALTY_PER_VIOLATION = 5;

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const test = await prisma.test.findUnique({ where: { id: params.id } });
    if (!test) return apiError("Test not found", 404);
    if (!test.batchScheduleId && !test.testSeriesId) {
      return apiError("This test isn't linked to a scheduled session or a series.", 400);
    }

    const { student } = await resolveStudentForTest(session.user.id, test);
    if (!student) throw new ForbiddenError();

    const attempt = await prisma.attempt.findUnique({
      where: { testId_studentId: { testId: test.id, studentId: student.id } },
    });
    if (!attempt) return apiError("You haven't started this test yet.", 404);
    // Violations reported after the attempt is finalized are ignored —
    // scoring/integrity is locked once submitted, nothing left to penalize.
    if (attempt.status !== "IN_PROGRESS") return apiSuccess({ recorded: false });

    const { type } = attemptViolationSchema.parse(await request.json());

    const nextIntegrityScore = Math.max(0, attempt.integrityScore - PENALTY_PER_VIOLATION);

    const [violation] = await prisma.$transaction([
      prisma.attemptViolation.create({ data: { attemptId: attempt.id, type } }),
      prisma.attempt.update({ where: { id: attempt.id }, data: { integrityScore: nextIntegrityScore } }),
    ]);

    return apiSuccess({ recorded: true, violationId: violation.id, integrityScore: nextIntegrityScore }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
