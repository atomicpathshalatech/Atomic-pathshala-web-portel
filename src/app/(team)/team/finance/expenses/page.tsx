import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ExpensesManager } from "@/components/team-portal/ExpensesManager";
import { FinanceNavTabs } from "@/components/team-portal/FinanceNavTabs";

export const metadata: Metadata = {
  title: "Expense Management",
};

export default async function ExpensesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.FINANCE_READ);
  if (!canRead) redirect("/team");

  const canApprove = await hasPermission(session.user.id, PERMISSIONS.FINANCE_EXPENSE_APPROVE);

  const [expenses, bankAccounts] = await Promise.all([
    prisma.expense.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.businessBankAccount.findMany({
      where: { isActive: true },
      select: { id: true, accountName: true, bankName: true },
    }),
  ]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <FinanceNavTabs />
      <ExpensesManager
        initialExpenses={expenses}
        bankAccounts={bankAccounts}
        canApprove={canApprove}
      />
    </div>
  );
}
