import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { teacherCreateSchema } from "@/lib/validation/teacher";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.TEACHER_READ);

    const teachers = await prisma.teacher.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess({ teachers });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEACHER_CREATE);

    const input = teacherCreateSchema.parse(await request.json());

    const existing = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      select: { id: true },
    });
    const codeTaken = await prisma.teacher.findUnique({
      where: { employeeCode: input.employeeCode },
      select: { id: true },
    });
    if (existing) {
      return apiError("An account with this email already exists.", 409);
    }
    if (codeTaken) {
      return apiError("This employee code is already in use.", 409);
    }

    const teacherRole = await prisma.role.findUnique({ where: { name: "TEACHER" } });
    if (!teacherRole) {
      throw new Error("TEACHER role is not seeded. Run `npm run db:seed` first.");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
          passwordHash,
          name: input.name,
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
          bio: input.bio || null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "TEACHER_ONBOARDED",
          entityType: "Teacher",
          entityId: teacher.id,
          metadata: { employeeCode: input.employeeCode },
        },
      });

      return { user, teacher };
    });

    return apiSuccess(
      { userId: created.user.id, teacherId: created.teacher.id },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
