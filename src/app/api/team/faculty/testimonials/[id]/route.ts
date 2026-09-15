import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEACHER_UPDATE);

    const body = await request.json().catch(() => ({}));
    const { status, adminNote } = body;

    const validStatuses = ["PENDING", "APPROVED", "REJECTED", "HIDDEN"];
    if (status && !validStatuses.includes(status)) {
      return apiError("Invalid status value", 400);
    }

    const updated = await prisma.teacherTestimonial.update({
      where: { id: params.id },
      data: {
        ...(status ? { status } : {}),
        ...(adminNote !== undefined ? { adminNote } : {}),
        moderatedAt: new Date(),
        moderatedBy: session.user.id,
      },
    });

    return apiSuccess({ testimonial: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEACHER_DELETE);

    await prisma.teacherTestimonial.delete({
      where: { id: params.id },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
