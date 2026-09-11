import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

const schema = z.object({ isActive: z.boolean().optional(), isDefault: z.boolean().optional() });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const existing = await prisma.creativeBackground.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Background not found.", 404);

    const input = schema.parse(await req.json());
    if (input.isDefault) {
      await prisma.creativeBackground.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }
    const background = await prisma.creativeBackground.update({ where: { id: params.id }, data: input });
    return apiSuccess({ background });
  } catch (error) {
    return handleApiError(error);
  }
}
