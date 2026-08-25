import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/rbac/guard";

/**
 * The signed-in student's own XP/level/streak — powers the header chip
 * (streak flame + day count) and the profile screen. Ownership-scoped like
 * /api/doubts, not RBAC-gated; every value here reads straight off the
 * Student row, which awardXp() (src/lib/gamification/xp.ts) keeps in sync
 * with the XPEvent log — nothing here computes or estimates anything.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      select: { xp: true, level: true, currentStreakDays: true, longestStreakDays: true, lastActivityDate: true },
    });
    if (!student) return apiError("No student profile found for this account.", 404);

    return apiSuccess({ gamification: student });
  } catch (error) {
    return handleApiError(error);
  }
}
