import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { applicationStatusSchema } from "@/lib/validation/teacher";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEACHER_UPDATE);

    const existing = await prisma.teacherApplication.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Application not found", 404);

    const data = applicationStatusSchema.parse(await request.json());

    const application = await prisma.teacherApplication.update({
      where: { id: params.id },
      data: {
        status: data.status,
        reviewNotes: data.reviewNotes || existing.reviewNotes,
        reviewedById: session.user.id,
        reviewedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: `APPLICATION_${data.status}`,
        entityType: "TeacherApplication",
        entityId: application.id,
      },
    });

    return apiSuccess({ application });
  } catch (error) {
    return handleApiError(error);
  }
}
