import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  board: z.string().trim().optional().nullable(),
  messageText: z.string().trim().min(10).optional(),
  priority: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const input = patchSchema.parse(await req.json());
    const template = await prisma.birthdayTemplate.update({ where: { id: params.id }, data: input });
    return apiSuccess({ template });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const used = await prisma.birthdaySendLog.count({ where: { templateId: params.id } });
    if (used > 0) {
      await prisma.birthdayTemplate.update({ where: { id: params.id }, data: { isActive: false } });
      return apiSuccess({ archived: true, deleted: false });
    }

    const existing = await prisma.birthdayTemplate.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Not found.", 404);
    await prisma.birthdayTemplate.delete({ where: { id: params.id } });
    return apiSuccess({ archived: false, deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
