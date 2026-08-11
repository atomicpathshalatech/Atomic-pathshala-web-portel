import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

const statusSchema = z.object({
  status: z.enum(["VERIFIED", "FLAGGED", "PENDING"]),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_VERIFY);

    const existing = await prisma.question.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Question not found", 404);

    const { status } = statusSchema.parse(await request.json());

    const question = await prisma.question.update({
      where: { id: params.id },
      data: {
        status,
        verifiedById: status === "PENDING" ? null : session.user.id,
        verifiedAt: status === "PENDING" ? null : new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: `QUESTION_${status}`,
        entityType: "Question",
        entityId: question.id,
      },
    });

    return apiSuccess({ question });
  } catch (error) {
    return handleApiError(error);
  }
}
