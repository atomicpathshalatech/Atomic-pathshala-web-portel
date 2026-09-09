import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  order: z.number().int().nonnegative().optional(),
  allowDownload: z.boolean().optional(),
  isPublished: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.STUDY_MATERIAL_MANAGE);

    const input = patchSchema.parse(await request.json());
    const material = await prisma.studyMaterial.update({
      where: { id: params.id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.order !== undefined ? { order: input.order } : {}),
        ...(input.allowDownload !== undefined ? { allowDownload: input.allowDownload } : {}),
        ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
      },
    });
    return apiSuccess({ material });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.STUDY_MATERIAL_MANAGE);

    await prisma.studyMaterial.delete({ where: { id: params.id } });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
