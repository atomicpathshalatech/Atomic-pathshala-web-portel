import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { applicationApproveSchema } from "@/lib/validation/teacher";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEACHER_CREATE);

    const application = await prisma.teacherApplication.findUnique({ where: { id: params.id } });
    if (!application) return apiError("Application not found", 404);
    if (application.status === "VERIFIED") {
      return apiError("This application has already been approved.", 409);
    }

    const input = applicationApproveSchema.parse(await request.json());

    const emailTaken = await prisma.user.findUnique({
      where: { email: application.email },
      select: { id: true },
    });
    if (emailTaken) {
      return apiError("An account with this applicant's email already exists.", 409);
    }
    const codeTaken = await prisma.teacher.findUnique({
      where: { employeeCode: input.employeeCode },
      select: { id: true },
    });
    if (codeTaken) {
      return apiError("This employee code is already in use.", 409);
    }

    const teacherRole = await prisma.role.findUnique({ where: { name: "TEACHER" } });
    if (!teacherRole) {
      throw new Error("TEACHER role is not seeded. Run `npm run db:seed` first.");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: application.email,
          passwordHash,
          name: application.fullName,
          roleId: teacherRole.id,
          status: "ACTIVE",
        },
      });

      const teacher = await tx.teacher.create({
        data: {
          userId: user.id,
          employeeCode: input.employeeCode,
          department: input.department,
          subjects: input.subjects,
          bio: application.bio,
        },
      });

      const updatedApplication = await tx.teacherApplication.update({
        where: { id: application.id },
        data: {
          status: "VERIFIED",
          reviewedById: session.user.id,
          reviewedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "APPLICATION_APPROVED_AND_HIRED",
          entityType: "Teacher",
          entityId: teacher.id,
          metadata: { applicationId: application.id, employeeCode: input.employeeCode },
        },
      });

      return { user, teacher, application: updatedApplication };
    });

    return apiSuccess(
      { userId: result.user.id, teacherId: result.teacher.id, email: result.user.email },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
