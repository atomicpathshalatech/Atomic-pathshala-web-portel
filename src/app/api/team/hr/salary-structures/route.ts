import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.HR_SALARY_STRUCTURE_MANAGE);

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");

    const structures = await prisma.salaryStructure.findMany({
      where: {
        ...(employeeId ? { employeeId } : {}),
      },
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
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess({ structures });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.HR_SALARY_STRUCTURE_MANAGE);

    const body = await request.json();
    const {
      employeeId,
      paymentMode = "MONTHLY_SALARY",
      baseSalary = 0,
      hra = 0,
      specialAllowance = 0,
      conveyanceAllowance = 0,
      medicalAllowance = 0,
      perUnitRate = 0,
      pfApplicable = false,
      pfEmployerContribution = 0,
      pfEmployeeContribution = 0,
      esiApplicable = false,
      esiEmployerContribution = 0,
      esiEmployeeContribution = 0,
      tdsPercentage = 0,
      effectiveFrom,
    } = body;

    if (!employeeId) {
      return handleApiError(new Error("Employee ID is required"));
    }

    // Deactivate previous active structures for this employee
    await prisma.salaryStructure.updateMany({
      where: { employeeId, isActive: true },
      data: { isActive: false, effectiveUntil: new Date() },
    });

    const structure = await prisma.salaryStructure.create({
      data: {
        employeeId,
        paymentMode,
        baseSalary: Number(baseSalary),
        hra: Number(hra),
        specialAllowance: Number(specialAllowance),
        conveyanceAllowance: Number(conveyanceAllowance),
        medicalAllowance: Number(medicalAllowance),
        perUnitRate: Number(perUnitRate),
        pfApplicable: Boolean(pfApplicable),
        pfEmployerContribution: Number(pfEmployerContribution),
        pfEmployeeContribution: Number(pfEmployeeContribution),
        esiApplicable: Boolean(esiApplicable),
        esiEmployerContribution: Number(esiEmployerContribution),
        esiEmployeeContribution: Number(esiEmployeeContribution),
        tdsPercentage: Number(tdsPercentage),
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
        isActive: true,
      },
    });

    return apiSuccess({ structure, message: "Salary structure configured successfully" });
  } catch (error) {
    return handleApiError(error);
  }
}
