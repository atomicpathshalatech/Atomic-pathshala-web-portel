import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, ForbiddenError, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { questionReportUpdateSchema } from "@/lib/validation/question-report";

/**
 * Claim-to-edit-lock + resolve/reject for a single report, gated on
 * QUESTION_VERIFY (the same permission that already gates question
 * review decisions elsewhere) rather than a new report-specific code.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_VERIFY);

    const report = await prisma.questionReport.findUnique({ where: { id: params.id } });
    if (!report) return apiError("Report not found", 404);

    const { action, teacherNotes, priority } = questionReportUpdateSchema.parse(
      await request.json()
    );

    if (action === "CLAIM") {
      if (report.claimedById && report.claimedById !== session.user.id) {
        return apiError("This report is already claimed by another teacher.", 409);
      }
      const updated = await prisma.questionReport.update({
        where: { id: report.id },
        data: {
          claimedById: session.user.id,
          claimedAt: new Date(),
          status: "CLAIMED",
          ...(priority ? { priority } : {}),
        },
      });
      return apiSuccess({ report: updated });
    }

    // Every action below requires holding the claim — same one-teacher-
    // at-a-time lock the claim step establishes.
    if (report.claimedById !== session.user.id) {
      throw new ForbiddenError("Claim this report before updating it.");
    }

    if (action === "UNCLAIM") {
      const updated = await prisma.questionReport.update({
        where: { id: report.id },
        data: { claimedById: null, claimedAt: null, status: "NEW" },
      });
      return apiSuccess({ report: updated });
    }

    if (action === "RESOLVE" || action === "REJECT") {
      const updated = await prisma.questionReport.update({
        where: { id: report.id },
        data: {
          status: action === "RESOLVE" ? "RESOLVED" : "REJECTED",
          resolvedAt: new Date(),
          ...(teacherNotes !== undefined ? { teacherNotes } : {}),
          ...(priority ? { priority } : {}),
        },
      });
      return apiSuccess({ report: updated });
    }

    // NOTE — just record progress notes without changing status.
    const updated = await prisma.questionReport.update({
      where: { id: report.id },
      data: {
        ...(teacherNotes !== undefined ? { teacherNotes } : {}),
        ...(priority ? { priority } : {}),
      },
    });
    return apiSuccess({ report: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
