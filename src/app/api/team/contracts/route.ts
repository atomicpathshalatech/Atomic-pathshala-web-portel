import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission, requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { createAgreement } from "@/lib/agreements/agreement-service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createContractSchema = z.object({
  teacherId: z.string().min(1, "Teacher is required"),
  title: z.string().optional(),
  annualSalary: z.string().default("INR 6,00,000 /- per annum"),
  monthlySalary: z.string().default("INR 50,000 /- per month"),
  teachingHoursMonthly: z.string().default("70 Hours"),
  noticePeriodDays: z.string().default("60 Days"),
  effectiveDate: z.string().default("03 May, 2025"),
  contractEndDate: z.string().default("02 May, 2026"),
  workLocation: z.string().default("Remote / Atomic Studios, Greater Noida"),
  panNumber: z.string().default("DTHPA7342Q"),
  address: z.string().default("Village Ahmadnagar, Dist Rampur, Uttar Pradesh"),
  stampCertificateNo: z.string().optional(),
  stampDutyAmount: z.string().optional(),
  stampIssuingState: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTRACT_READ_ANY);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const query = searchParams.get("q");

    // Fetch from new Agreement model
    const contracts = await prisma.agreement.findMany({
      where: {
        ...(status && status !== "ALL" ? { status: status as any } : {}),
        ...(query
          ? {
              OR: [
                { title: { contains: query, mode: "insensitive" } },
                { agreementNumber: { contains: query, mode: "insensitive" } },
                { educator: { user: { name: { contains: query, mode: "insensitive" } } } },
                { educator: { user: { email: { contains: query, mode: "insensitive" } } } },
              ],
            }
          : {}),
      },
      include: {
        educator: { include: { user: true } },
        signers: true,
        stamp: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const stats = {
      total: await prisma.agreement.count(),
      drafts: await prisma.agreement.count({ where: { status: "DRAFT" } }),
      sent: await prisma.agreement.count({
        where: { status: { in: ["SENT_TO_EDUCATOR", "VIEWED_BY_EDUCATOR", "DELIVERED_TO_EDUCATOR"] } },
      }),
      signed: await prisma.agreement.count({
        where: { status: { in: ["EDUCATOR_SIGNED", "DIRECTOR_SIGNED", "FULLY_EXECUTED"] } },
      }),
      declined: await prisma.agreement.count({ where: { status: "REJECTED" } }),
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
    if (!canCreate) {
      throw new UnauthorizedError("You do not have permission to generate contracts.");
    }

    const body = await request.json();
    const input = createContractSchema.parse(body);

    const agreement = await createAgreement(input, session.user.id);

    return apiSuccess({ contract: agreement }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
