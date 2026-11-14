import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { createEmployee } from "@/lib/employees/employee-service";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEAM_PORTAL_ACCESS);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const department = searchParams.get("department");
    const query = searchParams.get("q");

    const employees = await prisma.employee.findMany({
      where: {
        ...(status && status !== "ALL" ? { status: status as any } : {}),
        ...(department && department !== "ALL" ? { department } : {}),
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { employeeId: { contains: query, mode: "insensitive" } },
                { designation: { contains: query, mode: "insensitive" } },
                { department: { contains: query, mode: "insensitive" } },
                { email: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        certificates: {
          select: {
            id: true,
            certificateNumber: true,
            certificateType: true,
            issueDate: true,
            status: true,
          },
        },
        _count: {
          select: { verificationLogs: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const stats = {
      total: await prisma.employee.count(),
      active: await prisma.employee.count({ where: { status: "ACTIVE" } }),
      former: await prisma.employee.count({ where: { status: { in: ["FORMER", "TERMINATED"] } } }),
      inactive: await prisma.employee.count({ where: { status: "INACTIVE" } }),
      totalCertificates: await prisma.employeeCertificate.count(),
      totalScans: await prisma.employeeVerificationLog.count(),
    };

    return apiSuccess({ employees, stats });
  } catch (error) {
    return handleApiError(error);
  }
}

const createEmployeeSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  photoUrl: z.string().optional(),
  designation: z.string().min(2, "Designation is required"),
  department: z.string().min(2, "Department is required"),
  dateOfJoining: z.string().min(1, "Date of joining is required"),
  employmentType: z
    .enum([
      "FULL_TIME",
      "PART_TIME",
      "VISITING_FACULTY",
      "INDEPENDENT_CONSULTANT",
      "INTERN",
      "CONTRACT",
    ])
    .optional(),
  assignedBatch: z.string().optional(),
  workLocation: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "FORMER", "TERMINATED"]).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  userId: z.string().optional(),
  teacherId: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTRACT_CREATE);

    const body = await request.json();
    const data = createEmployeeSchema.parse(body);

    const employee = await createEmployee({
      ...data,
      createdById: session.user.id,
    });

    return apiSuccess({ employee, message: `Employee record created with ID ${employee.employeeId}` });
  } catch (error) {
    return handleApiError(error);
  }
}
