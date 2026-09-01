import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { SecurityCenter } from "@/components/team-portal/SecurityCenter";

export const metadata: Metadata = {
  title: "Security Center",
};

export default async function SecurityCenterPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canManage = await hasPermission(session.user.id, PERMISSIONS.SECURITY_CONFIG_MANAGE);
  if (!canManage) redirect("/team");

  const config = await prisma.securityConfig.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  return (
    <div className="space-y-stack-lg max-w-4xl">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">Security Center</h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          Session policy and device session management.
        </p>
      </div>
      <SecurityCenter initialPolicy={config.policy} />
    </div>
  );
}
