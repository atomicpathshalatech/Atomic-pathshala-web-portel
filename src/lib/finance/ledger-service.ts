import { prisma } from "@/lib/prisma";

export interface LedgerEntryInput {
  type: "CREDIT" | "DEBIT"; // CREDIT = Cash Inflow, DEBIT = Cash Outflow
  category:
    | "STUDENT_COLLECTION"
    | "GST_COLLECTED"
    | "GATEWAY_FEE"
    | "REFUND"
    | "EXPENSE"
    | "PAYROLL"
    | "SETTLEMENT"
    | "OWNER_DRAWING"
    | "ADJUSTMENT";
  amount: number;
  referenceType?: "BATCH_ORDER" | "SUBSCRIPTION" | "EXPENSE" | "PAYROLL_RUN" | "REFUND" | "MANUAL";
  referenceId?: string;
  description: string;
  bankAccountId?: string;
  createdById?: string;
}

/**
 * Record a formal double-entry style financial transaction in Atomic Pathshala's ledger.
 * Maintains chronological audit records and updates bank account balances if linked.
 */
export async function recordLedgerEntry(input: LedgerEntryInput) {
  const {
    type,
    category,
    amount,
    referenceType,
    referenceId,
    description,
    bankAccountId,
    createdById,
  } = input;

  if (amount <= 0) {
    throw new Error("Ledger entry amount must be greater than zero");
  }

  // Generate sequence entry number: e.g. "LED-2026-0001"
  const count = await prisma.financeLedgerEntry.count();
  const year = new Date().getFullYear();
  const entryNumber = `LED-${year}-${String(count + 1).padStart(5, "0")}`;

  let balanceAfter: number | undefined = undefined;

  // If a bank account is specified, adjust its current balance atomically
  if (bankAccountId) {
    const bankAccount = await prisma.businessBankAccount.findUnique({
      where: { id: bankAccountId },
    });

    if (bankAccount) {
      const current = Number(bankAccount.currentBalance);
      const adjustment = type === "CREDIT" ? amount : -amount;
      const newBalance = Math.round((current + adjustment) * 100) / 100;
      balanceAfter = newBalance;

      await prisma.businessBankAccount.update({
        where: { id: bankAccountId },
        data: { currentBalance: newBalance },
      });
    }
  }

  const entry = await prisma.financeLedgerEntry.create({
    data: {
      entryNumber,
      type,
      category,
      amount,
      referenceType,
      referenceId,
      description,
      bankAccountId,
      balanceAfter,
      createdById,
    },
  });

  return entry;
}

/**
 * Financial metrics aggregation across student collections, refunds, expenses, and payroll.
 */
export async function getFinancialSummary(dateFrom?: Date, dateTo?: Date) {
  const dateFilter = {
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: dateTo } : {}),
          },
        }
      : {}),
  };

  const ledgerFilter = {
    ...(dateFrom || dateTo
      ? {
          entryDate: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: dateTo } : {}),
          },
        }
      : {}),
  };

  // 1. Gross Student Collections (from SUCCESS BatchOrders)
  const ordersAggregate = await prisma.batchOrder.aggregate({
    where: {
      status: "SUCCESS",
      ...dateFilter,
    },
    _sum: {
      amount: true,
      discountAmount: true,
    },
    _count: true,
  });

  const grossCollections = Number(ordersAggregate._sum.amount || 0);
  const totalDiscounts = Number(ordersAggregate._sum.discountAmount || 0);
  const totalPaidOrders = ordersAggregate._count;

  // 2. Total Approved/Paid Expenses
  const expensesAggregate = await prisma.expense.aggregate({
    where: {
      approvalStatus: "APPROVED",
      paymentStatus: "PAID",
      ...dateFilter,
    },
    _sum: {
      totalAmount: true,
      gstAmount: true,
    },
    _count: true,
  });

  const totalExpenses = Number(expensesAggregate._sum.totalAmount || 0);
  const totalInputGst = Number(expensesAggregate._sum.gstAmount || 0);

  // 3. Total Disbursed Payroll
  const payrollAggregate = await prisma.payrollRun.aggregate({
    where: {
      status: "PAID",
      ...dateFilter,
    },
    _sum: {
      totalNet: true,
      totalGross: true,
      totalDeductions: true,
    },
    _count: true,
  });

  const totalPayrollDisbursed = Number(payrollAggregate._sum.totalNet || 0);
  const totalPayrollGross = Number(payrollAggregate._sum.totalGross || 0);

  // 4. Total Refunds
  const refundAggregate = await prisma.batchRefund.aggregate({
    where: {
      status: "SUCCESS",
      ...dateFilter,
    },
    _sum: {
      amount: true,
    },
    _count: true,
  });

  const totalRefunds = Number(refundAggregate._sum.amount || 0);

  // Net Cash Flow Calculation
  const netRevenue = grossCollections - totalRefunds;
  const totalOutflows = totalExpenses + totalPayrollDisbursed;
  const netEstimatedProfit = netRevenue - totalOutflows;

  // Bank Balances
  const bankAccounts = await prisma.businessBankAccount.findMany({
    where: { isActive: true },
    select: {
      id: true,
      accountName: true,
      bankName: true,
      accountNumberMasked: true,
      purpose: true,
      isPrimary: true,
      currentBalance: true,
    },
  });

  const totalBankBalance = bankAccounts.reduce(
    (sum, b) => sum + Number(b.currentBalance || 0),
    0
  );

  return {
    grossCollections,
    totalDiscounts,
    totalPaidOrders,
    totalRefunds,
    netRevenue,
    totalExpenses,
    totalInputGst,
    totalPayrollDisbursed,
    totalPayrollGross,
    totalOutflows,
    netEstimatedProfit,
    totalBankBalance,
    bankAccounts,
  };
}
