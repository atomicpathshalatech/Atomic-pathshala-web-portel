import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission, requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { createAgreement } from "@/lib/agreements/agreement-service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  teacherId: z.string().min(1, "Educator is required"),
  documentType: z.enum(["JOINING_LETTER", "SERVICE_AGREEMENT"]).optional(),
  engagementType: z
    .enum([
      "FULL_TIME",
      "PART_TIME",
      "VISITING_FACULTY",
      "INDEPENDENT_CONSULTANT",
      "GUEST_EDUCATOR",
      "CONTENT_CREATOR",
    ])
    .optional(),
  title: z.string().optional(),
  designation: z.string().optional(),
  subject: z.string().optional(),
  annualSalary: z.string().optional(),
  monthlySalary: z.string().optional(),
  perLectureRate: z.string().optional(),
  perHourRate: z.string().optional(),
  compensationType: z.string().optional(),
  teachingHoursMonthly: z.string().optional(),
  doubtHoursMonthly: z.string().optional(),
  noticePeriodDays: z.string().optional(),
  effectiveDate: z.string().optional(),
  contractEndDate: z.string().optional(),
  assignedBatch: z.string().optional(),
  teachingMedium: z.string().optional(),
  workLocation: z.string().optional(),
  reportingAuthority: z.string().optional(),
  workingSchedule: z.string().optional(),
  academicSession: z.string().optional(),
  specialConditions: z.string().optional(),
  panNumber: z.string().optional(),
  address: z.string().optional(),
  // e-Stamp
  stampCertificateNo: z.string().optional(),
  stampDutyAmount: z.string().optional(),
  stampIssuingState: z.string().optional(),
  stampInstrumentCategory: z.string().optional(),
  stampIssueDate: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTRACT_READ_ANY);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const documentType = searchParams.get("documentType");
    const query = searchParams.get("q");

    const agreements = await prisma.agreement.findMany({
      where: {
        ...(status && status !== "ALL" ? { status: status as any } : {}),
        ...(documentType && documentType !== "ALL" ? { documentType: documentType as any } : {}),
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
      joiningLetters: await prisma.agreement.count({ where: { documentType: "JOINING_LETTER" } }),
      serviceAgreements: await prisma.agreement.count({ where: { documentType: "SERVICE_AGREEMENT" } }),
      drafts: await prisma.agreement.count({ where: { status: "DRAFT" } }),
      sentToEducator: await prisma.agreement.count({
        where: { status: { in: ["SENT_TO_EDUCATOR", "VIEWED_BY_EDUCATOR", "DELIVERED_TO_EDUCATOR"] } },
      }),
      awaitingDirector: await prisma.agreement.count({
        where: { status: "AWAITING_DIRECTOR_SIGNATURE" },
      }),
      fullyExecuted: await prisma.agreement.count({
        where: { status: "FULLY_EXECUTED" },
      }),
      failedDelivery: await prisma.agreement.count({
        where: { status: "EMAIL_DELIVERY_FAILED" },
      }),
      stampAttached: await prisma.agreement.count({
        where: { status: "STAMP_ATTACHED" },
      }),
    };

    return apiSuccess({ agreements, stats });
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
      throw new UnauthorizedError("You do not have permission to generate agreements.");
    }

    const body = await request.json();
    const input = createSchema.parse(body);

    const agreement = await createAgreement(input, session.user.id);

    return apiSuccess({ agreement }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
