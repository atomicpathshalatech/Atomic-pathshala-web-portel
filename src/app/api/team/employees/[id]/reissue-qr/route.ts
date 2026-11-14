import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { reissueEmployeeQrToken } from "@/lib/employees/employee-service";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTRACT_UPDATE);

    const employee = await prisma.employee.findFirst({
      where: { OR: [{ id: params.id }, { employeeId: params.id }] },
    });
    if (!employee) return apiError("Employee not found", 404);

    const updated = await reissueEmployeeQrToken(employee.id);

    return apiSuccess({
      employee: updated,
      message: "Verification token and QR Code rotated successfully.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
