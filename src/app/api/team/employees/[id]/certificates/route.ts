import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { generateCertificate } from "@/lib/employees/certificate-service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const certSchema = z.object({
  certificateType: z.enum([
    "EXPERIENCE_CERTIFICATE",
    "EMPLOYMENT_VERIFICATION",
    "RELIEVING_LETTER",
    "JOINING_LETTER",
  ]),
  issueDate: z.string().optional(),
  conductRemarks: z.string().optional(),
  customDesignation: z.string().optional(),
  customDepartment: z.string().optional(),
  customTenureStart: z.string().optional(),
  customTenureEnd: z.string().optional(),
  notes: z.string().optional(),
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
    const data = certSchema.parse(body);

    const employee = await prisma.employee.findFirst({
      where: { OR: [{ id: params.id }, { employeeId: params.id }] },
    });
    if (!employee) return apiError("Employee not found", 404);

    const certificate = await generateCertificate({
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
    });

    return apiSuccess({
      certificate,
      message: `Official certificate issued: ${certificate.certificateNumber}`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
