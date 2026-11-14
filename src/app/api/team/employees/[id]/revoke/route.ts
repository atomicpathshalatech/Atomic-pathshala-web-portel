import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { z } from "zod";

export const dynamic = "force-dynamic";

const revokeSchema = z.object({
  reason: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTRACT_UPDATE);

    const body = await request.json().catch(() => ({}));
    const data = revokeSchema.parse(body);

    const employee = await prisma.employee.findFirst({
      where: { OR: [{ id: params.id }, { employeeId: params.id }] },
    });
    if (!employee) return apiError("Employee not found", 404);

    const updated = await prisma.employee.update({
      where: { id: employee.id },
      data: {
        verificationStatus: "REVOKED",
        notes: data.reason
          ? `${employee.notes || ""}\n[REVOCATION REASON]: ${data.reason.trim()}`
          : employee.notes,
      },
    });

    return apiSuccess({
      employee: updated,
      message: "Employee verification status marked as REVOKED.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
