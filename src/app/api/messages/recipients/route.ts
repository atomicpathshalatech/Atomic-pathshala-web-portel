import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Unauthorized", 401);
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // "TEACHER" | "STUDENT" | "ADMIN"
    const query = (searchParams.get("q") || "").trim().toLowerCase();

    const userRole = (session.user as any).role || "STUDENT";
    const isAdmin =
      userRole === "SUPER_ADMIN" ||
      userRole === "ADMIN" ||
      userRole === "FOUNDER" ||
      userRole === "SUB_ADMIN";

    let teachers: any[] = [];
    let students: any[] = [];

    // Fetch teachers if requested or if caller is student/admin
    if (type === "TEACHER" || !type) {
      const rawTeachers = await prisma.teacher.findMany({
        where: query
          ? {
              OR: [
                { user: { name: { contains: query, mode: "insensitive" } } },
                { user: { email: { contains: query, mode: "insensitive" } } },
                { department: { contains: query, mode: "insensitive" } },
              ],
            }
          : undefined,
        include: {
          user: {
            select: { id: true, name: true, email: true, photoUrl: true },
          },
        },
        take: 50,
      });

      teachers = rawTeachers.map((t) => ({
        id: t.id,
        userId: t.user.id,
        name: t.user.name,
        email: t.user.email,
        photoUrl: t.user.photoUrl,
        type: "TEACHER",
        subtitle: t.department || "Faculty",
      }));
    }

    // Fetch students if caller is Teacher or Admin
    if ((isAdmin || userRole === "TEACHER") && (type === "STUDENT" || !type)) {
      const rawStudents = await prisma.student.findMany({
        where: query
          ? {
              OR: [
                { user: { name: { contains: query, mode: "insensitive" } } },
                { user: { email: { contains: query, mode: "insensitive" } } },
                { enrollmentNumber: { contains: query, mode: "insensitive" } },
              ],
            }
          : undefined,
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true, photoUrl: true },
          },
        },
        take: 50,
      });

      students = rawStudents.map((s) => ({
        id: s.id,
        userId: s.user.id,
        name: s.user.name,
        email: s.user.email,
        phone: s.user.phone,
        photoUrl: s.user.photoUrl,
        type: "STUDENT",
        subtitle: `${s.class || "Student"} • ${s.enrollmentNumber || "Enrolled"}`,
      }));
    }

    const adminRecipient = {
      id: "admin",
      userId: "admin",
      name: "Admin / Support Desk",
      email: "support@atomicpathshala.com",
      type: "ADMIN",
      subtitle: "Official Administration Helpdesk",
    };

    return apiSuccess({
      teachers,
      students,
      admin: adminRecipient,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
