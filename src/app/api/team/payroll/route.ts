import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { createOrCalculatePayrollRun } from "@/lib/payroll/payroll-engine";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FINANCE_READ);

    const runs = await prisma.payrollRun.findMany({
      orderBy: { payrollMonth: "desc" },
      include: {
        items: {
          include: {
            employee: {
              select: {
                employeeId: true,
                name: true,
                designation: true,
                department: true,
                employmentType: true,
              },
            },
          },
        },
      },
    });

    return apiSuccess({ runs });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.HR_PAYROLL_PREPARE);

    const body = await request.json();
    const { payrollMonth, notes } = body;

    if (!payrollMonth) {
      return handleApiError(new Error("Payroll month (YYYY-MM) is required"));
    }

    const run = await createOrCalculatePayrollRun({
      payrollMonth,
      preparedById: session.user.id,
      notes,
    });

    return apiSuccess({ run, message: `Payroll calculated for ${payrollMonth}` });
  } catch (error) {
    return handleApiError(error);
  }
}
