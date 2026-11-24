import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { BusinessTaxSettingsManager } from "@/components/team-portal/BusinessTaxSettingsManager";

export const metadata: Metadata = {
  title: "Business Profile & Tax Settings",
};

export default async function BusinessSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.FINANCE_READ);
  if (!canRead) redirect("/team");

  const canEdit = await hasPermission(session.user.id, PERMISSIONS.FINANCE_GST_MANAGE);

  const [profile, gst, taxRules, bankAccounts] = await Promise.all([
    prisma.businessProfile.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.gstSetting.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.taxRule.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.businessBankAccount.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <BusinessTaxSettingsManager
        initialProfile={profile}
        initialGst={gst}
        taxRules={taxRules}
        bankAccounts={bankAccounts}
        canEdit={canEdit}
      />
    </div>
  );
}
