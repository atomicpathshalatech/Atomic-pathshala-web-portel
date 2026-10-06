import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const body = await req.json();
    const { questionId, questionIds, stage, status, notes } = body;

    // stage: "REVIEW_1" | "REVIEW_2" | "PUBLISH" | "REJECT"
    // status: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED" | "PENDING"

    const targetIds = Array.isArray(questionIds) ? questionIds : questionId ? [questionId] : [];
    if (targetIds.length === 0) {
      return apiError("At least one question ID is required", 400);
    }

    if (stage === "REVIEW_1") {
      await requirePermission(session.user.id, PERMISSIONS.QUESTION_REVIEW_1);

      await prisma.question.updateMany({
        where: { id: { in: targetIds } },
        data: {
          review1Status: status,
          review1ById: session.user.id,
          review1At: new Date(),
          review1Notes: notes || null,
          status: status === "APPROVED" ? "REVIEW_2" : status === "REJECTED" ? "REJECTED" : "DRAFT",
        },
      });
    } else if (stage === "REVIEW_2") {
      await requirePermission(session.user.id, PERMISSIONS.QUESTION_REVIEW_2);

      const isApproveFinal = status === "APPROVED";

      await prisma.question.updateMany({
        where: { id: { in: targetIds } },
        data: {
          review2Status: status,
          review2ById: session.user.id,
          review2At: new Date(),
          review2Notes: notes || null,
          status: isApproveFinal ? "PUBLISHED" : status === "REJECTED" ? "REJECTED" : "REVIEW_1",
          isPublished: isApproveFinal,
          ...(isApproveFinal && {
            publishedAt: new Date(),
            publishedById: session.user.id,
          }),
        },
      });
    } else if (stage === "PUBLISH") {
      await requirePermission(session.user.id, PERMISSIONS.QUESTION_APPROVE);

      await prisma.question.updateMany({
        where: { id: { in: targetIds } },
        data: {
          status: "PUBLISHED",
          isPublished: true,
          publishedAt: new Date(),
          publishedById: session.user.id,
        },
      });
    } else if (stage === "REJECT") {
      await requirePermission(session.user.id, PERMISSIONS.QUESTION_REJECT);

      await prisma.question.updateMany({
        where: { id: { in: targetIds } },
        data: {
          status: "REJECTED",
          isPublished: false,
        },
      });
    } else {
      return apiError("Invalid review stage specified", 400);
    }

    return apiSuccess({
      success: true,
      updatedCount: targetIds.length,
      message: `Updated review status for ${targetIds.length} question(s)`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
