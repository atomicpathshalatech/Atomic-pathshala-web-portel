import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { generateEmployeeIdCardPdf } from "@/lib/employees/id-card-generator";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEAM_PORTAL_ACCESS);

    const employee = await prisma.employee.findFirst({
      where: { OR: [{ id: params.id }, { employeeId: params.id }] },
    });
    if (!employee) {
      return new NextResponse("Employee not found", { status: 404 });
    }

    const pdfBuffer = await generateEmployeeIdCardPdf(employee);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Atomic_Pathshala_ID_Card_${employee.employeeId}.pdf"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error: any) {
    return new NextResponse(error?.message || "Internal Error", { status: 500 });
  }
}
