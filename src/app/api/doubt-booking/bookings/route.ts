import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { apiSuccess, handleApiError } from "@/lib/api/response";

/**
 * The caller's own bookings — as a student or as a teacher, resolved from
 * the session, never a client-supplied id. A user who is both (shouldn't
 * normally happen, but not assumed impossible) sees their student
 * bookings; a dedicated teacher view lives at /team/doubt-booking instead.
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
    if (student) {
      const bookings = await prisma.doubtBooking.findMany({
        where: { studentId: student.id },
        orderBy: { createdAt: "desc" },
        include: {
          slot: true,
          teacher: { include: { user: { select: { name: true, photoUrl: true } } } },
        },
      });
      return apiSuccess({ bookings });
    }

    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    if (teacher) {
      const bookings = await prisma.doubtBooking.findMany({
        where: { teacherId: teacher.id },
        orderBy: { createdAt: "desc" },
        include: {
          slot: true,
          student: { include: { user: { select: { name: true, photoUrl: true } } } },
        },
      });
      return apiSuccess({ bookings });
    }

    throw new ForbiddenError();
  } catch (error) {
    return handleApiError(error);
  }
}
