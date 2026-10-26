import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

const overrideSchema = z.object({
  auditId: z.string().min(1),
  overrideStatus: z.enum([
    "APPROVED_AFTER_VERIFICATION",
    "APPROVED_BY_FACULTY",
    "REJECTED_BY_FACULTY",
    "MANUAL_REVIEW_REQUIRED",
  ]),
  overrideReason: z.string().trim().min(5, "Override reason must be at least 5 characters long and state the academic justification."),
  finalAnswerKey: z.array(z.string()).optional(),
  finalStatement: z.string().optional(),
  finalSolution: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_APPROVE);
    const userId = session.user.id;

    const body = overrideSchema.parse(await req.json());

    const existing = await prisma.questionReviewAudit.findUnique({
      where: { id: body.auditId },
    });

    if (!existing) {
      return handleApiError(new Error("Audit record not found"), 404);
    }

    // Merge override updates
    const currentDecision = (existing.finalDecision as any) || {};
    const updatedDecision = {
      ...currentDecision,
      ...(body.finalStatement && { finalQuestion: body.finalStatement }),
      ...(body.finalAnswerKey && { finalAnswerKey: body.finalAnswerKey }),
      ...(body.finalSolution && { finalSolution: body.finalSolution }),
      facultyOverride: {
        overriddenBy: userId,
        status: body.overrideStatus,
        reason: body.overrideReason,
        overriddenAt: new Date().toISOString(),
      },
    };

    const updated = await prisma.questionReviewAudit.update({
      where: { id: body.auditId },
      data: {
        isOverridden: true,
        overrideStatus: body.overrideStatus,
        overrideReason: body.overrideReason,
        overriddenById: userId,
        overriddenAt: new Date(),
        finalDecision: updatedDecision,
        finalStatus: body.overrideStatus,
      },
      include: {
        overriddenBy: { select: { name: true, email: true } },
      },
    });

    return apiSuccess(updated);
  } catch (err: any) {
    return handleApiError(err);
  }
}
