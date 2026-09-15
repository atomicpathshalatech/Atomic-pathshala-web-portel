import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { teacherAdminUpdateSchema } from "@/lib/validation/teacher";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { deleteTeacherCascading } from "@/lib/team/resource-delete";

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
        displayName: data.displayName || null,
        targetExams: data.targetExams,
        classes: data.classes,
        languages: data.languages,
        experienceYears: data.experienceYears || null,
        qualifications: data.qualifications,
        experienceList: data.experienceList,
        bio: data.bio || null,
        ...(data.photoUrl ? { user: { update: { photoUrl: data.photoUrl } } } : {}),
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

/**
 * Permanently removes a teacher's platform account (see
 * deleteTeacherCascading in src/lib/team/resource-delete.ts for exactly
 * what that cascades through and the one case it refuses — a teacher who
 * is still the instructor of record on a Lecture). Admin-tier only:
 * TEACHER_DELETE isn't granted to any role's defaults, so only
 * SUPER_ADMIN/FOUNDER/ADMIN (which bypass the defaults check entirely,
 * see hasPermission in src/lib/rbac/guard.ts) can reach this.
 */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEACHER_DELETE);

    let deleted;
    try {
      deleted = await deleteTeacherCascading(params.id, session.user.id);
    } catch (deleteErr) {
      const message = deleteErr instanceof Error ? deleteErr.message : "Could not delete this teacher.";
      return apiError(message, 409);
    }
    if (!deleted) return apiError("Teacher not found", 404);

    return apiSuccess({ deleted: true, name: deleted.name });
  } catch (error) {
    return handleApiError(error);
  }
}
