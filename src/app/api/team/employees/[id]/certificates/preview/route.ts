import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, handleApiError } from "@/lib/api/response";
import { previewCertificatePdf } from "@/lib/employees/certificate-service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const previewSchema = z.object({
  certificateType: z.enum([
    "EXPERIENCE_CERTIFICATE",
    "EMPLOYMENT_VERIFICATION",
    "RELIEVING_LETTER",
    "JOINING_LETTER",
    "CONTRACT_LETTER",
    "INTERNSHIP_CERTIFICATE",
  ]),
  issueDate: z.string().optional(),
  conductRemarks: z.string().optional(),
  customDesignation: z.string().optional(),
  customDepartment: z.string().optional(),
  customTenureStart: z.string().optional(),
  customTenureEnd: z.string().optional(),
  notes: z.string().optional(),

  // Category 1: Official Joining Confirmation
  reportingAuthority: z.string().optional(),
  assignedSubject: z.string().optional(),
  assignedBatch: z.string().optional(),
  workLocation: z.string().optional(),
  reportingInstructions: z.string().optional(),
  workingSchedule: z.string().optional(),
  compensationReference: z.string().optional(),
  requiredDocuments: z.array(z.string()).optional(),

  // Category 3: Relieving Letter
  resignationReference: z.string().optional(),
  relievingEffectiveDate: z.string().optional(),
  handoverClearanceStatus: z.string().optional(),
  assetsReturnStatus: z.string().optional(),
  finalSettlementStatus: z.string().optional(),

  // Category 4: Contract Letter
  contractEndDate: z.string().optional(),
  engagementType: z.string().optional(),
  compensationType: z.string().optional(),
  monthlySalary: z.string().optional(),
  annualSalary: z.string().optional(),
  perLectureRate: z.string().optional(),
  perHourRate: z.string().optional(),
  teachingHoursMonthly: z.string().optional(),
  paymentCycleDay: z.string().optional(),
  noticePeriodDays: z.string().optional(),
  specialConditions: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTRACT_CREATE);

    const body = await request.json();
    const data = previewSchema.parse(body);

    const employee = await prisma.employee.findFirst({
      where: { OR: [{ id: params.id }, { employeeId: params.id }] },
    });
    if (!employee) return apiError("Employee not found", 404);

    const { pdfBuffer } = await previewCertificatePdf({
      employeeId: employee.id,
      certificateType: data.certificateType,
      issueDate: data.issueDate,
      conductRemarks: data.conductRemarks,
      customDesignation: data.customDesignation,
      customDepartment: data.customDepartment,
      customTenureStart: data.customTenureStart,
      customTenureEnd: data.customTenureEnd,
      notes: data.notes,
      createdById: session.user.id,

      // Category 1
      reportingAuthority: data.reportingAuthority,
      assignedSubject: data.assignedSubject,
      assignedBatch: data.assignedBatch,
      workLocation: data.workLocation,
      reportingInstructions: data.reportingInstructions,
      workingSchedule: data.workingSchedule,
      compensationReference: data.compensationReference,
      requiredDocuments: data.requiredDocuments,

      // Category 3
      resignationReference: data.resignationReference,
      relievingEffectiveDate: data.relievingEffectiveDate,
      handoverClearanceStatus: data.handoverClearanceStatus,
      assetsReturnStatus: data.assetsReturnStatus,
      finalSettlementStatus: data.finalSettlementStatus,

      // Category 4
      contractEndDate: data.contractEndDate,
      engagementType: data.engagementType,
      compensationType: data.compensationType,
      monthlySalary: data.monthlySalary,
      annualSalary: data.annualSalary,
      perLectureRate: data.perLectureRate,
      perHourRate: data.perHourRate,
      teachingHoursMonthly: data.teachingHoursMonthly,
      paymentCycleDay: data.paymentCycleDay,
      noticePeriodDays: data.noticePeriodDays,
      specialConditions: data.specialConditions,
    });

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="preview-${data.certificateType}.pdf"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
