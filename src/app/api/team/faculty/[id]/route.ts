import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, hasPermission, UnauthorizedError } from "@/lib/rbac/guard";
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

    const canUpdate =
      (await hasPermission(session.user.id, PERMISSIONS.TEACHER_UPDATE)) ||
      (await hasPermission(session.user.id, PERMISSIONS.USER_UPDATE)) ||
      (await hasPermission(session.user.id, PERMISSIONS.USER_PROFILE_EDIT));
    if (!canUpdate) return apiError("Forbidden", 403);

    const existing = await prisma.teacher.findUnique({
      where: { id: params.id },
      include: { user: true },
    });
    if (!existing) return apiError("Teacher not found", 404);

    const data = teacherAdminUpdateSchema.parse(await request.json());
    const auditChanges: Record<string, { old: any; new: any }> = {};

    if (data.employeeCode !== existing.employeeCode) {
      const codeTaken = await prisma.teacher.findUnique({
        where: { employeeCode: data.employeeCode },
        select: { id: true },
      });
      if (codeTaken) return apiError("This employee code is already in use.", 409);
      auditChanges.employeeCode = { old: existing.employeeCode, new: data.employeeCode };
    }

    const userUpdateData: any = {};

    // 1. User Name
    if (data.name !== undefined && data.name.trim() !== "" && data.name.trim() !== existing.user.name) {
      userUpdateData.name = data.name.trim();
      auditChanges.name = { old: existing.user.name, new: userUpdateData.name };
    }

    // 2. User Email uniqueness
    if (data.email !== undefined) {
      const trimmedEmail = data.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        return apiError("Enter a valid email address.", 400);
      }
      if (trimmedEmail !== existing.user.email.toLowerCase()) {
        const emailTaken = await prisma.user.findFirst({
          where: {
            email: { equals: trimmedEmail, mode: "insensitive" },
            id: { not: existing.userId },
          },
          select: { id: true },
        });
        if (emailTaken) {
          return apiError("Email address is already associated with another account.", 409);
        }
        userUpdateData.email = trimmedEmail;
        auditChanges.email = { old: existing.user.email, new: trimmedEmail };
      }
    }

    // 3. User Phone uniqueness
    let cleanPhone: string | null | undefined = undefined;
    if (data.phone !== undefined) {
      const rawPhone = data.phone ? data.phone.trim() : null;
      cleanPhone = rawPhone ? rawPhone.replace(/\D/g, "").replace(/^0+/, "").replace(/^91(?=\d{10}$)/, "") : null;
      if (cleanPhone && !/^[6-9]\d{9}$/.test(cleanPhone)) {
        return apiError("Enter a valid 10-digit Indian mobile number.", 400);
      }
      if (cleanPhone !== existing.user.phone) {
        if (cleanPhone) {
          const phoneTaken = await prisma.user.findFirst({
            where: {
              phone: cleanPhone,
              id: { not: existing.userId },
            },
            select: { id: true },
          });
          if (phoneTaken) {
            return apiError("Mobile number is already associated with another account.", 409);
          }
        }
        userUpdateData.phone = cleanPhone;
        auditChanges.phone = { old: existing.user.phone, new: cleanPhone };
      }
    }

    // 4. Photo URL
    if (data.photoUrl !== undefined && data.photoUrl !== existing.user.photoUrl) {
      userUpdateData.photoUrl = data.photoUrl || null;
      auditChanges.photoUrl = { old: existing.user.photoUrl, new: userUpdateData.photoUrl };
    }

    // 5. Status
    if (data.status !== undefined && data.status !== null && data.status !== existing.user.status) {
      userUpdateData.status = data.status;
      auditChanges.status = { old: existing.user.status, new: data.status };
    }

    // 6. Position / Designation
    if (data.position !== undefined && data.position !== null && data.position !== existing.user.position) {
      userUpdateData.position = data.position;
      auditChanges.position = { old: existing.user.position, new: data.position };
    }

    // 7. Contract Type & End
    if (data.contractType !== undefined && data.contractType !== null && data.contractType !== existing.user.contractType) {
      userUpdateData.contractType = data.contractType;
      auditChanges.contractType = { old: existing.user.contractType, new: data.contractType };
    }
    if (data.contractEnd !== undefined) {
      userUpdateData.contractEnd = data.contractEnd ? new Date(data.contractEnd) : null;
    }

    // 8. Role Name (RBAC)
    if (data.roleName) {
      const { parseGlobalRole } = await import("@/lib/rbac/permissions");
      const resolvedRole = parseGlobalRole(data.roleName);
      if (resolvedRole) {
        let role = await prisma.role.findUnique({ where: { name: resolvedRole as any } });
        if (!role) {
          role = await prisma.role.create({
            data: {
              name: resolvedRole as any,
              label: resolvedRole.replace(/_/g, " "),
              isSystem: true,
            },
          });
        }
        userUpdateData.roleId = role.id;
      }
    }

    if (data.department && data.department !== existing.department) {
      auditChanges.department = { old: existing.department, new: data.department };
      userUpdateData.department = data.department;
    }
    if (data.displayName !== existing.displayName) {
      auditChanges.displayName = { old: existing.displayName, new: data.displayName };
    }

    const teacher = await prisma.teacher.update({
      where: { id: params.id },
      data: {
        ...(data.employeeCode ? { employeeCode: data.employeeCode } : {}),
        ...(data.department ? { department: data.department } : {}),
        subjects: data.subjects,
        displayName: data.displayName || null,
        targetExams: data.targetExams,
        classes: data.classes,
        languages: data.languages,
        experienceYears: data.experienceYears || null,
        qualifications: data.qualifications,
        experienceList: data.experienceList,
        bio: data.bio || null,
        ...(data.dob ? { dob: data.dob } : {}),
        ...(Object.keys(userUpdateData).length > 0 ? { user: { update: userUpdateData } } : {}),
      },
      include: { user: { include: { role: true } } },
    });

    if (Object.keys(auditChanges).length > 0) {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "TEACHER_PROFILE_UPDATE",
          entityType: "Teacher",
          entityId: teacher.id,
          metadata: {
            targetUserId: existing.userId,
            targetUserName: existing.user.name,
            changedFields: Object.keys(auditChanges),
            changes: auditChanges,
          },
        },
      });
    }

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
