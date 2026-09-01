import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { collegeAllotmentSchema } from "@/lib/validation/predictor";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.PREDICTOR_DATA_MANAGE);

    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");

    const allotments = await prisma.collegeAllotment.findMany({
      where: year ? { year: Number(year) } : {},
      orderBy: [{ year: "desc" }, { rank: "asc" }],
      take: 500,
    });

    return apiSuccess({ allotments });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.PREDICTOR_DATA_MANAGE);

    const data = collegeAllotmentSchema.parse(await request.json());

    const allotment = await prisma.collegeAllotment.create({
      data: {
        year: data.year,
        round: data.round,
        rank: data.rank,
        quota: data.quota,
        instituteName: data.instituteName,
        course: data.course,
        allottedCategory: data.allottedCategory,
        candidateCategory: data.candidateCategory,
        remarks: data.remarks || null,
      },
    });

    return apiSuccess({ allotment }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
