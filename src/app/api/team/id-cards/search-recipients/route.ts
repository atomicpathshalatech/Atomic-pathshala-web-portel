import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { canManageCards } from "@/lib/id-card/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Please log in.", 401);

    const q = (request.nextUrl.searchParams.get("q") || "").trim();
    const kind = request.nextUrl.searchParams.get("kind") === "student" ? "STUDENT" : "TEAM";

    if (!(await canManageCards(session.user.id, kind))) {
      return apiError("Unauthorized", 403);
    }

    if (kind === "TEAM") {
      const users = await prisma.user.findMany({
        where: {
          status: "ACTIVE",
          role: { name: { notIn: ["STUDENT", "PARENT", "GUEST"] } },
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                  { phone: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        take: 20,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          photoUrl: true,
          position: true,
          department: true,
          contractStart: true,
          teacher: { select: { employeeCode: true, subjects: true } },
          idCards: { where: { kind: "TEAM" }, select: { employeeCode: true }, take: 1 },
        },
      });

      const results = users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        photoUrl: u.photoUrl,
        employeeCode: u.teacher?.employeeCode || u.idCards?.[0]?.employeeCode || "—",
        designation: u.position || (u.teacher?.subjects?.[0] ? `${u.teacher.subjects[0]} Faculty` : "Team Member"),
        department: u.department || "Academic",
        joiningDate: u.contractStart ? u.contractStart.toISOString().split("T")[0] : "",
      }));

      return apiSuccess({ recipients: results });
    } else {
      const students = await prisma.student.findMany({
        where: {
          status: { not: "DROPPED" },
          ...(q
            ? {
                OR: [
                  { user: { name: { contains: q, mode: "insensitive" } } },
                  { user: { email: { contains: q, mode: "insensitive" } } },
                  { user: { phone: { contains: q, mode: "insensitive" } } },
                  { enrollmentNumber: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        take: 20,
        select: {
          userId: true,
          enrollmentNumber: true,
          studentIdCode: true,
          user: {
            select: {
              name: true,
              email: true,
              phone: true,
              photoUrl: true,
            },
          },
        },
      });

      const results = students.map((s) => ({
        id: s.userId,
        name: s.user.name,
        email: s.user.email,
        phone: s.user.phone,
        photoUrl: s.user.photoUrl,
        employeeCode: s.enrollmentNumber || s.studentIdCode || "—",
        designation: "Student",
        department: "Student Enrollment",
        joiningDate: "",
      }));

      return apiSuccess({ recipients: results });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
