import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { canManageTest, getTestOr404 } from "@/lib/test-engine/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_UPDATE);

    const test = await getTestOr404(params.id);
    if (!test) return apiError("Test not found", 404);
    if (!(await canManageTest(session.user.id, test.batchScheduleId))) throw new ForbiddenError();

    const body = await request.json();
    const { action, questionAuditId, reportId, reason, overridePublish } = body;

    if (overridePublish) {
      if (!reason || reason.trim().length < 5) {
        return apiError("A mandatory justification reason is required to override publish lock.", 400);
      }

      await prisma.$transaction(async (tx) => {
        await tx.testAuditLog.create({
          data: {
            testId: params.id,
            reportId: reportId || null,
            userId: session.user.id,
            action: "PUBLISH_OVERRIDDEN",
            severity: "CRITICAL_OVERRIDE",
            reason: reason.trim(),
            metadata: { overriddenAt: new Date().toISOString(), adminUser: session.user.email },
          },
        });

        await tx.test.update({
          where: { id: params.id },
          data: { auditStatus: "OVERRIDDEN_APPROVED" },
        });
      });

      return apiSuccess({ success: true, message: "Publish lock successfully overridden with audit log." });
    }

    if (!questionAuditId) {
      return apiError("questionAuditId is required for question-level actions.", 400);
    }

    const qa = await prisma.testQuestionAudit.findUnique({
      where: { id: questionAuditId },
    });

    if (!qa) {
      return apiError("Question audit record not found.", 404);
    }

    if (action === "MARK_VERIFIED") {
      await prisma.$transaction(async (tx) => {
        await tx.testQuestionAudit.update({
          where: { id: questionAuditId },
          data: {
            status: "VERIFIED",
            verifiedBy: session.user.id,
            verifiedAt: new Date(),
            adminActionNotes: reason?.trim() || "Manually reviewed and verified by admin.",
          },
        });

        await tx.testAuditLog.create({
          data: {
            testId: params.id,
            reportId: qa.reportId,
            questionId: qa.questionId,
            userId: session.user.id,
            action: "QUESTION_VERIFIED",
            severity: "INFO",
            reason: reason?.trim() || "Question verified by academic admin.",
          },
        });
      });

      return apiSuccess({ success: true, status: "VERIFIED" });
    }

    if (action === "IGNORE_ISSUE") {
      if (!reason || reason.trim().length < 3) {
        return apiError("Please provide a reason for ignoring this issue.", 400);
      }

      await prisma.$transaction(async (tx) => {
        await tx.testQuestionAudit.update({
          where: { id: questionAuditId },
          data: {
            status: "IGNORED",
            verifiedBy: session.user.id,
            verifiedAt: new Date(),
            adminActionNotes: `Ignored: ${reason.trim()}`,
          },
        });

        await tx.testAuditLog.create({
          data: {
            testId: params.id,
            reportId: qa.reportId,
            questionId: qa.questionId,
            userId: session.user.id,
            action: "QUESTION_IGNORED",
            severity: "LOW",
            reason: reason.trim(),
          },
        });
      });

      return apiSuccess({ success: true, status: "IGNORED" });
    }

    return apiError("Invalid audit action specified.", 400);
  } catch (error) {
    return handleApiError(error);
  }
}
