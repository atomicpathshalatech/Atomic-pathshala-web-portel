import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_UPDATE || PERMISSIONS.QUESTION_VERIFY);

    const question = await prisma.question.findUnique({
      where: { id: params.id },
      include: { translations: true },
    });
    if (!question) return apiError("Question not found", 404);

    const body = await request.json();
    const { stage, action, notes } = body;
    // stage: "SUBMIT_TO_REVIEW_1" | "REVIEW_1" | "REVIEW_2"
    // action: "APPROVE" | "REJECT" | "REQUEST_CHANGES"

    const now = new Date();

    if (stage === "SUBMIT_TO_REVIEW_1") {
      const updated = await prisma.question.update({
        where: { id: params.id },
        data: {
          status: "REVIEW_1",
          review1Status: "PENDING",
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "QUESTION_SUBMITTED_TO_REVIEW_1",
          entityType: "Question",
          entityId: params.id,
        },
      });

      return apiSuccess({ question: updated });
    }

    if (stage === "REVIEW_1") {
      if (action === "APPROVE") {
        const updated = await prisma.question.update({
          where: { id: params.id },
          data: {
            status: "REVIEW_2",
            review1Status: "APPROVED",
            review1ById: session.user.id,
            review1At: now,
            review1Notes: notes?.trim() || null,
            review2Status: "PENDING",
          },
        });

        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: "QUESTION_REVIEW_1_APPROVED",
            entityType: "Question",
            entityId: params.id,
          },
        });

        return apiSuccess({ question: updated });
      } else {
        const updated = await prisma.question.update({
          where: { id: params.id },
          data: {
            status: action === "REJECT" ? "REJECTED" : "DRAFT",
            review1Status: action === "REJECT" ? "REJECTED" : "CHANGES_REQUESTED",
            review1ById: session.user.id,
            review1At: now,
            review1Notes: notes?.trim() || null,
            isPublished: false,
          },
        });

        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: `QUESTION_REVIEW_1_${action}`,
            entityType: "Question",
            entityId: params.id,
            metadata: { notes },
          },
        });

        return apiSuccess({ question: updated });
      }
    }

    if (stage === "REVIEW_2") {
      if (action === "APPROVE") {
        // Enforce: Review 1 must already be approved
        if (question.review1Status !== "APPROVED") {
          return apiError("Cannot complete Review 2: Review 1 must be approved first.", 400);
        }

        const updated = await prisma.question.update({
          where: { id: params.id },
          data: {
            status: "PUBLISHED",
            review2Status: "APPROVED",
            review2ById: session.user.id,
            review2At: now,
            review2Notes: notes?.trim() || null,
            isPublished: true,
            publishedAt: now,
            publishedById: session.user.id,
          },
        });

        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: "QUESTION_REVIEW_2_APPROVED_PUBLISHED",
            entityType: "Question",
            entityId: params.id,
          },
        });

        return apiSuccess({ question: updated });
      } else {
        const updated = await prisma.question.update({
          where: { id: params.id },
          data: {
            status: action === "REJECT" ? "REJECTED" : "DRAFT",
            review2Status: action === "REJECT" ? "REJECTED" : "CHANGES_REQUESTED",
            review2ById: session.user.id,
            review2At: now,
            review2Notes: notes?.trim() || null,
            isPublished: false,
          },
        });

        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: `QUESTION_REVIEW_2_${action}`,
            entityType: "Question",
            entityId: params.id,
            metadata: { notes },
          },
        });

        return apiSuccess({ question: updated });
      }
    }

    return apiError("Invalid review stage or action", 400);
  } catch (error) {
    return handleApiError(error);
  }
}
