import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; dppId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.DPP_CREATE || PERMISSIONS.CHAPTER_UPDATE);

    const dpp = await prisma.dpp.findUnique({
      where: { id: params.dppId, chapterId: params.id },
    });
    if (!dpp) return apiError("DPP not found", 404);

    const body = await request.json();
    const { name, level, difficulty, estimatedTimeMin, correctMarks, incorrectMarks, instructions, status } = body;

    const updated = await prisma.dpp.update({
      where: { id: params.dppId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(level !== undefined && { level: Number(level) }),
        ...(difficulty !== undefined && { difficulty }),
        ...(estimatedTimeMin !== undefined && { estimatedTimeMin: Number(estimatedTimeMin) }),
        ...(correctMarks !== undefined && { correctMarks: Number(correctMarks) }),
        ...(incorrectMarks !== undefined && { incorrectMarks: Number(incorrectMarks) }),
        ...(instructions !== undefined && { instructions: instructions?.trim() || null }),
        ...(status !== undefined && { status }),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DPP_UPDATED",
        entityType: "Dpp",
        entityId: updated.id,
        metadata: { chapterId: params.id, name: updated.name },
      },
    });

    return apiSuccess({ dpp: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; dppId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.DPP_DELETE || PERMISSIONS.CHAPTER_UPDATE);

    const dpp = await prisma.dpp.findUnique({
      where: { id: params.dppId, chapterId: params.id },
    });
    if (!dpp) return apiError("DPP not found", 404);

    await prisma.dpp.delete({
      where: { id: params.dppId },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DPP_DELETED",
        entityType: "Dpp",
        entityId: params.dppId,
        metadata: { chapterId: params.id, name: dpp.name },
      },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
