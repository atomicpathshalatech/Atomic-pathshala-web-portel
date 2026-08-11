import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

const patchSchema = z.object({
  isActive: z.boolean().optional(),
  deductionValue: z.coerce.number().positive().optional(),
  description: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.PENALTY_RULE_MANAGE);

    const input = patchSchema.parse(await request.json());
    const existing = await prisma.penaltyRule.findUnique({ where: { id } });
    if (!existing) return apiError("Rule not found.", 404);

    const rule = await prisma.penaltyRule.update({ where: { id }, data: input });
    return apiSuccess({ rule });
  } catch (error) {
    return handleApiError(error);
  }
}
