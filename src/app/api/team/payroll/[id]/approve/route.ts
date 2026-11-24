import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.HR_PAYROLL_APPROVE);

    const { id } = params;

    const payrollRun = await prisma.payrollRun.findUnique({
      where: { id },
    });

    if (!payrollRun) {
      return handleApiError(new Error("Payroll run not found"));
    }

    if (payrollRun.status === "APPROVED" || payrollRun.status === "PAID") {
      return handleApiError(new Error(`Payroll run is already ${payrollRun.status}`));
    }

    // Maker-Checker Separation: Ensure checker is not the same maker if possible
    if (payrollRun.preparedById && payrollRun.preparedById === session.user.id) {
      // Allow only if user is ADMIN or FOUNDER
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });
      if (user?.role?.name !== "ADMIN" && user?.role?.name !== "FOUNDER") {
        return handleApiError(
          new Error("Maker-Checker violation: Payroll cannot be approved by the same person who prepared it.")
        );
      }
    }

    const updated = await prisma.payrollRun.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedById: session.user.id,
        approvedAt: new Date(),
      },
      include: { items: true },
    });

    return apiSuccess({ run: updated, message: "Payroll run approved successfully" });
  } catch (error) {
    return handleApiError(error);
  }
}
