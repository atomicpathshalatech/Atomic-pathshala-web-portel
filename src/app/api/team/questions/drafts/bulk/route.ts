import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_UPDATE);

    const body = await request.json();
    const { questionIds, action } = body;

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return apiError("questionIds array is required.", 400);
    }

    if (action === "SUBMIT_TO_REVIEW_1") {
      const result = await prisma.question.updateMany({
        where: { id: { in: questionIds } },
        data: {
          status: "REVIEW_1",
          review1Status: "PENDING",
        },
      });

      return apiSuccess({
        message: `Submitted ${result.count} questions to Stage 1 Review.`,
        count: result.count,
      });
    }

    if (action === "DELETE") {
      await requirePermission(session.user.id, PERMISSIONS.QUESTION_DELETE);
      const result = await prisma.question.deleteMany({
        where: { id: { in: questionIds } },
      });

      return apiSuccess({
        message: `Deleted ${result.count} questions.`,
        count: result.count,
      });
    }

    if (action === "PUBLISH") {
      await requirePermission(session.user.id, PERMISSIONS.QUESTION_VERIFY);
      const result = await prisma.question.updateMany({
        where: { id: { in: questionIds } },
        data: {
          status: "PUBLISHED",
          isPublished: true,
          publishedById: session.user.id,
          publishedAt: new Date(),
        },
      });

      return apiSuccess({
        message: `Published ${result.count} questions directly.`,
        count: result.count,
      });
    }

    return apiError("Invalid action specified.", 400);
  } catch (error) {
    return handleApiError(error);
  }
}
