import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { PayrollManager } from "@/components/team-portal/PayrollManager";
import { FinanceNavTabs } from "@/components/team-portal/FinanceNavTabs";

export const metadata: Metadata = {
  title: "Payroll Management",
};

export default async function PayrollPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.FINANCE_READ);
  if (!canRead) redirect("/team");

  const canPrepare = await hasPermission(session.user.id, PERMISSIONS.HR_PAYROLL_PREPARE);
  const canApprove = await hasPermission(session.user.id, PERMISSIONS.HR_PAYROLL_APPROVE);
  const canDisburse = await hasPermission(session.user.id, PERMISSIONS.HR_PAYROLL_DISBURSE);

  const runs = await prisma.payrollRun.findMany({
    orderBy: { payrollMonth: "desc" },
    include: {
      items: {
        include: {
          employee: {
            select: {
              id: true,
              employeeId: true,
              name: true,
              designation: true,
              department: true,
              employmentType: true,
            },
          },
        },
      },
    },
    take: 24,
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <FinanceNavTabs />
      <PayrollManager
        initialRuns={runs}
        canPrepare={canPrepare}
        canApprove={canApprove}
        canDisburse={canDisburse}
      />
    </div>
  );
}
