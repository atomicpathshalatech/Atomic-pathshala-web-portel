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
  title: z.string().trim().min(2).max(150).optional(),
  content: z.string().trim().min(2).optional(),
  imageUrl: z.string().trim().optional().nullable(),
  ctaLabel: z.string().trim().optional().nullable(),
  ctaUrl: z.string().trim().optional().nullable(),
  targetClass: z.string().trim().optional().nullable(),
  targetExam: z.string().trim().optional().nullable(),
  targetBoard: z.string().trim().optional().nullable(),
  targetBatchId: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const existing = await prisma.todaySpecial.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Not found.", 404);

    const input = patchSchema.parse(await req.json());
    const item = await prisma.todaySpecial.update({ where: { id: params.id }, data: input });
    return apiSuccess({ item });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const existing = await prisma.todaySpecial.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Not found.", 404);

    await prisma.todaySpecial.delete({ where: { id: params.id } });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
