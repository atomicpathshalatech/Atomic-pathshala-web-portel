import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { handleApiError } from "@/lib/api/response";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FINANCE_REPORT_EXPORT);

    const { id } = params;

    const payrollRun = await prisma.payrollRun.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            employee: true,
          },
        },
      },
    });

    if (!payrollRun) {
      return handleApiError(new Error("Payroll run not found"));
    }

    // Format CSV for Bank Batch Payout
    const headers = [
      "Beneficiary Name",
      "Account Number (Masked)",
      "IFSC Code",
      "Net Amount (INR)",
      "Remarks / Narration",
      "Employee ID",
      "Payslip Number",
    ];

    const rows = payrollRun.items.map((item) => {
      return [
        `"${item.employee.name.replace(/"/g, '""')}"`,
        `"${item.bankAccountNumberMasked || "N/A"}"`,
        `"${item.bankIfsc || "N/A"}"`,
        Number(item.netPayable).toFixed(2),
        `"Salary ${payrollRun.payrollMonth}"`,
        `"${item.employee.employeeId}"`,
        `"${item.payslipNumber}"`,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="Atomic_Pathshala_Payroll_${payrollRun.payrollMonth}.csv"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
