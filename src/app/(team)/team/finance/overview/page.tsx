import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getFinancialSummary } from "@/lib/finance/ledger-service";
import { FinanceOverviewDashboard } from "@/components/team-portal/FinanceOverviewDashboard";
import { FinanceNavTabs } from "@/components/team-portal/FinanceNavTabs";

export const metadata: Metadata = {
  title: "Finance & Accounting Overview",
};

export default async function FinanceOverviewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.FINANCE_READ);
  if (!canRead) redirect("/team");

  const [summary, ledger] = await Promise.all([
    getFinancialSummary(),
    prisma.financeLedgerEntry.findMany({
      take: 50,
      orderBy: { entryDate: "desc" },
    }),
  ]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <FinanceNavTabs />
      <FinanceOverviewDashboard initialSummary={summary} initialLedger={ledger} />
    </div>
  );
}
