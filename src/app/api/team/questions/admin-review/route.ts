import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const canReview =
      (await hasPermission(session.user.id, PERMISSIONS.QUESTION_VERIFY)) ||
      (await hasPermission(session.user.id, PERMISSIONS.QUESTION_APPROVE)) ||
      session.user.role === "ADMIN" ||
      session.user.role === "SUPER_ADMIN" ||
      session.user.role === "ACADEMIC_HEAD";

    if (!canReview) {
      return apiError("Forbidden — Admin or Question Verifier permission required.", 403);
    }

    const body = await request.json();
    const { questionId, questionIds, action, notes } = body;

    const targetIds = Array.isArray(questionIds) && questionIds.length > 0
      ? questionIds
      : questionId
      ? [questionId]
      : [];

    if (targetIds.length === 0) {
      return apiError("No question ID(s) provided.", 400);
    }

    if (action === "APPROVE" || action === "SIGN_OFF") {
      const res = await prisma.question.updateMany({
        where: { id: { in: targetIds } },
        data: {
          correctionStatus: "APPROVED",
          status: "PUBLISHED",
          isPublished: true,
          publishedById: session.user.id,
          publishedAt: new Date(),
          correctionNotes: notes || "Approved by Admin",
        },
      });

      return apiSuccess({
        message: `Successfully approved & signed-off ${res.count} question(s). Now live and published.`,
        count: res.count,
        action: "APPROVED",
      });
    }

    if (action === "REWORK" || action === "SEND_BACK") {
      const res = await prisma.question.updateMany({
        where: { id: { in: targetIds } },
        data: {
          correctionStatus: "REWORK",
          status: "DRAFT",
          correctionNotes: notes || "Correction rejected. Rework requested by Admin.",
        },
      });

      return apiSuccess({
        message: `Sent back ${res.count} question(s) for rework with feedback comments.`,
        count: res.count,
        action: "REWORK",
      });
    }

    return apiError("Invalid action. Must be 'APPROVE' or 'REWORK'.", 400);
  } catch (error) {
    console.error("[AdminReviewAPI] Error:", error);
    return apiError(error instanceof Error ? error.message : "Admin review action failed.", 500);
  }
}
