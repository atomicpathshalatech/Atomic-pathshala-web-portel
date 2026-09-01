import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Predicts colleges/courses a given rank + category could plausibly get,
 * by finding past CollegeAllotment rows for that candidateCategory whose
 * closing `rank` is >= the given rank (i.e. the given rank would have
 * been good enough for that seat in that historical round). This is a
 * simple historical-cutoff lookup, not a live counselling simulation —
 * multi-round dynamics (upgrades, withdrawals) aren't modeled. Empty
 * result (no rows yet) is valid, pending Phase C data migration.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const { searchParams } = new URL(request.url);
    const rank = Number(searchParams.get("rank"));
    const category = searchParams.get("category")?.trim();
    const course = searchParams.get("course")?.trim();
    const year = searchParams.get("year");
    if (!category) return apiError("category is required", 400);
    if (!Number.isFinite(rank) || rank < 1) return apiError("rank must be a positive number", 400);

    const latestYearRow = await prisma.collegeAllotment.findFirst({
      orderBy: { year: "desc" },
      select: { year: true },
    });
    if (!latestYearRow) return apiSuccess({ available: false, allotments: [] });

    const targetYear = year ? Number(year) : latestYearRow.year;

    const allotments = await prisma.collegeAllotment.findMany({
      where: {
        year: targetYear,
        candidateCategory: category,
        rank: { gte: rank },
        ...(course ? { course: { contains: course, mode: "insensitive" as const } } : {}),
      },
      orderBy: { rank: "asc" },
      take: 100,
    });

    return apiSuccess({ available: true, year: targetYear, allotments });
  } catch (error) {
    return handleApiError(error);
  }
}
