import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { rankTrendPointSchema } from "@/lib/validation/predictor";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { Prisma } from "@prisma/client";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.PREDICTOR_DATA_MANAGE);

    const points = await prisma.rankTrendPoint.findMany({
      orderBy: [{ year: "desc" }, { category: "asc" }, { marks: "desc" }],
      take: 500,
    });

    return apiSuccess({ points });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.PREDICTOR_DATA_MANAGE);

    const data = rankTrendPointSchema.parse(await request.json());

    try {
      const point = await prisma.rankTrendPoint.create({
        data: {
          category: data.category,
          marks: data.marks,
          expectedRank: data.expectedRank,
          year: data.year,
          confidence: data.confidence || null,
          source: data.source || null,
        },
      });
      return apiSuccess({ point }, 201);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        // (category, marks, year) already exists — update it instead of erroring,
        // so re-uploading a corrected reference sheet is idempotent.
        const point = await prisma.rankTrendPoint.update({
          where: { category_marks_year: { category: data.category, marks: data.marks, year: data.year } },
          data: {
            expectedRank: data.expectedRank,
            confidence: data.confidence || null,
            source: data.source || null,
          },
        });
        return apiSuccess({ point, updated: true });
      }
      throw err;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
