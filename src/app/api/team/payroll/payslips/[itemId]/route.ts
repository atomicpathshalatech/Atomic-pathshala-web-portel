import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const { itemId } = params;

    const item = await prisma.payrollItem.findUnique({
      where: { id: itemId },
      include: {
        payrollRun: true,
        employee: true,
      },
    });

    if (!item) {
      return handleApiError(new Error("Payslip item not found"));
    }

    // Access control: Employee themselves OR users with HR_PAYSLIP_VIEW_ANY
    const isOwner = item.employee.userId === session.user.id;
    if (!isOwner) {
      await requirePermission(session.user.id, PERMISSIONS.HR_PAYSLIP_VIEW_ANY);
    }

    // Fetch business profile for branding
    const businessProfile = await prisma.businessProfile.findFirst({
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess({
      item,
      businessProfile,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
