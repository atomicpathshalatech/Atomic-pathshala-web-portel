import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_READ);

    const { searchParams } = request.nextUrl;
    const source = searchParams.get("source")?.trim();
    const status = searchParams.get("status")?.trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (source && source !== "ALL") {
      where.sourceName = { equals: source, mode: "insensitive" };
    }
    if (status && status !== "ALL") {
      where.status = status;
    }

    const [jobs, total] = await Promise.all([
      prisma.extractionJob.findMany({
        where,
        include: {
          createdBy: { select: { name: true, email: true } },
          _count: {
            select: { questions: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.extractionJob.count({ where }),
    ]);

    // Global Stats
    const [totalJobs, totalVerified, totalReview, totalDraft] = await Promise.all([
      prisma.extractionJob.count(),
      prisma.extractedQuestion.count({ where: { status: "VERIFIED" } }),
      prisma.extractedQuestion.count({ where: { status: "REVIEW_REQUIRED" } }),
      prisma.extractedQuestion.count({ where: { status: "IMPORTED" } }),
    ]);

    return apiSuccess({
      jobs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalJobs,
        totalVerified,
        totalReview,
        totalDraft,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
