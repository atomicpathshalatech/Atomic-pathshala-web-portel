import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { updateEmployee } from "@/lib/employees/employee-service";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEAM_PORTAL_ACCESS);

    const employee = await prisma.employee.findFirst({
      where: {
        OR: [{ id: params.id }, { employeeId: params.id }],
      },
      include: {
        certificates: {
          orderBy: { createdAt: "desc" },
        },
        verificationLogs: {
          orderBy: { scannedAt: "desc" },
          take: 20,
        },
      },
    });

    if (!employee) return apiError("Employee not found", 404);

    return apiSuccess({ employee });
  } catch (error) {
    return handleApiError(error);
  }
}

const updateEmployeeSchema = z.object({
  name: z.string().optional(),
  photoUrl: z.string().optional().nullable(),
  designation: z.string().optional(),
  department: z.string().optional(),
  dateOfJoining: z.string().optional(),
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
  assignedBatch: z.string().optional().nullable(),
  workLocation: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "FORMER", "TERMINATED"]).optional(),
  lastWorkingDate: z.string().optional().nullable(),
  verificationStatus: z.enum(["VERIFIED", "REVOKED", "SUSPENDED"]).optional(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTRACT_UPDATE);

    const body = await request.json();
    const data = updateEmployeeSchema.parse(body);

    const employee = await prisma.employee.findFirst({
      where: {
        OR: [{ id: params.id }, { employeeId: params.id }],
      },
    });
    if (!employee) return apiError("Employee not found", 404);

    const updated = await updateEmployee(employee.id, data);

    return apiSuccess({ employee: updated, message: "Employee profile updated successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
