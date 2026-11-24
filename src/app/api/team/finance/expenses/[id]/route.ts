import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { recordLedgerEntry } from "@/lib/finance/ledger-service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const { id } = params;
    const body = await request.json();
    const { action, rejectionReason, paymentReference, paymentDate, bankAccountId } = body;

    const expense = await prisma.expense.findUnique({
      where: { id },
    });

    if (!expense) {
      return handleApiError(new Error("Expense not found"));
    }

    if (action === "APPROVE") {
      await requirePermission(session.user.id, PERMISSIONS.FINANCE_EXPENSE_APPROVE);

      const updated = await prisma.expense.update({
        where: { id },
        data: {
          approvalStatus: "APPROVED",
          approvedById: session.user.id,
          approvedAt: new Date(),
          rejectionReason: null,
        },
      });

      return apiSuccess({ expense: updated, message: "Expense approved successfully" });
    }

    if (action === "REJECT") {
      await requirePermission(session.user.id, PERMISSIONS.FINANCE_EXPENSE_APPROVE);

      const updated = await prisma.expense.update({
        where: { id },
        data: {
          approvalStatus: "REJECTED",
          approvedById: session.user.id,
          approvedAt: new Date(),
          rejectionReason: rejectionReason || "Rejected by finance admin",
        },
      });

      return apiSuccess({ expense: updated, message: "Expense rejected" });
    }

    if (action === "RECORD_PAYMENT") {
      await requirePermission(session.user.id, PERMISSIONS.FINANCE_EXPENSE_APPROVE);

      if (expense.approvalStatus !== "APPROVED") {
        return handleApiError(new Error("Only approved expenses can be paid"));
      }

      const updated = await prisma.expense.update({
        where: { id },
        data: {
          paymentStatus: "PAID",
          paymentReference,
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          ...(bankAccountId ? { bankAccountId } : {}),
        },
      });

      // Record in double-entry finance ledger as an outflow
      await recordLedgerEntry({
        type: "DEBIT",
        category: "EXPENSE",
        amount: Number(expense.totalAmount),
        referenceType: "EXPENSE",
        referenceId: expense.id,
        description: `Expense Payment: ${expense.expenseNumber} - ${expense.title} (${expense.vendorName})`,
        bankAccountId: bankAccountId || expense.bankAccountId || undefined,
        createdById: session.user.id,
      });

      return apiSuccess({ expense: updated, message: "Expense payment recorded and logged to ledger" });
    }

    return handleApiError(new Error("Invalid action"));
  } catch (error) {
    return handleApiError(error);
  }
}
