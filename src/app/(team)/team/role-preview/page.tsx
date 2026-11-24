import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/rbac/guard";
import { isSuperAdmin } from "@/lib/rbac/super-admin";
import { RoleSimulatorDashboard } from "@/components/team-portal/RoleSimulatorDashboard";

export const metadata: Metadata = {
  title: "View As / Role Preview Simulator | Atomic Pathshala",
  description: "Super Admin Role Simulator and Employee Portal Preview sandbox",
};

export default async function RolePreviewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const isSuper =
    (await isSuperAdminUser(session.user.id)) ||
    (await isSuperAdmin(session.user.id)) ||
    (session.user as any)?.role === "ADMIN" ||
    (session.user as any)?.role === "FOUNDER";

  if (!isSuper) {
    redirect("/team");
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <RoleSimulatorDashboard />
    </div>
  );
}
