import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { recordLedgerEntry } from "@/lib/finance/ledger-service";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.HR_PAYROLL_DISBURSE);

    const { id } = params;
    const body = await request.json();
    const { bankAccountId, paymentReference } = body;

    const payrollRun = await prisma.payrollRun.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!payrollRun) {
      return handleApiError(new Error("Payroll run not found"));
    }

    if (payrollRun.status !== "APPROVED") {
      return handleApiError(new Error("Only APPROVED payroll runs can be disbursed."));
    }

    const now = new Date();

    // 1. Mark all items as PAID
    await prisma.payrollItem.updateMany({
      where: { payrollRunId: id },
      data: {
        payoutStatus: "PAID",
        paymentReference: paymentReference || "BANK_TRANSFER_BULK",
        paidAt: now,
      },
    });

    // 2. Mark payroll run as PAID
    const updated = await prisma.payrollRun.update({
      where: { id },
      data: {
        status: "PAID",
        disbursedById: session.user.id,
        disbursedAt: now,
      },
    });

    // 3. Record in finance ledger
    await recordLedgerEntry({
      type: "DEBIT",
      category: "PAYROLL",
      amount: Number(payrollRun.totalNet),
      referenceType: "PAYROLL_RUN",
      referenceId: payrollRun.id,
      description: `Payroll Disbursed: ${payrollRun.title} (${payrollRun.totalEmployees} employees, Net: ₹${payrollRun.totalNet})`,
      bankAccountId: bankAccountId || undefined,
      createdById: session.user.id,
    });

    return apiSuccess({ run: updated, message: "Payroll disbursed and recorded in finance ledger" });
  } catch (error) {
    return handleApiError(error);
  }
}
