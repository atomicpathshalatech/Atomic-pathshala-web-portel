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
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const roleParam = request.nextUrl.searchParams.get("role") || request.nextUrl.searchParams.get("as");
    const requestedTeacherId = request.nextUrl.searchParams.get("teacherId");

    // Check if caller is an admin
    const { hasPermission } = await import("@/lib/rbac/guard");
    const { PERMISSIONS } = await import("@/lib/rbac/permissions");
    const isAdmin = await hasPermission(session.user.id, PERMISSIONS.BATCH_UPDATE);

    if (isAdmin && requestedTeacherId) {
      const bookings = await prisma.doubtBooking.findMany({
        where: { teacherId: requestedTeacherId },
        orderBy: { slot: { startTime: "desc" } },
        include: {
          slot: true,
          student: {
            include: {
              user: { select: { name: true, email: true, photoUrl: true } },
            },
          },
          teacher: {
            include: {
              user: { select: { name: true, email: true, photoUrl: true } },
            },
          },
        },
      });
      return apiSuccess({ bookings });
    }

    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    const student = await prisma.student.findUnique({ where: { userId: session.user.id } });

    // If caller explicitly asks for teacher bookings, or has a teacher profile and is in staff context
    const isTeacherContext =
      roleParam === "teacher" ||
      (Boolean(teacher) && (!student || session.user.role !== "STUDENT"));

    if (isTeacherContext && teacher) {
      const bookings = await prisma.doubtBooking.findMany({
        where: { teacherId: teacher.id },
        orderBy: { slot: { startTime: "desc" } },
        include: {
          slot: true,
          student: {
            include: {
              user: { select: { name: true, email: true, photoUrl: true } },
            },
          },
        },
      });
      return apiSuccess({ bookings });
    }

    if (student) {
      const bookings = await prisma.doubtBooking.findMany({
        where: { studentId: student.id },
        orderBy: { slot: { startTime: "desc" } },
        include: {
          slot: true,
          teacher: {
            include: {
              user: { select: { name: true, email: true, photoUrl: true } },
            },
          },
        },
      });
      return apiSuccess({ bookings });
    }

    if (teacher) {
      const bookings = await prisma.doubtBooking.findMany({
        where: { teacherId: teacher.id },
        orderBy: { slot: { startTime: "desc" } },
        include: {
          slot: true,
          student: {
            include: {
              user: { select: { name: true, email: true, photoUrl: true } },
            },
          },
        },
      });
      return apiSuccess({ bookings });
    }

    throw new ForbiddenError();
  } catch (error) {
    return handleApiError(error);
  }
}
