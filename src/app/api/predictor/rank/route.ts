import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Predicts an expected AIR range from marks + category, using the nearest
 * RankTrendPoint rows on either side of the given marks (same category,
 * most recent year with any data). Pure nearest-neighbor lookup against
 * reference data — not a statistical model — so accuracy is only as good
 * as the seeded RankTrendPoint rows. Empty result (no rows yet, pending
 * Phase C data migration) is a valid response, not an error, so the UI
 * can show its own "no reference data yet" state.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const { searchParams } = new URL(request.url);
    const marks = Number(searchParams.get("marks"));
    const category = searchParams.get("category")?.trim();
    if (!category) return apiError("category is required", 400);
    if (!Number.isFinite(marks)) return apiError("marks must be a number", 400);

    const latestYearRow = await prisma.rankTrendPoint.findFirst({
      where: { category },
      orderBy: { year: "desc" },
      select: { year: true },
    });
    if (!latestYearRow) return apiSuccess({ available: false, points: [] });

    const [below, above, exact] = await Promise.all([
      prisma.rankTrendPoint.findMany({
        where: { category, year: latestYearRow.year, marks: { lte: marks } },
        orderBy: { marks: "desc" },
        take: 3,
      }),
      prisma.rankTrendPoint.findMany({
        where: { category, year: latestYearRow.year, marks: { gt: marks } },
        orderBy: { marks: "asc" },
        take: 3,
      }),
      prisma.rankTrendPoint.findFirst({
        where: { category, year: latestYearRow.year, marks },
      }),
    ]);

    return apiSuccess({
      available: true,
      year: latestYearRow.year,
      exactMatch: exact,
      nearest: [...below, ...above].sort((a, b) => Math.abs(a.marks - marks) - Math.abs(b.marks - marks)),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
