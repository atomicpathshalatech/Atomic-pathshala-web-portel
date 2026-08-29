import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveStudentForSchedule } from "@/lib/batch/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/** Starts (or resumes) the calling student's attempt at a published test.
 * One attempt per student per test — enforced by the DB's unique
 * (testId, studentId) constraint, not just app logic. */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const test = await prisma.test.findUnique({
      where: { id: params.id },
      include: { batchSchedule: true },
    });
    if (!test) return apiError("Test not found", 404);
    if (!test.batchScheduleId || !test.batchSchedule) {
      return apiError("This test isn't linked to a scheduled session.", 400);
    }
    if (test.status !== "PUBLISHED") return apiError("This test isn't open yet.", 409);

    const { student } = await resolveStudentForSchedule(session.user.id, test.batchScheduleId);
    if (!student) throw new ForbiddenError("You are not enrolled in this batch.");

    const now = new Date();
    if (now < test.batchSchedule.startsAt) {
      return apiError("This test hasn't opened yet.", 409);
    }
    if (now > test.batchSchedule.endsAt) {
      return apiError("This test's window has closed.", 409);
    }

    const existing = await prisma.attempt.findUnique({
      where: { testId_studentId: { testId: test.id, studentId: student.id } },
    });
    if (existing) {
      if (existing.status !== "IN_PROGRESS") {
        return apiError("You have already submitted this test.", 409);
      }
      return apiSuccess({ attempt: existing, resumed: true });
    }

    const attempt = await prisma.attempt.create({
      data: { testId: test.id, studentId: student.id },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TEST_ATTEMPT_STARTED",
        entityType: "Test",
        entityId: test.id,
        metadata: { attemptId: attempt.id },
      },
    });

    return apiSuccess({ attempt, resumed: false }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
