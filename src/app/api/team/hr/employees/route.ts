import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { maskAccountNumber, maskPan } from "@/lib/finance/bank-service";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.HR_EMPLOYEE_MANAGE);

    const employees = await prisma.employee.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        salaryStructures: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    return apiSuccess({ employees });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.HR_EMPLOYEE_MANAGE);

    const body = await request.json();
    const {
      id,
      pan,
      bankAccountName,
      bankAccountNumber,
      bankIfsc,
      bankName,
      bankBranch,
      pfUan,
      esiNumber,
      taxRegime,
    } = body;

    if (!id) {
      return handleApiError(new Error("Employee ID is required"));
    }

    const dataToUpdate: any = {};

    if (pan) {
      dataToUpdate.panMasked = maskPan(pan);
    }
    if (bankAccountNumber) {
      dataToUpdate.bankAccountNumberMasked = maskAccountNumber(bankAccountNumber);
    }
    if (bankAccountName) dataToUpdate.bankAccountName = bankAccountName;
    if (bankIfsc) dataToUpdate.bankIfsc = bankIfsc.trim().toUpperCase();
    if (bankName) dataToUpdate.bankName = bankName;
    if (bankBranch) dataToUpdate.bankBranch = bankBranch;
    if (pfUan) dataToUpdate.pfUan = pfUan;
    if (esiNumber) dataToUpdate.esiNumber = esiNumber;
    if (taxRegime) dataToUpdate.taxRegime = taxRegime;

    const updated = await prisma.employee.update({
      where: { id },
      data: dataToUpdate,
    });

    return apiSuccess({ employee: updated, message: "Employee bank & statutory details updated successfully" });
  } catch (error) {
    return handleApiError(error);
  }
}
