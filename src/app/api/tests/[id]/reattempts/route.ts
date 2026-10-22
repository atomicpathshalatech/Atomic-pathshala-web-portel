import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { MAX_REATTEMPTS, reattemptAccess } from "@/lib/test-engine/reattempts";

/**
 * POST — start a practice re-attempt (Attempt 2, 3, …) of this test, or
 * return the one already in progress. Allowed once the first attempt is
 * submitted and results are out; at most MAX_REATTEMPTS.
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await reattemptAccess(session.user.id, params.id);
    if ("error" in access) return apiError(access.error ?? "Not allowed", access.status);
    const { test, student } = access;

    const existing = await prisma.testReattempt.findMany({
      where: { testId: test.id, studentId: student.id },
      orderBy: { attemptNumber: "asc" },
      select: { attemptNumber: true, status: true },
    });
    const open = existing.find((r) => r.status === "IN_PROGRESS");
    if (open) return apiSuccess({ attemptNumber: open.attemptNumber, resumed: true });
    if (existing.length >= MAX_REATTEMPTS) {
      return apiError(`You've used all ${MAX_REATTEMPTS} re-attempts for this test.`, 409);
    }

    const attemptNumber = (existing[existing.length - 1]?.attemptNumber ?? 1) + 1;
    try {
      await prisma.testReattempt.create({ data: { testId: test.id, studentId: student.id, attemptNumber } });
    } catch (err) {
      // Double tap: the other request created it.
      if ((err as { code?: string })?.code !== "P2002") throw err;
    }
    await prisma.auditLog
      .create({
        data: {
          userId: session.user.id,
          action: "TEST_REATTEMPT_STARTED",
          entityType: "Test",
          entityId: test.id,
          metadata: { attemptNumber },
        },
      })
      .catch(() => undefined);
    return apiSuccess({ attemptNumber, resumed: false }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
