import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission, requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import {
  compileContractAgreement,
  DEFAULT_COMPANY_DETAILS,
  generateContractId,
  type ContractVariables,
} from "@/lib/contracts/templates";
import { z } from "zod";

const createContractSchema = z.object({
  teacherId: z.string().min(1, "Teacher is required"),
  title: z.string().min(3, "Title is required"),
  annualSalary: z.string().default("INR 6,00,000 /- per annum"),
  monthlySalary: z.string().default("INR 50,000 /- per month"),
  teachingHoursMonthly: z.string().default("70 Hours"),
  noticePeriodDays: z.string().default("60 Days"),
  effectiveDate: z.string().default("03 May, 2025"),
  contractEndDate: z.string().default("02 May, 2026"),
  workLocation: z.string().default("Remote / Atomic Studios, Greater Noida"),
  panNumber: z.string().default("DTHPA7342Q"),
  address: z.string().default("Village Ahmadnagar, Dist Rampur, Uttar Pradesh"),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTRACT_READ_ANY);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const query = searchParams.get("q");

    const contracts = await prisma.contract.findMany({
      where: {
        ...(status && status !== "ALL" ? { status: status as any } : {}),
        ...(query
          ? {
              OR: [
                { title: { contains: query, mode: "insensitive" } },
                { teacher: { user: { name: { contains: query, mode: "insensitive" } } } },
              ],
            }
          : {}),
      },
      include: {
        teacher: { include: { user: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const stats = {
      total: await prisma.contract.count(),
      drafts: await prisma.contract.count({ where: { status: "DRAFT" } }),
      sent: await prisma.contract.count({ where: { status: "SENT" } }),
      signed: await prisma.contract.count({ where: { status: "SIGNED" } }),
      declined: await prisma.contract.count({ where: { status: "DECLINED" } }),
    };

    return apiSuccess({ contracts, stats });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const canCreate =
      (await hasPermission(session.user.id, PERMISSIONS.CONTRACT_CREATE)) ||
      (await hasPermission(session.user.id, PERMISSIONS.TEAM_PORTAL_ACCESS));
    if (!canCreate) throw new UnauthorizedError("You do not have permission to generate contracts.");

    const body = await request.json();
    const input = createContractSchema.parse(body);

    const teacher = await prisma.teacher.findUnique({
      where: { id: input.teacherId },
      include: { user: true },
    });
    if (!teacher) return apiError("Teacher profile not found.", 404);

    const totalCount = await prisma.contract.count();
    const contractId = generateContractId(totalCount + 1);

    const vars: ContractVariables = {
      contractId,
      employeeName: teacher.user.name,
      employeeId: teacher.employeeCode,
      designation: `${teacher.department} Faculty`,
      department: teacher.department,
      email: teacher.user.email,
      phone: teacher.user.phone || "+91 98765 43210",
      address: input.address,
      panNumber: input.panNumber,
      effectiveDate: input.effectiveDate,
      contractEndDate: input.contractEndDate,
      salaryAnnual: input.annualSalary,
      salaryMonthly: input.monthlySalary,
      teachingHoursMonthly: input.teachingHoursMonthly,
      paymentCycleDay: "25th of each month",
      noticePeriodDays: input.noticePeriodDays,
      lockInMonths: "12",
      workLocation: input.workLocation,
      ...DEFAULT_COMPANY_DETAILS,
    };

    const compiledText = compileContractAgreement(vars);

    const contract = await prisma.contract.create({
      data: {
        teacherId: teacher.id,
        title: input.title || `Plus Educator Agreement — ${teacher.user.name}`,
        bodyText: compiledText,
        status: "SENT",
        sentAt: new Date(),
        createdById: session.user.id,
      },
      include: { teacher: { include: { user: true } } },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CONTRACT_CREATED",
        entityType: "Contract",
        entityId: contract.id,
        metadata: {
          contractId,
          teacherName: teacher.user.name,
          employeeCode: teacher.employeeCode,
          annualSalary: input.annualSalary,
        },
      },
    });

    return apiSuccess({ contract }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
