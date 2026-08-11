import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { teacherAdminUpdateSchema } from "@/lib/validation/teacher";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.TEACHER_READ);

    const teacher = await prisma.teacher.findUnique({
      where: { id: params.id },
      include: { user: true },
    });
    if (!teacher) return apiError("Teacher not found", 404);

    return apiSuccess({ teacher });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEACHER_UPDATE);

    const existing = await prisma.teacher.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Teacher not found", 404);

    const data = teacherAdminUpdateSchema.parse(await request.json());

    if (data.employeeCode !== existing.employeeCode) {
      const codeTaken = await prisma.teacher.findUnique({
        where: { employeeCode: data.employeeCode },
        select: { id: true },
      });
      if (codeTaken) return apiError("This employee code is already in use.", 409);
    }

    const teacher = await prisma.teacher.update({
      where: { id: params.id },
      data: {
        employeeCode: data.employeeCode,
        department: data.department,
        subjects: data.subjects,
        bio: data.bio || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TEACHER_UPDATE",
        entityType: "Teacher",
        entityId: teacher.id,
      },
    });

    return apiSuccess({ teacher });
  } catch (error) {
    return handleApiError(error);
  }
}
