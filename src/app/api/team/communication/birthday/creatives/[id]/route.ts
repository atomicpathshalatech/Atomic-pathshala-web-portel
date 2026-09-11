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

const patchSchema = z.object({ isActive: z.boolean().optional(), name: z.string().trim().min(2).max(120).optional() });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const input = patchSchema.parse(await req.json());
    const creative = await prisma.birthdayCreative.update({ where: { id: params.id }, data: input });
    return apiSuccess({ creative });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE — only when nothing references it (a creative already used in a past send stays for audit history; deactivate instead). */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const used = await prisma.birthdaySendLog.count({ where: { creativeId: params.id } });
    if (used > 0) {
      await prisma.birthdayCreative.update({ where: { id: params.id }, data: { isActive: false } });
      return apiSuccess({ archived: true, deleted: false });
    }

    const existing = await prisma.birthdayCreative.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Not found.", 404);
    await prisma.birthdayCreative.delete({ where: { id: params.id } });
    return apiSuccess({ archived: false, deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
