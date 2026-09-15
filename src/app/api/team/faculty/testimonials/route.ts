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
    const status = searchParams.get("status");
    const teacherId = searchParams.get("teacherId");

    const where: any = {};
    if (status && status !== "ALL") {
      where.status = status;
    }
    if (teacherId) {
      where.teacherId = teacherId;
    }

    const testimonials = await prisma.teacherTestimonial.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        teacher: {
          include: {
            user: { select: { name: true, email: true, photoUrl: true } },
          },
        },
        student: {
          include: {
            user: { select: { name: true, email: true, photoUrl: true } },
          },
        },
      },
      take: 100,
    });

    return apiSuccess({ testimonials });
  } catch (error) {
    return handleApiError(error);
  }
}
