import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEACHER_READ);

    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get("teacherId");
    const studentId = searchParams.get("studentId");

    const where: any = {};
    if (teacherId) where.teacherId = teacherId;
    if (studentId) where.studentId = studentId;

    const conversations = await prisma.teacherDirectConversation.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        teacher: {
          include: {
            user: { select: { id: true, name: true, email: true, photoUrl: true } },
          },
        },
        student: {
          include: {
            user: { select: { id: true, name: true, email: true, photoUrl: true } },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      take: 50,
    });

    return apiSuccess({ conversations });
  } catch (error) {
    return handleApiError(error);
  }
}
