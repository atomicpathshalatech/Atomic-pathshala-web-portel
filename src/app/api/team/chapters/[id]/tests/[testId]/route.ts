import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; testId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_UPDATE || PERMISSIONS.CHAPTER_UPDATE);

    const test = await prisma.test.findUnique({
      where: { id: params.testId },
    });
    if (!test) return apiError("Test not found", 404);

    const body = await request.json();
    const { name, durationMin, correctMarks, incorrectMarks, instructions, status, examType } = body;

    const updated = await prisma.test.update({
      where: { id: params.testId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(durationMin !== undefined && { durationMin: Number(durationMin) }),
        ...(correctMarks !== undefined && { correctMarks: Number(correctMarks) }),
        ...(incorrectMarks !== undefined && { incorrectMarks: Number(incorrectMarks) }),
        ...(instructions !== undefined && { instructions: instructions?.trim() || null }),
        ...(status !== undefined && { status }),
        ...(examType !== undefined && { examType }),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TEST_UPDATED",
        entityType: "Test",
        entityId: updated.id,
        metadata: { chapterId: params.id, name: updated.name },
      },
    });

    return apiSuccess({ test: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; testId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_DELETE || PERMISSIONS.CHAPTER_UPDATE);

    const test = await prisma.test.findUnique({
      where: { id: params.testId },
    });
    if (!test) return apiError("Test not found", 404);

    await prisma.test.delete({
      where: { id: params.testId },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TEST_DELETED",
        entityType: "Test",
        entityId: params.testId,
        metadata: { chapterId: params.id, name: test.name },
      },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
