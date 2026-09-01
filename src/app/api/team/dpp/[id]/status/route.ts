import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

const statusSchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED"]),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.DPP_PUBLISH);

    const existing = await prisma.dpp.findUnique({
      where: { id: params.id },
      include: { _count: { select: { questions: true } } },
    });
    if (!existing) return apiError("DPP not found", 404);

    const { status } = statusSchema.parse(await request.json());

    if (status === "PUBLISHED" && existing._count.questions === 0) {
      return apiError("Add at least one question before publishing this DPP.", 422);
    }

    const dpp = await prisma.dpp.update({ where: { id: params.id }, data: { status } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: status === "PUBLISHED" ? "DPP_PUBLISHED" : "DPP_UNPUBLISHED",
        entityType: "Dpp",
        entityId: dpp.id,
      },
    });

    return apiSuccess({ dpp });
  } catch (error) {
    return handleApiError(error);
  }
}
