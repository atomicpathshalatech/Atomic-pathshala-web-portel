import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveStudentForTest } from "@/lib/test-series/access";
import { getPrivacySafeLeaderboard } from "@/lib/test-engine/analysis-engine";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const test = await prisma.test.findUnique({
      where: { id: params.id },
      include: { batchSchedule: true },
    });
    if (!test) return apiError("Test not found", 404);

    const { student } = await resolveStudentForTest(session.user.id, test);
    if (!student) throw new ForbiddenError();

    const leaderboardData = await getPrivacySafeLeaderboard(test.id, student.id);
    return apiSuccess(leaderboardData);
  } catch (error) {
    return handleApiError(error);
  }
}
