import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const canRead =
      (await hasPermission(session.user.id, PERMISSIONS.STUDENT_READ_ANY)) ||
      (await hasPermission(session.user.id, PERMISSIONS.USER_READ));
    if (!canRead) return apiError("Forbidden", 403);

    const student = await prisma.student.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            photoUrl: true,
            status: true,
            createdAt: true,
          },
        },
        batchEnrollments: {
          include: {
            batch: true,
          },
        },
        subscription: true,
        attempts: {
          take: 5,
          orderBy: { startedAt: "desc" },
        },
      },
    });

    if (!student) return apiError("Student not found", 404);

    const allBatches = await prisma.batch.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
    });

    return apiSuccess({ student, allBatches });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const canUpdate =
      (await hasPermission(session.user.id, PERMISSIONS.STUDENT_UPDATE)) ||
      (await hasPermission(session.user.id, PERMISSIONS.USER_UPDATE));
    if (!canUpdate) return apiError("Forbidden", 403);

    const body = await req.json();
    const { status, academicStatus, class: targetClass, targetExam, phone, name } = body;

    const student = await prisma.student.findUnique({
      where: { id: params.id },
      include: { user: true },
    });

    if (!student) return apiError("Student not found", 404);

    const updated = await prisma.$transaction(async (tx) => {
      if (status || phone !== undefined || name) {
        await tx.user.update({
          where: { id: student.userId },
          data: {
            ...(status ? { status } : {}),
            ...(phone !== undefined ? { phone } : {}),
            ...(name ? { name } : {}),
          },
        });
      }

      return tx.student.update({
        where: { id: params.id },
        data: {
          ...(academicStatus ? { status: academicStatus } : {}),
          ...(targetClass ? { class: targetClass } : {}),
          ...(targetExam ? { targetExam } : {}),
        },
        include: {
          user: true,
          batchEnrollments: { include: { batch: true } },
        },
      });
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
