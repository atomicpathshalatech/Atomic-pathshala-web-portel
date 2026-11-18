import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { requireTeamUser } from "@/lib/pyq/api";
import { isSuperAdmin } from "@/lib/rbac/super-admin";

/**
 * POST /api/team/pyq/assignments/override
 * Super Admin override for question verification status with mandatory reason and audit log.
 */
export async function POST(request: NextRequest) {
  try {
    const sessionUser = await requireTeamUser(PERMISSIONS.QUESTION_APPROVE);
    const isSuperOrAdmin =
      sessionUser.role === "SUPER_ADMIN" ||
      sessionUser.role === "ADMIN" ||
      sessionUser.role === "FOUNDER" ||
      (await isSuperAdmin(sessionUser.id));
    if (!isSuperOrAdmin) {
      return apiError("Only Super Admin or Admin can override verification status", 403);
    }

    const body = await request.json();
    const { questionId, newStatus, reason } = body;

    if (!questionId || !newStatus) {
      return apiError("Question ID and new status are required", 400);
    }

    if (!reason || reason.trim().length < 5) {
      return apiError("A mandatory justification reason (at least 5 characters) is required for status override", 400);
    }

    const validStatuses = ["UNVERIFIED", "ASSIGNED", "IN_REVIEW", "NEEDS_CORRECTION", "VERIFIED"];
    if (!validStatuses.includes(newStatus)) {
      return apiError(`Invalid status: ${newStatus}. Must be one of: ${validStatuses.join(", ")}`, 400);
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: { id: true, pyqVerificationStatus: true },
    });

    if (!question) {
      return apiError("Question not found", 404);
    }

    const previousStatus = question.pyqVerificationStatus || "UNVERIFIED";

    await prisma.$transaction(async (tx) => {
      await tx.question.update({
        where: { id: questionId },
        data: {
          pyqVerificationStatus: newStatus,
          pyqVerifiedById: newStatus === "VERIFIED" ? sessionUser.id : null,
          pyqVerifiedAt: newStatus === "VERIFIED" ? new Date() : null,
        },
      });

      if (newStatus === "VERIFIED") {
        await tx.pyqOccurrence.updateMany({
          where: { questionId },
          data: {
            verificationStatus: "VERIFIED",
            verifiedById: sessionUser.id,
            verifiedAt: new Date(),
          },
        });
      }

      await tx.pyqReviewHistory.create({
        data: {
          questionId,
          reviewerId: sessionUser.id,
          action: "STATUS_OVERRIDDEN",
          comments: `Admin override: ${previousStatus} -> ${newStatus}. Reason: ${reason}`,
          previousData: { status: previousStatus },
          updatedData: { status: newStatus, reason, overriddenBy: sessionUser.name },
        },
      });
    });

    return apiSuccess({
      message: `Status successfully overridden to ${newStatus}`,
      previousStatus,
      newStatus,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
